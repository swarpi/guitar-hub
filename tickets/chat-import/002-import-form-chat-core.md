# Ticket: ImportForm — Chat Thread Core (Multi-Turn Text, Drop URL Mode)

**Feature:** chat-import
**Status:** Done
**Priority:** P1
**Estimate:** L
**Related:** ADR-0010 (Sections 1 "Interaction model: multi-turn chat with structured extraction", 2 "Dropping URL mode", 6 "Client-side state shape", 7 "Error handling", 8 "What changes in existing code"), ai-import/002 and ai-import/005 (established the `runExtraction`/`sendExtraction` shared parse/error tail this ticket rebuilds the UI around)

## Context

`ImportForm.tsx` currently renders three mode tabs (Paste Text / URL / Image), each producing exactly one request whose result goes straight into `onExtracted` without ever being shown to the user. ADR-0010 replaces this with a chat thread: a scrolling list of `ChatMessage` entries (user/assistant), a composer bar (auto-expanding textarea, Enter-to-send / Shift+Enter-newline, Send button), full conversation history sent on every request, and AI responses rendered either as a structured **result card** (valid 5-field JSON with a "Use this result" button) or plain chat text (parse failure, empty extraction, or conversational reply). URL mode is dropped entirely from the UI — the proxy's URL-fetching code and its `extractUrlFromMessage` detection are left in place but unreachable from this component (ADR §2).

This ticket builds the chat shell and the multi-turn **text-only** flow. It explicitly excludes image attachment of any kind — that is chat-import/003, which layers onto this ticket's composer and message model. It also does not touch the proxy's `images` array contract (chat-import/001) beyond continuing to use the existing `messages`/`system`/`model` fields that text-only requests already send today.

Two bug fixes already on `master` must be preserved in this rewrite: JSON fence-stripping in the response-parsing tail (currently in `sendExtraction`), and (proxy-side, no client action needed here) `--add-dir tmpdir()`.

## Goal

Rewrite `ImportForm.tsx` around a chat thread and composer bar supporting multi-turn text-only conversation: in-chat result cards with "Use this result", raw-text fallback for non-JSON or empty-extraction responses, and removal of the Paste Text/URL tab UI in favor of a single composer.

## Acceptance Criteria

- [x] `ImportForm` renders a scrollable chat thread (empty on first load, top-to-bottom message order) above a composer bar; the three-pill toggle (`Paste Text`/`URL`/`Image`) and the `InputMethod` union are removed from the component entirely
- [x] Composer bar: an auto-expanding `<textarea>` (starts at 1 line, grows up to roughly 4 lines as content wraps, e.g. driven by `scrollHeight` capped at a max height) and a Send button; Send is disabled when the textarea is empty or whitespace-only (image-attached sends are ticket 003's concern — this ticket's Send-enablement rule is text-only)
- [x] Enter (no modifier held) submits the composer and prevents the default newline; Shift+Enter inserts a newline instead of submitting
- [x] On send: the current textarea text is appended to `messages` React state as a `{ role: "user", text }` entry (per ADR §6's `ChatMessage` shape, `id`/`role`/`text` populated; `imageCount`/`extractedFields` omitted for a text-only user message), the textarea clears, a loading indicator (`role="status"`, e.g. "Extracting...") appears in the thread, and a request is `POST`ed to `PROXY_URL` whose `messages` field contains **the full prior history plus the new user message**, mapped to `{ role, content }` pairs in order, and whose `system` field is the existing text `SYSTEM_PROMPT`
- [x] On a successful response, the client attempts to parse `content[0].text` as the 5-field extraction JSON, reusing the existing fence-stripping parse logic (the `` ```json ``-fence-stripping regex already present in `sendExtraction`) — this is not reimplemented, only relocated/reused
- [x] An assistant `ChatMessage` is appended to `messages` with `text` set to the raw response and `extractedFields` set (mapped to `SongFormInitialValues`: `title`, `artist`, `capo`, `content` from `tabContent`, `notes`) only when parsing succeeds **and** `tabContent` is a non-empty string
- [x] When `extractedFields` is present on an assistant message, the thread renders it as a **result card**: the extracted `title`, `artist`, `capo`, and `notes` are visibly displayed for review (a preview of `tabContent`/`content` is acceptable rather than the full text), with a "Use this result" button; clicking it calls `onExtracted(message.extractedFields)` — unchanged from the existing callback contract `AddPageClient` already handles
- [x] When parsing fails (malformed JSON, conversational text), the assistant message renders as **plain chat text** (the raw response), with no result card and no "Use this result" button
- [x] When parsing succeeds but `tabContent` is missing or an empty string, the message does **not** render as an actionable result card; it visibly notes "No tab content found" (or equivalent) per ADR §7, without a "Use this result" affordance
- [x] **Multi-turn history round-trips correctly:** sending a second message after one exchange results in the second request's `messages` array containing, in order, the first user message, the first assistant response's raw `text` (not re-serialized/re-parsed JSON), and the new user message
- [x] Errors render as an in-thread message (not a separate panel below/outside the chat thread): proxy unreachable, non-OK HTTP status, and invalid-JSON-that-still-needs-a-fallback-message each preserve their existing user-facing strings verbatim from the current implementation
- [x] A retry affordance re-sends the most recent user message (equivalent in effect to the current `canRetry`/`retryRef` pattern) without requiring the user to retype it
- [x] "Use manual entry" remains available (e.g. as a persistent link/button near the composer) and calls `onUseManual()` unchanged
- [x] Chat state (`messages`) is **not** cleared when `onExtracted` fires — per ADR §6, if the user later returns via `AddPageClient`'s existing "Back to Import" button (`handleBackToImport`, which only resets `extractedFields`, not the `ImportForm` component itself — `ImportForm` is never unmounted by that action), the thread still shows the full prior conversation
- [x] URL mode is fully removed: no URL `<input>`, no `URL:`-prefixed message construction, no 502-specific `ERROR_URL_FETCH` handling remains reachable from this component (the proxy's URL branch and `url-import.ts` are untouched and simply unreachable, per ADR §2)
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] `src/components/ImportForm.test.tsx` is rewritten (the existing Paste Text/URL/Image-toggle-specific tests are removed, not adapted — Image-specific tests return in chat-import/003) to cover:
  - [x] Enter submits; Shift+Enter inserts a newline and does not submit
  - [x] Send is disabled while the textarea is empty/whitespace-only, enabled once non-whitespace text is entered
  - [x] A single-turn send producing a valid extraction renders a result card, and clicking "Use this result" calls `onExtracted` with the correctly mapped fields
  - [x] A response that fails JSON parsing renders as plain text with no result card / no "Use this result" button
  - [x] A response with empty `tabContent` renders without a "Use this result" affordance and with a "No tab content found"-style note
  - [x] A two-turn conversation: the second `fetch` call's request body `messages` includes the first user message and the first assistant's raw text, followed by the new user message, in order
  - [x] Proxy-unreachable (`fetch` throws), non-OK HTTP, and invalid-JSON responses each render as an in-thread message with the existing error strings
  - [x] Retry re-sends the last user message without requiring re-entry
  - [x] `onUseManual` fires when the manual-entry control is activated
- [x] `pnpm test` passes, including the rewritten `ImportForm.test.tsx` and the unmodified `AddPageClient.test.tsx` (image-attachment and multi-image request-shape tests are ticket 003's scope and are not expected here)
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Image attachment of any kind (file picker, drag-and-drop, clipboard paste, thumbnails, per-image normalization, 10-image cap, default "Transcribe the attached sheet(s)." substitution) — chat-import/003
- The proxy's `images` array field and backward-compat shim — chat-import/001 (this ticket's requests never populate `image`/`images`)
- System-prompt selection based on message content type (text vs. image) — this ticket only ever sends the existing text `SYSTEM_PROMPT`; the `IMAGE_SYSTEM_PROMPT` branching arrives in chat-import/003
- Any change to `scripts/ai-proxy.ts`, `scripts/image-import.ts`, `AddPageClient.tsx`, or `SongForm.tsx`
- Streaming responses (ADR "Alternative 3", explicitly rejected)
- Persisting chat history beyond the component's in-memory lifetime (no `localStorage`, no server-side session, no session IDs)
- Removing `scripts/url-import.ts` or its proxy branch — retained as dead code per ADR §2/§9

## Notes

**This is the largest ticket in the feature.** The ADR itself calls the `ImportForm` rewrite "the largest single-component change in the project's history." If, in practice, the composer/message-rendering shell and the send/receive/result-card wiring prove too large for one plan-mode session, the natural split point is those two halves — but they are scoped as one ticket here because the shell has no independent value without the send flow and vice versa, and splitting them risks an intermediate, un-mergeable state.

**Reuse, don't reinvent, the existing parse tail.** The fence-stripping JSON parse and the `title`/`artist`/`capo`/`tabContent`→`content`/`notes` mapping into `SongFormInitialValues` are unchanged by this ADR — only *where* the result is displayed changes (result card vs. silent auto-forward). Carry that logic over rather than rewriting it from scratch.

**Auto-expanding textarea needs no new dependency.** A `useEffect` that resets `textarea.style.height = "auto"` then sets it to `scrollHeight` (capped at a max height) is consistent with the project's zero-new-dependency posture (mirrors ai-import/007's canvas-only normalization, no library added).

**Enter-vs-paste conflict (ADR §"Negative" consequences).** Detect multi-line paste events into the textarea and do not treat them as a submit trigger — only an actual keyboard Enter keydown (not a paste that happens to contain a newline) should submit.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
