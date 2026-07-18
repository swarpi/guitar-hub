# ADR-0010: Chat-Based Import — Multi-Turn, Multi-Image Conversational Extraction

**Status:** Proposed  
**Date:** 2026-07-14  
**Author:** Architect Agent

## Context

The "Import via AI" panel on `/[instrument]/add` currently offers three discrete input modes — Paste Text, URL, and Image — each behind its own tab. Each mode collects a single input, sends one request to the local AI proxy (`localhost:3456/v1/messages`), and the response populates `SongForm` for review. This architecture was established in ADR-0006 (text and URL, Phases 1-2) and ADR-0009 (single image, Phase 3).

The user wants to replace this rigid, tab-based form with a chat-like interface. The motivating scenario: importing a guitar tab that spans multiple screenshots — for example, 2-4 panels from a YouTube fingerstyle tutorial (VVXO) — and having the AI stitch them into one complete transcription. The current single-image constraint forces the user to pick one panel, losing context from the others. Beyond multi-image, the user wants three things the current design does not provide:

1. **Free-form text alongside images.** Instead of a fixed "Transcribe the attached sheet" instruction, the user wants to type context like "These are 4 panels of the same song, stitch them together" or "Focus on the fingerpicking pattern, ignore the strumming section."
2. **In-chat result display.** Instead of the AI response silently jumping to `SongForm`, the user wants to see the extracted result as a chat message first — with a "Use this result" button to populate the form when satisfied.
3. **Multi-turn refinement.** After seeing the AI's first extraction, the user wants to send follow-up messages: "You missed the bridge section — here is a closer screenshot" or "The capo should be 2, not 3." Conversation history is preserved so the AI has context from prior turns.

The URL mode is explicitly dropped from the redesign. It is rarely used and adds complexity to the unified input. The proxy's URL-fetching code (`scripts/url-import.ts`) is retained in the codebase but no longer reachable from the new `ImportForm` UI.

This is a significant enough change — new interaction model, new proxy contract, new client-side state management — that it warrants a new ADR rather than an amendment to ADR-0009.

### Prior art and what this supersedes

- **ADR-0006** established the three-phase import plan (text, URL, image) and the extract-review-save flow. The extract-review-save pattern is preserved; the three-tab input UI and URL mode are superseded.
- **ADR-0009** established single-image import with canvas normalization, base64 transport, temp-file lifecycle, and instrument-aware prompts. All of those patterns are preserved and extended to arrays. The single-image contract and three-tab UI are superseded.
- The proxy's response envelope (`{ content: [{ type: "text", text }], model, role }`) is unchanged — every turn still returns the same shape. What changes is that the client now sends and receives multiple turns, and the proxy gains an `images` (plural) field.

## Decision

Replace `ImportForm`'s three-tab input with a single-pane chat interface that supports free-form text, multi-image attachments, multi-turn conversation, and in-chat result display — while preserving the proven extract-review-save flow that populates `SongForm` when the user accepts a result.

### 1. Interaction model: multi-turn chat with structured extraction

The new `ImportForm` presents a chat thread and a composer bar at the bottom:

```
+------------------------------------------+
|  (empty chat thread on first load)       |
|                                          |
|  User: [text + image thumbnails]         |
|  AI:   [extracted result card]           |
|         [ Use this result ]              |
|  User: [follow-up text + more images]    |
|  AI:   [revised result card]             |
|         [ Use this result ]              |
|                                          |
+------------------------------------------+
| [image previews]                         |
| [ text input          ] [+img] [ Send ]  |
+------------------------------------------+
```

**Composer bar.** An auto-expanding textarea (starts single-line, grows to ~4 lines) with an attachment button and a Send button. Enter sends; Shift+Enter inserts a newline. When no text is entered and no images are attached, Send is disabled.

**Image attachment.** The attachment button opens a file picker (`<input type="file" multiple accept="image/png,image/jpeg,image/webp">`). Images can also be added via drag-and-drop onto the chat area or clipboard paste (Cmd+V). Attached images appear as removable thumbnails above the composer bar before sending. Each image is normalized client-side (canvas downscale to 1600px longest edge, JPEG at 0.8 quality) using the existing `image-normalize.ts` module — called once per image in the attachment list. The practical limit is 10 images per message; a soft cap with a clear message if exceeded.

**Sending.** On send, the client:
1. Normalizes all attached images (reusing `normalizeImageToJpeg` per image).
2. Constructs a request with the full conversation history (all prior user and assistant messages) plus the new user message.
3. Posts to the proxy.
4. Appends the user message (with image thumbnail references) to the chat thread.
5. Shows a loading indicator in the chat thread ("Extracting...").
6. On response, appends the AI message to the thread.

**Result display.** The client attempts to parse every AI response as the standard 5-field JSON (`title`, `artist`, `capo`, `tabContent`, `notes`). If parsing succeeds and `tabContent` is non-empty, the message is rendered as a structured result card showing the extracted fields, with a "Use this result" button. If parsing fails (the AI sent conversational text, an error, or malformed JSON), the raw text is displayed as a plain chat message. The "Use this result" button calls `onExtracted(fields)`, which triggers the existing `AddPageClient` flow: switch to the review form with `SongForm` pre-filled.

**Multi-turn.** The conversation history is maintained in client-side React state (`messages: Array<ChatMessage>`). Each subsequent request sends the full history so the AI has context. This enables refinement: "You missed the bridge" or "Change the capo to 3." The proxy itself remains stateless — it receives the full history on every request and spawns a new `claude -p` process each time. History is ephemeral; it resets when the user navigates away or switches to Manual mode.

**Default message when only images are attached.** If the user attaches images but types no text, the client substitutes a default: "Transcribe the attached sheet(s)." This preserves the one-click convenience of the current Image mode.

### 2. Dropping URL mode

URL mode (`InputMethod: "url"`) is removed from the `ImportForm` UI. The proxy-side URL-fetching code (`scripts/url-import.ts`, the `extractUrlFromMessage` detection in `ai-proxy.ts`) is left in place but becomes dead code from the UI's perspective — the client no longer sends `"URL: https://..."` messages. This avoids a proxy-side breaking change and allows URL import to be re-added later if desired.

**Rationale.** The user confirmed URL mode is rarely used. Keeping it adds a special-case code path in the client (detect URL in text, use a different system prompt) that conflicts with the unified chat model. The user can still paste tab text copied from a website — the most common "URL" workflow was always copy-paste anyway.

### 3. Multi-image proxy contract

The proxy request body gains an `images` field (array) replacing the singular `image` field:

**Request (new shape):**

```jsonc
{
  "messages": [
    { "role": "user", "content": "Here are 3 panels of the same song" },
    { "role": "assistant", "content": "{\"title\":\"...\", ...}" },
    { "role": "user", "content": "You missed the bridge. Here's a closer shot" }
  ],
  "system": "<system prompt>",
  "model": "claude-sonnet-4-5",
  "instrument": "guitar",
  "images": [
    { "mediaType": "image/jpeg", "data": "<base64>" },
    { "mediaType": "image/jpeg", "data": "<base64>" }
  ]
}
```

Key changes from the ADR-0009 contract:

| Field | ADR-0009 | ADR-0010 |
|-------|----------|----------|
| `image` | Single object `{ mediaType, data }` | Removed |
| `images` | N/A | Array of `{ mediaType, data }` objects (0-10 items) |
| `messages` | Always 1 user message | Full conversation history (alternating user/assistant) |

**Backward compatibility.** The proxy accepts both `image` (singular, legacy) and `images` (plural, new) during a transition period. If `image` is present and `images` is not, the proxy wraps it in a single-element array internally. This avoids a hard cutover.

**Response (unchanged):**

```jsonc
{ "content": [{ "type": "text", "text": "<JSON or text>" }], "model": "...", "role": "assistant" }
```

### 4. Proxy-side multi-image handling

The image-import branch in `scripts/image-import.ts` is extended:

1. **Write all temp files.** Each image in the `images` array is decoded and written to a uniquely named temp file under `os.tmpdir()` (e.g., `guitarhub-import-<uuid>-0.jpg`, `guitarhub-import-<uuid>-1.jpg`).
2. **Build a multi-image prompt.** The prompt embeds all absolute paths: "Read the images at /tmp/guitarhub-import-abc-0.jpg, /tmp/guitarhub-import-abc-1.jpg, /tmp/guitarhub-import-abc-2.jpg and transcribe them as a single complete piece. [instrument-specific format instruction]". The `claude -p` Read (vision) tool handles multiple file references.
3. **Conversation history in the prompt.** When `messages` contains prior turns, `buildPrompt` concatenates them in `Human:/Assistant:` format (the existing `buildPrompt` function already does this for multi-message arrays). The new user message (with image file references) is the last turn.
4. **Bulk cleanup.** All temp files are deleted in a `finally`-style cleanup, regardless of success or failure. The existing `cleanupTempImageFile` is called once per file.

**Images attach to the current turn only.** Each request carries only the images for the *latest* user message. Prior turns' images are not re-sent — the AI has already seen them and its response is in the conversation history. This keeps payload size proportional to the new images, not the cumulative total.

### 5. System prompt and model

**System prompt selection.** The client sends the appropriate system prompt based on what the message contains:

| Input | System prompt |
|-------|--------------|
| Text only (no images) | `SYSTEM_PROMPT` (the existing text-parsing prompt) |
| Images (with or without text) | `IMAGE_SYSTEM_PROMPT` (the existing vision prompt) |

On follow-up turns, the system prompt is always sent (it is stateless per request) and matches the current turn's content type. If the user's first message had images and their follow-up is text-only ("change the capo to 3"), the text system prompt is used — but the conversation history gives the AI context from the prior image-based turn.

**Model.** Remains `claude-sonnet-4-5` as the default. The model field is still configurable per request but not exposed in the UI.

### 6. Client-side state shape

```typescript
interface ChatMessage {
  readonly id: string;              // crypto.randomUUID()
  readonly role: "user" | "assistant";
  readonly text: string;            // user's typed text or AI's raw response
  readonly imageCount?: number;     // how many images were attached (user messages only)
  readonly extractedFields?: SongFormInitialValues;  // parsed result (assistant messages only)
}
```

The `ImportForm` component manages:
- `messages: ChatMessage[]` — the conversation thread, rendered top-to-bottom.
- `inputText: string` — the composer textarea value.
- `attachedImages: File[]` — images staged for the next send, shown as removable thumbnails.
- `isLoading: boolean` — true while waiting for the AI response.

When "Use this result" is clicked on any assistant message, `onExtracted(message.extractedFields)` fires, which is the same callback `AddPageClient` already handles — switching to the review `SongForm`. The chat state is not discarded at this point; if the user clicks "Back to Import" from the review form, they return to the chat with history intact.

### 7. Error handling

The existing error model extends naturally to multi-turn:

| Case | Behavior |
|------|----------|
| Proxy unreachable | Error message appears as a system message in the chat thread. The user can retry (re-send the last message) or switch to manual entry. |
| AI returns invalid JSON | The raw text is displayed as a plain assistant message (not a result card). The user can send a follow-up: "Please format that as JSON." |
| AI returns empty tabContent | The result card renders but "Use this result" is disabled with a note: "No tab content found." The user can refine. |
| Image normalization fails | An inline error appears in the composer area (below the thumbnails). The problematic image is flagged; the user can remove it and retry. |
| Payload too large (>10 images) | The attachment button disables after 10 images with a message: "Maximum 10 images per message." |

The "Use manual entry" escape hatch remains available at all times — as a link or button below the chat thread.

### 8. What changes in existing code

| File / Area | Change | Scope |
|-------------|--------|-------|
| `src/components/ImportForm.tsx` | Full rewrite: remove `InputMethod` union and three-tab UI; add chat thread renderer, composer bar with multi-image attachment, conversation state management, result card with "Use this result" button, multi-turn request assembly | Rewritten |
| `src/components/ImportForm.test.tsx` | Full rewrite: test chat send/receive, multi-image attachment, result card parsing, "Use this result" callback, multi-turn history, error display in chat, image removal, default message substitution | Rewritten |
| `scripts/ai-proxy.ts` | Update `RequestBody` interface: add `images` array field; add backward-compat shim (`image` to `images` wrapper); route to updated `runImageExtraction` | Modified |
| `scripts/image-import.ts` | `runImageExtraction` accepts `images` array; writes multiple temp files; `buildImagePrompt` accepts multiple paths; bulk cleanup | Modified |
| `src/components/AddPageClient.tsx` | No structural change. The "Back to Import" button already exists and calls `handleBackToImport`, which sets `extractedFields` to null — this returns the user to the chat with history intact (ImportForm is not unmounted) | Unchanged |
| `src/lib/image-normalize.ts` | No change. Called once per image in a loop. | Unchanged |
| `src/components/SongForm.tsx` | No change. | Unchanged |
| `src/app/actions.ts`, `src/db/*` | No change. | Unchanged |
| `scripts/url-import.ts` | No change (retained but becomes dead code from the UI). | Unchanged |

### 9. Relationship to prior ADRs

- **ADR-0006** (AI tab import). The extract-review-save flow is preserved. The three-tab input UI and URL mode are superseded by this ADR. Phases 1 (text) and 3 (image) are unified into the chat input; Phase 2 (URL) is dropped from the UI.
- **ADR-0009** (in-app image import). The canvas normalization, base64 transport, temp-file lifecycle, and instrument-aware prompt patterns are all preserved and extended. The three-tab UI and single-image-per-request contract are superseded by this ADR. ADR-0009's status should be updated to "Superseded by ADR-0010" for the UI and contract aspects, with a note that its normalization and proxy patterns remain in effect.
- **ADR-0007** (MCP sheet-ingest pipeline). Unaffected. The MCP pipeline remains the high-accuracy path for dense scores. The chat import is the fast convenience path — same division of labor, now with multi-image and multi-turn.
- **ADR-0003** (UI design system). The chat interface uses the existing design tokens (leather buttons, ink text, paper backgrounds, mono labels). The chat thread, composer bar, and result cards are styled within the Folio system. No new colors or fonts.

## Consequences

### Positive

- **Multi-image stitching solves the primary pain.** Sending 2-4 screenshot panels in one message lets the AI see the full song and produce a complete transcription, eliminating the guesswork of single-panel extraction.
- **Free-form instructions improve extraction quality.** The user can add context ("this is a fingerstyle arrangement in drop-D") that the fixed "Transcribe the attached sheet" instruction could never carry.
- **Multi-turn refinement reduces round trips to manual editing.** Instead of accepting a flawed extraction, editing it in `SongForm`, realizing more is wrong, and starting over, the user says "fix the bridge" and gets an updated result in place.
- **In-chat result display gives the user control.** Seeing the extracted fields before they populate the form prevents the "surprise bad data in the form" experience and lets the user iterate before committing to review.
- **Simpler UI surface.** One input area with an attachment button replaces three tabs with three different form layouts. The conceptual model ("talk to the AI, attach images") is more intuitive than "choose a mode, fill out a mode-specific form."
- **Existing patterns reused.** Canvas normalization, base64 transport, temp-file lifecycle, instrument-aware prompts, the `onExtracted` callback, and the `SongForm` review flow are all unchanged. The change is in the input and display layer, not the extraction pipeline.

### Negative

- **ImportForm is a full rewrite.** The current component (473 lines) and its tests (710 lines) are replaced, not incrementally modified. The three-tab architecture does not bend into a chat layout — the state model, event handling, and rendering are fundamentally different. This is the largest single-component change in the project's history.
- **Multi-turn payload grows with conversation length.** Each request sends the full message history. A 5-turn conversation with text and image references is still small (the images themselves are only sent for the current turn), but the pattern does not scale to long conversations. Acceptable for the 2-5 turn extraction sessions this feature targets.
- **Proxy remains stateless; conversation context is approximate.** The proxy spawns a new `claude -p` process per request with the full history concatenated into the prompt. This is not a true Claude API conversation with maintained context — it is a prompt that includes prior turns as text. For short extraction dialogues this is adequate; for longer sessions, context quality may degrade. A future improvement could use the Claude API directly with proper conversation threading.
- **URL mode is dropped.** Users who relied on URL import must now copy-paste the page content. This is an intentional simplification, and the user confirmed it is acceptable, but it is a capability regression.
- **Enter-to-send may surprise users pasting multi-line text.** The chat convention (Enter sends, Shift+Enter for newline) conflicts with pasting large tab blocks. Mitigation: detect multi-line paste events and do not auto-send; only keyboard Enter triggers send.

### Neutral

- **Dead code: `url-import.ts` and its proxy branch.** The URL-fetching code remains in the codebase but is unreachable from the UI. It can be removed in a follow-up cleanup ticket or retained as a proxy capability for other tooling.
- **Image normalization is unchanged.** `image-normalize.ts` normalizes one image at a time; the client calls it in a loop for multi-image. No batch API is needed at 2-4 images.
- **Chat history is ephemeral.** It lives in React state and resets on navigation. There is no persistence layer, no conversation database, no session IDs. This is appropriate for a quick extraction tool, not a general-purpose chat product.
- **The `SongForm` review step is preserved.** "Use this result" is an explicit action; no extraction auto-saves. This maintains the safety net established in ADR-0006.

## Alternatives Considered

### Alternative 1: Keep three tabs, add multi-image to the Image tab only

The smallest change: expand Image mode to accept multiple files via `<input multiple>`, send them as an array, and leave Paste Text and URL modes untouched.

**Why rejected:** This solves multi-image but ignores every other request — free-form instructions, in-chat result display, and multi-turn refinement. The user explicitly asked for a chat-like conversational flow, not a wider file picker. The three-tab model also forces the user to choose a mode before they start, which is unnecessary friction when the modes (text, images) can coexist in one input.

### Alternative 2: Single-turn rich input (text + images) without multi-turn

A unified input that accepts text and multiple images in one submission, but no conversation history. Each "send" is an independent extraction attempt. Results populate `SongForm` directly (no in-chat display).

**Why rejected:** This was the initial design candidate and solves multi-image and free-form instructions. However, the user explicitly requested multi-turn refinement ("you missed the bridge, here is a closer screenshot") and in-chat result display. Single-turn forces the user to start from scratch on every iteration, and direct-to-form display hides the AI's output until it is already in the review form. The multi-turn model is a better match for the stated workflow, and the additional complexity (conversation state in React, history in the request body) is bounded — the proxy remains stateless, and the client state is a simple array of messages.

### Alternative 3: Multi-turn chat with streaming responses

Same as the chosen design but with Server-Sent Events (SSE) or chunked transfer for streaming the AI's response token by token into the chat thread.

**Why rejected:** The proxy spawns `claude -p` as a child process and captures stdout on close. Adding streaming requires either piping stdout line-by-line through an SSE endpoint or switching to the Claude API with streaming support. Both are significant proxy changes for a marginal UX improvement — extraction responses are typically 200-500 bytes of JSON that arrive in 5-15 seconds. A loading indicator ("Extracting...") is sufficient feedback. Streaming can be added later if response times grow, but it is not justified for the current payload size and latency profile.

### Alternative 4: Full Claude API integration (replace `claude -p` with direct API calls)

Replace the proxy's `child_process.spawn("claude", ...)` pattern with direct `fetch` calls to `https://api.anthropic.com/v1/messages`, gaining native multi-turn conversation support, proper image content blocks, and streaming.

**Why rejected:** This is architecturally superior for multi-turn but introduces API key management, billing, CORS configuration, and a dependency on external infrastructure. The current proxy is a zero-config local tool (`pnpm dev:ai` and it works). The `claude -p` pattern, while less elegant for multi-turn, is adequate for the 2-5 turn extraction sessions this feature targets. If multi-turn quality degrades at longer conversation lengths, this alternative becomes the natural next step — but it is a larger change that should be its own ADR.
