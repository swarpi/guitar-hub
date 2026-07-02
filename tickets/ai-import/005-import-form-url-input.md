# Ticket: ImportForm — URL Input Mode

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0006 (Section 4 "Client-Side Architecture", Section 6 "Error Handling"), ai-import/004

## Context

Ticket 004 adds server-side URL fetching to the AI proxy: it detects a message whose content starts with `URL: ` and, on success, feeds the fetched page text into the same `claude -p` prompt flow used for pasted text; on fetch failure it responds with HTTP `502` and `{ error: { message: "Could not fetch the URL. Check the link and try again." } }`.

This ticket adds the client half: a URL input mode inside `ImportForm`, alongside the existing paste-text mode from ticket 002 (ADR-0006 Section 4 diagram lists "URL input (Phase 2)" as a sibling of the Phase 1 textarea within the same component). Per the ADR, the Phase 2 system prompt is identical to Phase 1, and the review/save flow (`onExtracted`, `SongForm`, `createSong`) is completely unchanged — this ticket is scoped to the input-collection step of `ImportForm` only.

The existing paste-mode flow, error states, and tests (`src/components/ImportForm.tsx`, `src/components/ImportForm.test.tsx`) must continue to work exactly as before; this ticket adds a mode alongside it, not a replacement.

## Goal

Add a URL input mode to `ImportForm` so the user can extract song data from a web link, reusing the existing extract/loading/error/callback flow and adding the new URL-fetch-failure error state.

## Acceptance Criteria

- [x] `ImportForm` renders an input-method toggle (two buttons, e.g. "Paste Text" and "URL") above the input area; the active method is visually distinct, following the same active/inactive button styling convention already used for the Manual/Import mode toggle in `AddPageClient` (copy the class strings locally — do not import from `AddPageClient`)
- [x] Default input method on mount is "Paste Text" (unchanged from ticket 002 — the existing textarea and its `aria-label`/`htmlFor` remain exactly as before)
- [x] In "URL" mode, a labeled text input (e.g. `type="url"`, label "Paste a link to a tab or chord page") replaces the textarea; the textarea is not rendered while in URL mode
- [x] The Extract button is disabled when the active mode's input is empty or trimmed-to-empty (same rule as ticket 002, now applied per-mode)
- [x] Pasted text and URL input are tracked in separate state so switching modes does not lose what the user typed in the other mode
- [x] Switching input method clears any currently displayed error message
- [x] Clicking "Extract" in URL mode:
  - [x] Sets the same loading state as paste mode (button label "Extracting...", disabled; `role="status"` loading indicator visible; input disabled)
  - [x] Sends `POST http://localhost:3456/v1/messages` with body `{ messages: [{ role: "user", content: "URL: " + <trimmed URL> }], system: SYSTEM_PROMPT, model: "claude-sonnet-4-5" }` — the same `SYSTEM_PROMPT` constant and `PROXY_URL` used by paste mode, unchanged
  - [x] Clears any previous error message
- [x] On a successful response (HTTP 200) in URL mode, parsing and field-mapping to `SongFormInitialValues` and the `onExtracted` call are identical to paste mode — implemented via the same shared code path, not duplicated per mode
- [x] New error — URL fetch failed (HTTP `502` response from the proxy):
  - [x] Shows inline error: "Could not fetch the URL. Check the link and try again."
  - [x] Shows "Try again" and "Use manual entry" buttons, consistent with the other error states
  - [x] Loading indicator clears; input and Extract button are re-enabled
- [x] All other existing error states (proxy unreachable, non-200/non-502 HTTP error, invalid JSON, empty `tabContent`) behave identically regardless of which mode triggered the request, via the same shared request/error-handling logic
- [x] All acceptance criteria and tests from ticket 002 continue to pass unmodified — paste mode's default rendering, request body shape, and existing error strings are unaffected by this change
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] Tests added to `src/components/ImportForm.test.tsx` cover:
  - [x] Default mode is "Paste Text": textarea is visible, URL input is not rendered
  - [x] Switching to "URL" mode hides the textarea and shows the URL input; Extract is disabled while the URL field is empty or whitespace-only
  - [x] Successful URL extraction: request body content is `"URL: https://example.com/tab"` (trimmed), and `onExtracted` is called with correctly mapped fields
  - [x] HTTP `502` response shows "Could not fetch the URL. Check the link and try again." with "Try again" and "Use manual entry" buttons present, loading indicator absent, input and Extract button re-enabled
  - [x] Switching input method while an error is displayed clears the error message
  - [x] Existing ticket 002 paste-mode tests still pass unmodified (regression)
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `scripts/ai-proxy.ts` or `scripts/url-import.ts` — that is ticket 004, already a hard dependency of this ticket
- Image/camera input (Phase 3 of ADR-0006)
- The duplicate warning banner (ticket 003) — parked until multi-instrument lands
- Any change to `src/components/AddPageClient.tsx`, `src/components/SongForm.tsx`, `src/app/add/page.tsx`, `src/app/actions.ts`, `src/db/schema.ts`, or `src/db/queries.ts`. This ticket is scoped entirely to `src/components/ImportForm.tsx` and `src/components/ImportForm.test.tsx`. A separate agent is working on ADR-0005 (multi-instrument) in a parallel worktree that renames `tabContent` → `content` and moves routes under `/guitar/add`; touching any of the files above risks merge conflicts with that work
- Client-side URL format validation beyond a non-empty check — malformed URLs are caught server-side by the proxy (ticket 004) and surfaced via the `502` error path. `type="url"` on the input is for browser affordances (mobile keyboard, basic native validation) only, not relied on for JS logic (jsdom's constraint validation for `type=url` is inconsistent, so tests should not depend on it)
- Persisting the selected input method across page reloads or navigation
- Retry with exponential backoff or request cancellation (unchanged from ticket 002's scope)

## Notes

**Do not touch outside ImportForm.** Per the parallel multi-instrument work, this ticket's diff must be confined to `src/components/ImportForm.tsx` and `src/components/ImportForm.test.tsx` (and, if truly necessary, `src/types/song.ts` for shared types — but no such change is expected here since `SongFormInitialValues` already exists). Do not modify `AddPageClient`, `SongForm`, any route, `actions.ts`, `schema.ts`, or `queries.ts`.

**Shared request logic:** Refactor the existing `handleExtract` in `ImportForm.tsx` so both modes funnel through one function that takes the message `content` string (either the raw pasted text or `"URL: " + url`) and runs the fetch → parse → map → error-branch flow once. This avoids duplicating the four existing error branches (ticket 002) and the new `502` branch across two code paths.

**Status-code contract:** `502` is reserved by the proxy (ticket 004) specifically for URL-fetch failures. Every other non-2xx status continues to map to the existing generic `ERROR_HTTP` ("The AI service returned an error. Try again.") message — do not special-case any other status code.

**SYSTEM_PROMPT and PROXY_URL are unchanged.** ADR-0006 Section 5 states the Phase 2 system prompt is identical to Phase 1; do not create a second prompt constant.

**Toggle labels:** "Paste Text" / "URL" are suggested labels — pick whatever reads clearly in context, but keep the accessible names stable so tests can query by role/name.

**ADR-0005 compatibility note:** Same as ticket 002 — when multi-instrument lands, the field name changes from `tabContent` to `content`. That is a separate, localized follow-up change to the field-mapping code touched in ticket 002; this ticket does not need to anticipate it beyond not hard-coding assumptions that would make that rename harder.

## Implementation Plan

1. Add an `InputMethod` (`"paste" | "url"`) state to `ImportForm` with separate `text` and `url` state values; render a "Paste Text" / "URL" toggle above the input area using the active/inactive class convention copied locally from `AddPageClient`. Switching methods clears any displayed error.
2. Render the existing textarea only in paste mode (unchanged label/id) and a labeled `type="url"` input ("Paste a link to a tab or chord page") only in URL mode; disable Extract when the active mode's trimmed value is empty.
3. Refactor the request flow into a shared `runExtraction(content)` used by both modes; `handleExtract` computes the content (`"URL: " + url.trim()` in URL mode, raw text in paste mode). Add the `502` branch ahead of the generic non-OK branch, mapping to "Could not fetch the URL. Check the link and try again." with the same Try again / Use manual entry recovery UI.
4. Add six URL-mode tests to `src/components/ImportForm.test.tsx` (default mode, mode switch + per-mode disable, state preserved across switches, trimmed `URL:` request body + `onExtracted` mapping, 502 error state with re-enabled inputs, error cleared on method switch); leave all ticket 002 tests unmodified.
5. Run `pnpm test` (85 passed), `pnpm lint` (clean after format), `pnpm build` (compiles).

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
