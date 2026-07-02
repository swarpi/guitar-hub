# Ticket: ImportForm Component — AI Proxy Integration

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0006

## Context

Ticket 001 created the `AddPageClient` wrapper with a mode toggle and a placeholder in import mode. This ticket implements the `ImportForm` client component and wires it into that placeholder.

`ImportForm` is the core of Phase 1: it takes pasted text, sends it to the local AI proxy at `http://localhost:3456/v1/messages`, parses the JSON response, and notifies the parent that extraction is complete. The proxy is already running when the developer uses `pnpm dev:ai` (or `pnpm dev:all`) — no proxy changes are required.

The proxy response shape: `{ content: [{ type: "text", text: string }], model: string, role: "assistant" }`. The `text` field is the raw JSON string the AI produced.

The system prompt is defined in ADR-0006 Section 3 and is reproduced in the Notes below.

## Goal

Implement `src/components/ImportForm.tsx` — a client component that drives the paste → extract → callback flow — and replace the placeholder in `AddPageClient` with the real component.

## Acceptance Criteria

- [x] `src/components/ImportForm.tsx` exists with `"use client"` at the top
- [x] `ImportForm` accepts two props:
  - `onExtracted: (fields: SongFormInitialValues) => void` — called on successful extraction
  - `onUseManual: () => void` — called when the user clicks the "use manual entry" fallback link in error states
- [x] The component renders a labeled textarea ("Paste your tab text here") and an "Extract" button
- [x] The "Extract" button is disabled when the textarea is empty or trimmed-to-empty
- [x] Clicking "Extract" with text in the textarea:
  - Sets a loading state: button label changes to "Extracting..." and is `disabled`; a visible loading indicator (spinner or animated text) appears below the textarea
  - Sends `POST http://localhost:3456/v1/messages` with body: `{ messages: [{ role: "user", content: <pasted text> }], system: <SYSTEM_PROMPT constant>, model: "claude-sonnet-4-5" }`
  - Clears any previous error message
- [x] On a successful response (HTTP 200):
  - Parses `response.content[0].text` as JSON
  - Maps the parsed object to `SongFormInitialValues`: `{ title, artist, capo: parsed.capo ?? null, tabContent: parsed.tabContent, notes: parsed.notes ?? null }`
  - Calls `onExtracted(fields)`
- [x] Error — proxy unreachable (network error / `fetch` throws):
  - Shows inline error: "AI service is not running. Start it with `pnpm dev:ai`."
  - Shows a "Use manual entry" button that calls `onUseManual()`
  - Shows a "Try again" button that retries the last extraction
- [x] Error — AI returns invalid JSON (JSON.parse throws on `content[0].text`):
  - Shows inline error: "Could not parse the AI response. Try again or switch to manual entry."
  - Shows a "Try again" button and a "Use manual entry" button
- [x] Error — parsed `tabContent` is empty string or missing:
  - Shows inline error: "No tab content was found in the input. Try pasting a different format."
  - Shows a "Try again" button and a "Use manual entry" button
- [x] Error — HTTP error (non-200 response):
  - Shows inline error: "The AI service returned an error. Try again."
  - Shows a "Try again" button and a "Use manual entry" button
- [x] All error states clear the loading indicator and re-enable the textarea and Extract button
- [x] The `ImportForm` is rendered inside `AddPageClient` in import mode, replacing the "Import form coming soon" placeholder from ticket 001. `AddPageClient`'s `onExtracted` handler is passed as the `onExtracted` prop; its mode-switch-to-manual handler is passed as `onUseManual`.
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] Tests cover all of the following scenarios (use `vi.stubGlobal("fetch", ...)` or `vi.spyOn(global, "fetch")` to mock the proxy call):
  - [x] Extract button is disabled when textarea is empty
  - [x] Loading state appears on click; Extract button becomes disabled
  - [x] Successful extraction: `onExtracted` called with correctly mapped fields (including `capo: null` when AI returns `null`)
  - [x] Proxy unreachable: error message shown, "Use manual entry" and "Try again" buttons present
  - [x] Invalid JSON response: correct error message shown
  - [x] Empty `tabContent` in response: correct error message shown
  - [x] HTTP error response: correct error message shown
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- URL input (Phase 2 of ADR-0006)
- Image/camera input (Phase 3 of ADR-0006)
- Any change to `scripts/ai-proxy.ts`
- Any change to `SongForm`, `src/app/actions.ts`, `src/db/schema.ts`, or `src/db/queries.ts`
- Duplicate warning banner — that is ticket 003
- Retry with exponential backoff or request cancellation

## Notes

**System prompt constant** (verbatim from ADR-0006 Section 3 — store as a `const SYSTEM_PROMPT` in the component file or in `src/lib/ai-prompts.ts`):

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

**Proxy URL:** Hard-code `http://localhost:3456/v1/messages` as a constant. This is a development-only tool; there is no production URL to abstract over.

**capo field handling:** The AI may return `capo: null`, `capo: 0`, or `capo: 5`. Map to `number | null` — `null` means no capo, `0` is a valid value meaning "fret 0 / open". Do not convert `0` to `null`.

**`SongFormInitialValues` type:** Defined in `src/components/SongForm.tsx`. If importing it from there causes a circular dependency or boundary issue, move the interface to `src/types/song.ts` and import from there in both files.

**Test file location:** `src/components/ImportForm.test.tsx` with `// @vitest-environment jsdom` at the top. Follow the pattern from `src/components/OfflineBanner.test.tsx`.

**ADR-0005 compatibility note:** When multi-instrument (ADR-0005) lands, the field name changes from `tabContent` to `content` in the schema and server action. At that point, update the system prompt constant (rename the field in the instructions) and update the field mapping in `ImportForm`. This is a localized two-line change.

## Implementation Plan

1. Create `src/components/ImportForm.tsx` with the `SYSTEM_PROMPT` constant, the hard-coded proxy URL, and the paste → extract → callback flow. Handle the four error states (unreachable, HTTP error, invalid JSON, empty `tabContent`) with distinct messages plus "Try again" / "Use manual entry" buttons.
2. Wire `ImportForm` into `AddPageClient`: remove the `renderImportForm` render-prop seam and the "Import form coming soon" placeholder from ticket 001; render `ImportForm` directly in import mode with `handleExtracted` as `onExtracted` and a new `handleUseManual` (switch to manual, clear extracted fields) as `onUseManual`.
3. Update `src/components/AddPageClient.test.tsx` to mock `./ImportForm` via `vi.mock` instead of the removed render prop; add a test for the `onUseManual` mode switch.
4. Write `src/components/ImportForm.test.tsx` (jsdom, `vi.stubGlobal("fetch", ...)`) covering: disabled Extract on empty/whitespace input, loading state, request body shape, successful mapping (`capo: null` and `capo: 0` preserved), all four error states, and Try-again retry.
5. Run `pnpm test`, `pnpm lint`, `pnpm build`; fix fallout. (Required excluding `.claude/worktrees/**` from vitest and gitignoring it so the stale multi-instrument worktree stops breaking `pnpm test` and `biome check`.)

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
