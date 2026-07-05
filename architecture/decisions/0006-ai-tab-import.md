# ADR-0006: AI Tab Import — Extract, Review, and Save Guitar Tabs via AI

**Status:** Proposed  
**Date:** 2026-06-28  
**Author:** Architect Agent

## Context

Guitar Hub is a personal guitar tab collection app. Adding a song today requires manually filling out a form: type the title, type the artist, paste the tab content, optionally set capo and notes. This works, but it is friction-heavy when the user already has the tab in front of them — on a website, in a photo, or copied to the clipboard.

The user wants to feed guitar tabs to an AI and have it automatically extract the structured data (title, artist, tab content, capo, notes) and add it to the collection. Three input types are envisioned:

1. **Pasted text** — the user copies a chord sheet or tab from a website and pastes it into a text area
2. **URL** — the user provides a link to a tab page (Ultimate Guitar, Songsterr, etc.) and the AI fetches and parses it
3. **Image/photo** — the user uploads a screenshot or camera photo of a printed tab sheet

The project already has an AI proxy server (`scripts/ai-proxy.ts`) that translates browser HTTP requests into `claude -p` CLI calls on port 3456. The proxy currently accepts text-only messages and returns Claude's response as JSON.

Key constraints:

1. **Edge runtime.** Production code runs on Cloudflare Pages (edge workers). No Node.js file system APIs, no long-running processes. AI calls must go through the local proxy (development-only) or a future API integration, not through the edge worker.
2. **Existing write path.** `createSongLogic` in `src/app/actions.ts` is a pure function that takes a Drizzle DB instance and FormData, validates inputs, creates the artist if needed, and inserts the song. This function is the canonical write path.
3. **Current schema.** This ADR designs against the current schema (`songs.tabContent`, routes at `/artists/...`). When ADR-0005 (multi-instrument support) lands, the import feature will adapt — the field name changes from `tabContent` to `content`, and an `instrument` field is added. The architecture accommodates this without structural changes.
4. **Single user, local development.** The AI proxy runs alongside `pnpm dev` on the user's machine. There is no API key management, no rate limiting, no multi-tenant concerns. The proxy is never deployed to production — it is a local development tool.

## Decision

### 1. Phased Rollout

The three input types ship in three phases, ordered by complexity:

| Phase | Input Type | What Ships | Complexity |
|-------|-----------|------------|------------|
| **Phase 1** | Pasted text | AI parses pasted text, extracts structured fields | Low |
| **Phase 2** | URL | Proxy fetches URL content, AI parses it | Medium |
| **Phase 3** | Image/photo | Proxy accepts image data, AI extracts tab from image | High |

Each phase is independently useful. Phase 1 alone covers the most common scenario: the user has already copied tab text from somewhere and wants to avoid manually splitting it into title, artist, and content fields.

### 2. User Flow: Import Mode on the Add Page

The import feature lives on the existing `/add` page, not a separate route. The page gains a mode toggle at the top:

```
[ Manual ]  [ Import via AI ]
```

**Manual mode** (current behavior): The existing `SongForm` with title, artist, capo, tab content, and notes fields.

**Import mode** (new): A simplified input area where the user provides raw material for the AI to parse. The flow has three steps:

```
Step 1: Input
  User pastes text (Phase 1), enters a URL (Phase 2), or uploads an image (Phase 3)
  User clicks "Extract"

Step 2: AI Processing
  Loading state while the AI proxy processes the input
  "Extracting song details..." with a spinner

Step 3: Review
  The extracted data populates the standard SongForm fields (title, artist, capo, tabContent, notes)
  The mode switches to show the filled-in form
  User reviews, edits if needed, and clicks "Save to Songbook"
  If a song with the same title and artist already exists, a warning banner appears:
    "A song with this title already exists for this artist."
  The user can change the title or cancel
```

**Why on the `/add` page, not a separate route:** The import flow ends with the same form and the same server action (`createSong`). Putting it on the same page avoids duplicating the form, the validation logic, and the artist autocomplete. The user sees one page with two input methods, not two pages that do similar things.

**Why review-before-save:** AI extraction is imperfect. The model may misidentify the artist, truncate the tab, miss a capo indication, or include extraneous text (ads, site navigation) in the tab content. Showing the extracted data in an editable form lets the user catch and fix errors before they reach the database. This is safer than auto-saving and requiring the user to find and edit incorrect entries later.

### 3. AI Prompt Design

The AI receives the raw input and a structured system prompt that instructs it to extract specific fields. The response must be valid JSON.

**System prompt (Phase 1, pasted text):**

```
You are a guitar tab parser. The user will paste raw text that contains a guitar 
tab, chord sheet, or chord chart. Extract the following fields:

- title: The song title
- artist: The artist or performer name
- capo: The capo fret number (integer 0-12), or null if no capo is mentioned
- tabContent: The complete guitar tablature or chord sheet content, preserving 
  exact formatting, line breaks, and spacing. Remove any ads, navigation text, 
  or website UI elements that are not part of the tab.
- notes: Any relevant metadata like tuning, tempo, difficulty, or source 
  attribution. Null if none found.

Respond with ONLY a JSON object containing these five fields. No markdown fences, 
no explanation, no commentary.

If you cannot identify the song title or artist from the text, use your best guess 
or set the field to "Unknown".
```

**Why JSON output, not form-filling:** The AI returns structured data that the client parses and maps to form fields. This is more reliable than asking the AI to fill out a form or generate HTML. JSON parsing is deterministic — it either succeeds or fails. If parsing fails, the client shows an error message and the user can retry or switch to manual mode.

**Model selection:** The proxy defaults to `claude-sonnet-4-5`. Tab extraction is a medium-complexity task — it requires reading comprehension and format preservation, but not deep reasoning. Sonnet is the right balance of quality and speed. The model is configurable per request if needed.

### 4. Client-Side Architecture

The import flow is a client component (`ImportForm`) that:

1. Collects the raw input (text, URL, or image depending on phase)
2. Sends it to the AI proxy (`POST http://localhost:3456/v1/messages`)
3. Parses the JSON response
4. Populates the `SongForm` state with the extracted fields

```
ImportForm (client component)
  |
  |-- textarea for pasted text (Phase 1)
  |-- URL input (Phase 2)
  |-- file upload / camera capture (Phase 3)
  |
  |-- "Extract" button
  |      |
  |      v
  |   POST to AI proxy (localhost:3456)
  |      |
  |      v
  |   Parse JSON response
  |      |
  |      v
  |   Populate SongForm fields via callback
  |
  v
SongForm (existing component, receives pre-filled values)
  |
  v
createSong server action (existing, unchanged)
```

**State management:** The `/add` page component manages the mode state (`manual` | `import`) and the extracted field values. When the AI returns data, the page updates the `SongForm` initial values and switches to showing the form. The `SongForm` component itself does not change — it already accepts `initialValues` as a prop.

**Duplicate detection:** Before populating the form, the client does not check for duplicates — that is the server action's job. However, after the form is populated and the user sees the extracted title and artist, they can recognize if the song already exists. If they submit and a duplicate is detected, the existing `createSongLogic` returns `{ error: "A song with this title already exists for this artist." }`, which the form already displays. To improve UX, a lightweight client-side check can query the existing song list (already loaded for artist autocomplete) and show a warning banner during the review step: "A song called [title] by [artist] may already exist." This is advisory, not blocking.

### 5. AI Proxy Changes by Phase

**Phase 1 (pasted text):** No proxy changes needed. The existing proxy accepts text messages and returns text. The client sends the pasted text as the user message content with the extraction system prompt.

**Phase 2 (URL):** The proxy gains a new capability: URL content fetching. Two approaches were evaluated:

- **Option A: Client fetches URL, sends text to proxy.** The browser fetches the URL via a CORS proxy or a Next.js API route, extracts the text content, and sends it to the AI proxy as a regular text message.
- **Option B: Proxy fetches URL directly.** The proxy receives a URL in the message, fetches the page content server-side (no CORS issues), and passes the full text to Claude.

**Decision: Option B — proxy fetches the URL.** Rationale:

1. No CORS issues. The proxy is a Node.js server with unrestricted network access.
2. No need for a separate CORS proxy or API route.
3. The proxy can use a headless fetch or a lightweight HTML-to-text library to clean the page content before sending it to Claude, reducing token usage.
4. The client sends a simple request: `{ messages: [{ role: "user", content: "URL: https://..." }], system: "..." }`. The proxy detects the URL pattern and fetches before prompting.

Implementation: The proxy detects when the user message starts with `URL:` (or a similar convention). It fetches the page content using Node.js `fetch`, extracts text (strip HTML tags, or use a library like `cheerio` for cleaner extraction), and constructs the prompt with the page text included. The system prompt for Phase 2 is identical to Phase 1 — the AI sees text, not HTML.

**Phase 3 (image):** The proxy gains image support. The Claude CLI accepts images via the `cat image.png | claude -p "..."` pipe pattern or via base64 content in the message. The client sends the image as a base64-encoded string in the request body. The proxy writes it to a temporary file and passes it to the CLI, or pipes it via stdin.

Implementation: The request body gains a new field for image data:

```typescript
interface RequestBody {
  messages: Message[];
  system?: string;
  model?: string;
  max_tokens?: number;
  image?: string; // base64-encoded image data (Phase 3)
}
```

The proxy detects the `image` field, writes the base64 data to a temp file, and adds the appropriate CLI flag (e.g., `--image /tmp/import.png`). The system prompt for Phase 3 instructs Claude to extract tab content from the image, using OCR-like capabilities.

**Image size handling:** Phone photos can be 5-10 MB. The client should resize images before sending — target 1-2 MP resolution, JPEG compression at 80% quality. This keeps the request payload under 1 MB (base64) while preserving enough detail for text recognition. Resizing happens client-side using a `<canvas>` element — no server-side image processing needed.

### 6. Error Handling

| Error Case | Behavior |
|-----------|----------|
| AI proxy unreachable | Show error: "AI service is not running. Start it with `pnpm dev:ai`." with a link to the manual form. |
| AI returns invalid JSON | Show error: "Could not parse the AI response. Try again or switch to manual entry." Allow retry. |
| AI cannot identify title/artist | AI returns `"Unknown"` for the field. The user sees "Unknown" in the review form and can edit it. |
| AI returns empty tab content | Show error: "No tab content was found in the input. Try pasting a different format." |
| URL fetch fails (Phase 2) | Show error: "Could not fetch the URL. Check the link and try again." |
| Image too large (Phase 3) | Client-side resize before sending. If still too large, show error with size guidance. |
| Network timeout | The proxy has a 120-second timeout. If exceeded, show a timeout error with retry option. |
| Song already exists | Warning banner during review: "A song with this title may already exist for this artist." Non-blocking — the user can change the title or proceed (the server action will reject true duplicates). |

**Graceful degradation:** Every error state includes a path to manual entry. The import feature is a convenience — the manual form is always available as a fallback. The UI should never trap the user in an error state with no way to proceed.

### 7. What Changes in Existing Code

| File / Area | Change | Scope |
|------------|--------|-------|
| `src/app/add/page.tsx` | Add mode toggle state, render `ImportForm` or `SongForm` based on mode | Modified |
| `src/components/ImportForm.tsx` | New client component for the import input area and AI interaction | New |
| `src/components/SongForm.tsx` | No changes. Already accepts `initialValues` prop. | Unchanged |
| `src/app/actions.ts` | No changes. `createSongLogic` and `createSong` are unchanged. | Unchanged |
| `src/db/schema.ts` | No changes. | Unchanged |
| `src/db/queries.ts` | No changes. | Unchanged |
| `scripts/ai-proxy.ts` | Phase 1: no changes. Phase 2: add URL fetching. Phase 3: add image handling. | Modified (Phases 2-3) |

**Key insight:** The import feature is almost entirely a client-side addition. It adds a new input method that produces the same output (populated form fields) that feeds into the same server action. The write path, database schema, and server-side logic are untouched.

### 8. ADR-0005 Compatibility

When ADR-0005 (multi-instrument) lands:

1. The `SongForm` will accept an `instrument` field. The import form can either default to `guitar` or let the AI detect the instrument type from the content.
2. The field name changes from `tabContent` to `content`. The AI prompt and JSON parsing update accordingly — a localized change in `ImportForm`.
3. The URL routes change from `/add` to `/guitar/add` and `/piano/add`. The `ImportForm` component is reusable across instrument-specific add pages.

None of these changes require rethinking the import architecture. The three-step flow (input, extract, review) and the proxy-based AI interaction are instrument-agnostic.

## Consequences

### Positive

- **Zero schema changes.** The import feature uses the existing write path (`createSongLogic`) without modifying the database schema, server actions, or queries. This minimizes risk and keeps the change surface small.
- **Review-before-save catches AI errors.** The user always sees what the AI extracted before it hits the database. Misidentified artists, truncated tabs, and extraneous content are caught at review time, not after the fact.
- **Phased delivery.** Each phase is independently shippable. Phase 1 (pasted text) delivers value immediately. Phases 2 and 3 build on top without reworking Phase 1 code.
- **Graceful degradation.** If the AI proxy is not running, or extraction fails, the user falls back to manual entry. The import feature is additive — it does not replace or break the existing flow.
- **Minimal bundle impact.** Phase 1 adds a client component with a textarea and a `fetch` call. No new libraries. Phases 2 and 3 add small increments (URL input, file upload with canvas resize). The heavy lifting is in the AI proxy (Node.js, development-only).

### Negative

- **Development-only AI.** The AI proxy runs on the user's local machine via `pnpm dev:ai`. The import feature does not work in the deployed production app — it requires the local proxy. This is acceptable for a personal app where the user always develops locally, but it means tabs cannot be imported from a phone unless the proxy is running on the local network.
- **AI output quality is variable.** Claude may misparse complex tabs, miss capo indications embedded in comments, or struggle with non-standard tab formats. The review step mitigates this, but the user should expect to edit extracted data occasionally.
- **Proxy becomes more complex over phases.** Phase 1 needs no proxy changes, but Phase 2 adds URL fetching (with HTML parsing) and Phase 3 adds image handling (temp files, CLI flags). The proxy grows from a simple text relay to a multi-modal preprocessor. This complexity is justified by the use cases but requires careful implementation.
- **No mobile import in production.** Because the AI proxy is local-only, the "take a photo of a tab sheet" workflow (Phase 3) only works when developing locally, not from the deployed PWA on a phone. A future enhancement could replace the local proxy with a direct Anthropic API call, but that requires API key management and is out of scope.

### Neutral

- **The AI model choice (Sonnet) is a default, not a constraint.** The proxy accepts a `model` parameter per request. If extraction quality is insufficient with Sonnet, the client can request Opus for complex tabs. The architecture does not depend on a specific model.
- **Phase 2 URL fetching may struggle with JavaScript-rendered pages.** Sites like Ultimate Guitar render tab content via JavaScript. A simple `fetch` in the proxy retrieves the initial HTML, which may not contain the tab. If this becomes an issue, the proxy can be enhanced with a headless browser (Puppeteer), but that is a Phase 2 implementation detail, not an architectural concern.
- **The import mode toggle adds minor UI complexity to the `/add` page.** The page goes from a single form to a mode switcher with two views. For a personal app used by one person, the added complexity is justified by the time saved on repeated imports.

## Alternatives Considered

### Alternative 1: Dedicated Import Page (`/import`)

Create a separate page at `/import` for AI-powered imports, keeping the existing `/add` page untouched.

**Why rejected:** The import flow and the manual add flow produce the same output — a populated form that calls `createSong`. Splitting them into separate pages duplicates the form rendering, artist autocomplete, and validation error display. It also fragments the "add a song" concept into two locations, forcing the user to choose a page before choosing an input method. A mode toggle on one page is simpler to navigate and easier to maintain.

### Alternative 2: Fully Automatic Import (No Review Step)

The AI extracts data and immediately saves it to the database. The user sees the song appear in their collection without an intermediate review step.

**Why rejected:** AI extraction is imperfect. Without review, errors land directly in the database: wrong artist names, truncated tabs, ads mixed into tab content. The user would then need to find the song, open the edit page, and fix it — more friction than reviewing before save. The review step costs one click ("Save to Songbook") but catches errors at the cheapest possible moment.

### Alternative 3: Server-Side AI Integration via Next.js API Route

Instead of calling the AI proxy from the browser, create a Next.js API route (`/api/import`) that handles the AI call server-side.

**Why rejected:** The production runtime is Cloudflare Pages (edge workers). Edge workers cannot spawn child processes (`claude -p`), cannot run long-lived HTTP servers, and have strict execution time limits (typically under 30 seconds, though configurable). The AI extraction call can take 10-30 seconds depending on input size and model. An edge function is the wrong execution environment for this.

The AI proxy is a Node.js server running on the user's local machine — it has no execution time limits, full file system access (for Phase 3 images), and unrestricted network access (for Phase 2 URL fetching). Keeping the AI call client-to-proxy (bypassing the edge entirely) is the correct architecture for this constraint set.

A future alternative would be calling the Anthropic API directly from the browser (with an API key stored in environment variables), which would work from the deployed app. But this introduces API key management, billing concerns, and CORS configuration that are unnecessary for a personal local-development workflow.

### Alternative 4: Browser Extension Instead of In-App Import

Build a browser extension that detects tab content on web pages and sends it to Guitar Hub with one click.

**Why rejected:** A browser extension is a separate project with its own build system, store listing, update mechanism, and cross-browser compatibility concerns. It solves only the URL input case (Phase 2) and does nothing for pasted text or images. The in-app import feature covers all three input types within the existing project. A browser extension could be built later as a complementary tool, but it is not a substitute for the core import flow.
