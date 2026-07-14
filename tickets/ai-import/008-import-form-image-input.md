# Ticket: ImportForm — Image Input Mode

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** L
**Related:** ADR-0009 (Sections 1-2 "Scope", "Three inputs, one code path", 4 "Proxy request/response shape", 6 "Error handling"), ai-import/002, ai-import/005, ai-import/006, ai-import/007

## Context

Tickets 002 and 005 built `ImportForm`'s Paste Text and URL modes on a shared shape: an `InputMethod` toggle, a per-mode input, a shared `runExtraction`/`handleExtract` request-and-parse flow, and a shared set of error states with "Try again" / "Use manual entry" recovery. ADR-0009 adds a third mode, **Image**, on the same `InputMethod` union (`"paste" | "url"` → `"paste" | "url" | "image"`) and the same toggle row (`[ Paste Text ] [ URL ] [ Image ]`), reusing the identical response-parsing and `onExtracted` callback tail — only the request body differs by mode (ADR §1: "only the request body differs by mode; the response envelope and everything after `onExtracted` are identical").

Image mode is distinctive in how its input arrives: a `File`/`Blob` can come from a file picker, a drag-and-drop, or a clipboard paste (Cmd+V), and ADR-0009 §2 requires all three to converge on one handler (`handleImageSelected`) before validation and normalization run, so that logic exists exactly once. ai-import/007 already provides that validation/normalization/encoding as a standalone module (`src/lib/image-normalize.ts`: `validateImageInput`, `normalizeImageToJpeg`, `blobToBase64`); this ticket is the UI and request-wiring layer that calls it. ai-import/006 already provides the proxy-side contract this ticket's request must match (`instrument` + `image: { mediaType, data }` fields, response envelope unchanged).

Per ADR-0009 §1, Image mode is available for both guitar and piano — `ImportForm` needs to know which instrument is active so it can forward it. `ImportForm` does not currently receive an `instrument` prop; `AddPageClient` already receives `instrument` (from the page) and forwards it to `SongForm`, but not to `ImportForm`. This ticket adds that one line of prop-threading in `AddPageClient` alongside adding the prop to `ImportForm` itself — a small, necessary addition the ADR's file-change table (§8) folds into "no change" for `AddPageClient` because it does not change that component's own logic, only what it passes to a child it already renders.

This ticket depends on **both** ai-import/006 (proxy contract: what a well-formed image request must look like and what it returns) and ai-import/007 (the normalization module this ticket calls). It can be planned and implemented against those tickets' documented contracts in parallel with their implementation, but end-to-end manual verification requires both to be merged.

## Goal

Add an Image sub-mode to `ImportForm`: a third toggle pill, a dropzone accepting file-picker selection, drag-and-drop, and clipboard paste (scoped so it never intercepts the Paste Text textarea), client-side normalization via ai-import/007's module, and a request that forwards `instrument` and the normalized `image` field through the existing shared parse/`onExtracted` flow.

## Acceptance Criteria

- [x] `ImportForm`'s `InputMethod` type becomes `"paste" | "url" | "image"`; the toggle row renders a third pill labeled "Image" using the existing `METHOD_TOGGLE_BASE`/`METHOD_TOGGLE_ACTIVE`/`METHOD_TOGGLE_INACTIVE` classes, consistent with the "Paste Text" and "URL" pills
- [x] `ImportForm` accepts a new optional prop `instrument?: "guitar" | "piano"` (default `"guitar"` when omitted or any other value); `AddPageClient` is updated to pass `instrument={instrument}` into its existing `<ImportForm ... />` render (its only change in this ticket)
- [x] Switching to "Image" mode hides the textarea and URL input (neither paste nor URL mode is rendered) and shows an Image mode UI: a dropzone area with an embedded, visually-hidden `<input type="file" accept="image/png,image/jpeg,image/webp">` triggerable by clicking the dropzone, and a visible hint that clipboard paste (Cmd+V) also works
- [x] Switching input method clears any currently displayed error message (unchanged behavior from ticket 005, now also true when switching to/from "image")
- [x] The shared "Extract" button from paste/URL mode is not rendered while in Image mode — image selection itself triggers extraction (no separate manual "Extract" click step), matching the ADR §1 flow diagram (`image (picker | drop | Cmd+V) -> normalize -> base64 -> POST`)
- [x] **File picker.** Selecting a file via the hidden input's `onChange` passes `e.target.files[0]` into `handleImageSelected`
- [x] **Drag-and-drop.** The dropzone's `onDragOver` calls `preventDefault()` (and applies a visual "active" state); `onDrop` calls `preventDefault()` and passes `e.dataTransfer.files[0]` into `handleImageSelected`
- [x] **Clipboard paste.** A `paste` listener is attached (e.g. via a `useEffect` on `window`, or on the dropzone element) **only while `method === "image"`**, and removed on cleanup/mode change so it never intercepts a Cmd+V into the Paste Text textarea:
  - [x] When `e.clipboardData.items` contains an item whose `type` starts with `image/`, calls `item.getAsFile()` and passes the resulting `Blob` into `handleImageSelected`
  - [x] When no such item exists (e.g. the user pasted plain text while in Image mode), the paste is ignored and a non-blocking hint is shown: "Paste an image, or use the file picker." — this is not an error state (no "Try again" / "Use manual entry" buttons)
  - [x] A paste event while in "paste" or "url" mode is not intercepted by this listener at all (the textarea's native paste behavior is unaffected)
- [x] `handleImageSelected(source: File | Blob)` is the single convergence point for all three inputs:
  - [x] Calls `validateImageInput` (ai-import/007) first; if it returns a message, shows that message as an inline error naming the accepted formats and/or size cap (per ADR §6), does **not** proceed to normalize/send, and leaves the dropzone/file input available to try a different file (no "Try again" button needed since nothing was sent — "Use manual entry" is still offered)
  - [x] On a valid file, calls `normalizeImageToJpeg` then `blobToBase64` (ai-import/007), sets the loading state (same `role="status"` indicator and disabled affordances as paste/URL mode), and sends the extraction request
  - [x] If `normalizeImageToJpeg` rejects (the browser could not decode the image, e.g. an undecodable file silently accepted by the file picker's `accept` filter), shows an inline error consistent with "Claude cannot read the image" guidance (ADR §6) plus "Use manual entry"
- [x] **"Still too large after downscale."** If the base64-encoded payload built from the first normalization pass exceeds a defined cap (document the chosen cap, e.g. derived from `MAX_UPLOAD_BYTES` accounting for base64 inflation), the component re-normalizes once more at a smaller target (e.g. a smaller `maxEdge` passed to a second `normalizeImageToJpeg` call, or an equivalent one-shot retry); if it is still over the cap after that single retry, shows a size-guidance error (ADR §6) instead of sending, with "Use manual entry" offered
- [x] The image extraction request is `POST` to the existing `PROXY_URL` with body `{ messages: [{ role: "user", content: "Transcribe the attached sheet." }], system: IMAGE_SYSTEM_PROMPT, model: "claude-sonnet-4-5", instrument, image: { mediaType: "image/jpeg", data: <base64> } }`, where `IMAGE_SYSTEM_PROMPT` is a new constant in `ImportForm.tsx` distinct from the existing Paste/URL `SYSTEM_PROMPT` (see Notes) and `instrument` is the active `instrument` prop
- [x] The response-handling tail (parse `content[0].text` as JSON, map to `SongFormInitialValues` via the existing `tabContent` → `content` mapping, call `onExtracted`) is reused via the same shared code path already used by paste and URL mode — not duplicated for image mode
- [x] All existing shared error states (proxy unreachable, HTTP `502`, generic non-OK HTTP, invalid JSON, empty `tabContent`) behave identically when triggered from an image-mode request, via the same shared request/error-handling logic already exercised by ticket 005's tests
- [x] "Try again" in an error state raised from image mode retries with the **same already-normalized base64 image** (it does not re-open the file picker or require the user to reselect/re-paste)
- [x] All acceptance criteria and tests from tickets 002 and 005 continue to pass unmodified — default mode remains "Paste Text", and paste/URL request shapes and error strings are unaffected
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] Tests added to `src/components/ImportForm.test.tsx` (and a new `AddPageClient.test.tsx` case) cover, using `vi.stubGlobal`/mocks for `fetch` (existing pattern) plus mocked `src/lib/image-normalize` functions (`vi.mock("@/lib/image-normalize", ...)` so canvas/File internals from ai-import/007 do not need to be re-stubbed here):
  - [x] Switching to "Image" mode hides the textarea/URL input and shows the dropzone; no "Extract" button is rendered in Image mode
  - [x] Selecting a file via the hidden file input's `onChange` triggers `handleImageSelected` → the mocked `validateImageInput`/`normalizeImageToJpeg`/`blobToBase64` are called → a request is sent whose body's `image.mediaType` is `"image/jpeg"`, `image.data` matches the mocked base64 output, and `instrument` matches the `instrument` prop passed to `ImportForm`
  - [x] Simulating `dragOver` then `drop` with `dataTransfer.files` on the dropzone triggers the same flow as the file picker (asserted via the same request-body expectations)
  - [x] Simulating a `paste` event with `clipboardData.items` containing an `image/png` item (with a `getAsFile` mock) while in Image mode triggers the same flow
  - [x] Simulating a `paste` event with only `text/plain` clipboard items while in Image mode shows the non-blocking hint and does **not** send a request
  - [x] Simulating a `paste` event while in "paste" (Paste Text) mode does not invoke `handleImageSelected` or send an image request
  - [x] `validateImageInput` mocked to return an error string: the error is shown inline, no request is sent, and a "Use manual entry" button is present
  - [x] Successful image extraction: `onExtracted` is called with correctly mapped fields (mirroring ticket 002's mapping assertions)
  - [x] An HTTP-error response triggered from image mode shows the same generic error message as paste/URL mode (regression assertion that the shared error path is reused)
  - [x] `AddPageClient.test.tsx` gains a case asserting the mocked `ImportForm` receives an `instrument` prop matching the `instrument` passed into `AddPageClient`
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The pure normalization/validation logic itself (`computeDownscaledDimensions`, `isAcceptedImageType`, `validateImageInput`, `blobToBase64`, `normalizeImageToJpeg`) — that is ai-import/007, a hard dependency of this ticket; this ticket imports and calls it, mocking it at the module boundary in its own tests
- The proxy-side `image`/`instrument` handling, temp-file lifecycle, and instrument-aware `-p` prompt — that is ai-import/006, a hard dependency of this ticket for real end-to-end behavior (this ticket's own tests mock `fetch`, so it does not need ai-import/006 merged to be developed and tested in isolation)
- Widening the AI-import gate to piano on `/piano/add` — that is ai-import/009; this ticket's `instrument` prop threading works correctly regardless of which routes reach `AddPageClient`, but piano users cannot reach this UI at all until ai-import/009 lands
- Any change to `SongForm.tsx`, `src/app/actions.ts`, `src/db/schema.ts`, or `src/db/queries.ts`
- HEIC-specific test fixtures — ADR-0009 §3.2 covers this via generic canvas re-encoding, exercised at the ai-import/007 level, not here
- Camera capture (`<input type="file" capture>`) — not requested by the ADR; file picker, drag-and-drop, and clipboard paste are the three required inputs
- Persisting the selected input method across page reloads or navigation
- Retry with exponential backoff or request cancellation (unchanged scope from tickets 002/005)

## Notes

**`IMAGE_SYSTEM_PROMPT` is a new, separate constant** from the existing Paste/URL `SYSTEM_PROMPT` — per ADR-0009 §5, the proxy's instrument-specific *target-notation* instruction (tab text vs. ABC) is embedded proxy-side in the `-p` prompt (ai-import/006's `buildImagePrompt`), not in the system prompt sent from the client. `IMAGE_SYSTEM_PROMPT` therefore only needs to carry the *shared field-discipline* instructions the ADR mentions in §5: respond with ONLY a JSON object containing the same five fields as before (`title`, `artist`, `capo`, `tabContent`, `notes`), be resilient to skew/lighting/partial legibility, no markdown fences, no commentary. Do not encode guitar-vs-piano output format in this constant — that is the proxy's job.

**Do not send `instrument` from Paste Text or URL mode.** ADR-0009 §4 shows the Paste Text and URL request bodies unchanged ("Compare with the current modes, which are unchanged on the wire") — only Image mode requests include `instrument`. Do not add it to the other two modes' request bodies as part of this ticket, even though `ImportForm` now knows the active instrument.

**Refactor, don't duplicate.** Ticket 005 already refactored `handleExtract` into a shared `runExtraction(content: string)`. Image mode's request body is shaped differently (it needs `instrument` and `image`, not a single `content` string), so `runExtraction` likely needs to become parameterized over the full request-body shape (or gain a sibling that takes a pre-built body) while keeping one shared response-parsing/error-handling tail. Whichever shape is chosen, the parse/error/`onExtracted` logic must not be copy-pasted a third time.

**Mocking ai-import/007 at the module boundary.** `ImportForm.test.tsx` should `vi.mock("@/lib/image-normalize")` (or the actual relative import path used) rather than stub `createImageBitmap`/canvas internals a second time — that stubbing already lives in ai-import/007's own test file. This keeps this ticket's tests focused on UI wiring and request shape, not re-testing normalization math.

**Payload-size retry cap.** Document whatever concrete number is chosen for "still too large after downscale" (ADR §6) in the implementation — e.g. re-normalize at `maxEdge: 1200` and/or a lower JPEG quality if the first pass's base64 length still exceeds a chosen threshold. The exact numbers are an implementation detail; the requirement is a single retry, then a size-guidance error, never an infinite loop.

## Implementation Plan

1. **Refactor the shared tail.** Turn `runExtraction(content)` into `sendExtraction(body)` taking a full request-body object; `handleExtract` builds the paste/URL body (`messages`/`system`/`model`, no `instrument`) and calls it. The parse/error/`onExtracted` tail stays in `sendExtraction`, unduplicated.
2. **Widen the mode.** `InputMethod` → `"paste" | "url" | "image"`; add a third "Image" pill; add optional `instrument?: "guitar" | "piano"` prop (resolved to `"guitar"` for any non-`"piano"` value).
3. **Image UI.** In image mode render a clickable dropzone (drag-over active state, `onDrop`) wrapping a visually-hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`, a paste hint, and no Extract button.
4. **Convergence point.** `handleImageSelected(source)` → `validateImageInput` guard → `normalizeImageToJpeg` → `blobToBase64` → build the image body (`instrument` + `image:{mediaType,data}`, `IMAGE_SYSTEM_PROMPT`) → `sendExtraction`. Decode-failure and too-large errors offer only "Use manual entry"; a sent-request error offers "Try again" that re-sends the same normalized body.
5. **Payload cap + one-shot retry.** Cap the base64 length at `MAX_IMAGE_BASE64_LENGTH` (derived from `MAX_UPLOAD_BYTES` × 4/3 base64 inflation); one re-normalize pass, then a size-guidance error.
6. **Clipboard paste.** A `window` `paste` listener mounted only while `method === "image"` (via `useEffect` + a ref to the latest `handleImageSelected`); image item → `handleImageSelected`, non-image → non-blocking hint.
7. **Thread the prop.** `AddPageClient` narrows its `instrument` prop to `"guitar" | "piano"` and passes `instrument={instrument}` into `<ImportForm />`.
8. **Tests.** Extend `ImportForm.test.tsx` (mock `@/lib/image-normalize`) and add an `AddPageClient.test.tsx` case; run tests, lint, build.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
