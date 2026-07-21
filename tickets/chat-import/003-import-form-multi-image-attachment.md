# Ticket: ImportForm — Multi-Image Attachment and Proxy Wiring

**Feature:** chat-import
**Status:** Done
**Priority:** P1
**Estimate:** L
**Related:** ADR-0010 (Sections 1 "Image attachment" and "Sending", 3-5 "Multi-image proxy contract, proxy-side handling, system prompt selection", 6 "Client-side state shape", 7 "Error handling"), chat-import/001 (proxy `images` array contract this ticket's requests populate), chat-import/002 (chat thread/composer this ticket attaches images onto), ai-import/007 (`image-normalize.ts`, reused unchanged), ai-import/008 (established the file-picker/drag-drop/paste convergence pattern and per-image size-retry guard this ticket extends to multiple images)

## Context

chat-import/002 builds the chat thread and multi-turn text-only flow. This ticket adds the second half of ADR-0010's composer: multi-image attachment (file picker, drag-and-drop, clipboard paste — up to 10 images per message), per-image normalization via the existing `image-normalize.ts` module (ai-import/007, called once per image in a loop, no change to that module), and the request-assembly changes needed to populate the proxy's `images` array field (chat-import/001). It also implements ADR §5's system-prompt-selection rule (any images attached → `IMAGE_SYSTEM_PROMPT`, regardless of accompanying text; text-only → `SYSTEM_PROMPT`) and the "default message when only images are attached" convenience (ADR §1: substitute `"Transcribe the attached sheet(s)."` when the textarea is empty and at least one image is attached at send time).

ai-import/008 already solved the single-image version of file-picker/drag-drop/paste convergence (`handleImageSelected`) and the "still too large after downscale" one-shot retry guard (`MAX_IMAGE_BASE64_LENGTH`). This ticket extends that pattern from "replace the one pending image" to "append to a list, up to 10, each independently normalized and independently guarded against the size cap."

## Goal

Add multi-image attachment (picker/drag-drop/paste, removable thumbnails, per-image normalization, 10-image soft cap) to the composer bar built in chat-import/002, and wire attached images into the `images` array field of the extraction request with per-turn system-prompt selection.

## Acceptance Criteria

- [x] The composer bar gains an attachment control (`<input type="file" multiple accept="image/png,image/jpeg,image/webp">`, visually hidden, triggered by a visible button) that appends selected files to `attachedImages: File[]` component state; selecting files accumulates onto any images already attached (does not replace them), up to the cap below
- [x] Attached images render as removable thumbnails in a row above the composer textarea; each thumbnail has a visible "remove" control that removes only that one image from `attachedImages`, leaving other attachments and the typed text untouched
- [x] Drag-and-drop onto the chat/composer area (`onDragOver` with `preventDefault()`, `onDrop` with `preventDefault()`) appends dropped image files to `attachedImages` the same way as the file picker; non-image files present in the same drop are ignored, not queued or errored
- [x] Clipboard paste (Cmd+V) anywhere in `ImportForm` while composing appends pasted image items (`clipboardData.items` entries whose `type` starts with `image/`) to `attachedImages`; a paste containing no image items is not intercepted and falls through to the textarea's native text-paste behavior unaffected
- [x] A **soft cap of 10 images per message**: once `attachedImages.length === 10`, the attachment button, drop handler, and paste handler stop accepting additional images and surface the message `"Maximum 10 images per message."` instead of silently dropping the extra image(s) or throwing; already-attached images remain visible and removable, and dropping below 10 (by removing one) re-enables attachment
- [x] Send is enabled when the textarea has non-whitespace text **or** at least one image is attached (supersedes chat-import/002's text-only enablement rule; a send with images and no text is now valid)
- [x] If the textarea is empty/whitespace-only **and** at least one image is attached at send time, the client substitutes `"Transcribe the attached sheet(s)."` as that turn's user text — both in the `ChatMessage` appended to the thread and in the outgoing request's `messages` entry for that turn (ADR §1)
- [x] On send, each attached image is normalized via the existing `normalizeImageToJpeg` then `blobToBase64` (ai-import/007, imported unchanged) in a loop; the request body's `images` field (chat-import/001's contract) is the resulting array of `{ mediaType: "image/jpeg", data }` objects in attachment order — this client never populates the legacy singular `image` field
- [x] Each image in the loop reuses ai-import/008's one-shot size-retry guard independently (normalize → check base64 length against the existing `MAX_IMAGE_BASE64_LENGTH` cap → one re-normalize retry if over → give up on that image if still over): if any single image is still too large after its own retry, the send does not proceed with a partial/mismatched image set — an inline error in the composer area names the oversized image, offers its removal, and the user can retry send once it is removed or replaced
- [x] If `normalizeImageToJpeg` rejects for any attached image (undecodable file), an inline error appears in the composer area (not the chat thread) naming the problematic image; that image remains attached and removable so the user can remove it and retry send without re-attaching the other images
- [x] The outgoing request's `system` field is `IMAGE_SYSTEM_PROMPT` whenever the current turn has one or more images attached (regardless of accompanying text), and `SYSTEM_PROMPT` (chat-import/002's text-only prompt) whenever it has none — selected fresh per turn, so a text-only follow-up after an earlier image-containing turn correctly uses the text prompt (ADR §5)
- [x] The user `ChatMessage` appended for a turn with images sets `imageCount` to the number of images sent in that turn (per ADR §6's `ChatMessage` shape), and the thread visibly distinguishes that turn from a text-only turn (thumbnails, a count badge, or equivalent — exact treatment is an implementation choice)
- [x] After a send completes (successfully or with an error), `attachedImages` is cleared for the next turn — images are not automatically re-attached to subsequent turns (ADR §4: "Images attach to the current turn only")
- [x] The `instrument` prop (already threaded from `AddPageClient` in ai-import/008/009) continues to be forwarded on every request, image-bearing or text-only, unchanged
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] `src/components/ImportForm.test.tsx` gains coverage (mocking `@/lib/image-normalize` per ai-import/008's established `vi.mock` pattern) for:
  - [x] File-picker multi-select appends multiple files to `attachedImages`, rendered as that many thumbnails
  - [x] Removing one thumbnail removes only that image, leaving others and the typed text intact
  - [x] Drag-and-drop of multiple image files appends them the same way as the file picker; a non-image file in the same drop is not queued
  - [x] A paste event with an `image/*` clipboard item appends an image; a text-only paste is not intercepted
  - [x] Attaching an 11th image is blocked with the cap message once 10 are already attached; removing one re-enables attachment
  - [x] Send is enabled with images attached and no text
  - [x] Sending with no text and at least one image substitutes `"Transcribe the attached sheet(s)."` in both the rendered user message and the outgoing request body's corresponding `messages` entry
  - [x] A send with N attached images produces a request body whose `images` array has N entries matching the mocked normalized/base64 output for each, in attachment order
  - [x] A conversation with an image-bearing turn followed by a text-only turn: the first request's `system` is `IMAGE_SYSTEM_PROMPT`, the second request's `system` is `SYSTEM_PROMPT`
  - [x] A normalization failure (mocked `normalizeImageToJpeg` rejection) for one attached image surfaces an inline composer error naming that image and does not send a request
  - [x] An oversized image that remains over `MAX_IMAGE_BASE64_LENGTH` after the one-shot retry surfaces a size-guidance error for that image without sending
  - [x] `attachedImages` is empty after a send completes, whether successful or errored
- [x] `pnpm test` passes, including every test carried over from chat-import/002 (no regression to text-only single-turn or multi-turn behavior)
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `src/lib/image-normalize.ts` — reused exactly as ai-import/007 built it
- Any change to `scripts/ai-proxy.ts`'s or `scripts/image-import.ts`'s `images` array handling beyond what chat-import/001 already implements — this ticket is a pure consumer of that documented contract
- The legacy singular `image` field — this ticket's client never sends it (chat-import/001's backward-compat shim exists for other/future callers, not exercised by this UI)
- Camera capture (`<input type="file" capture>`) — not requested by the ADR
- Reordering attached images before send
- Any change to `AddPageClient.tsx` or `SongForm.tsx`

## Notes

**Hard dependency on chat-import/002; contract-level dependency on chat-import/001.** This ticket's diff applies onto the composer/message model chat-import/002 builds, so that ticket must land first (or at minimum be planned/merged before this one starts implementation). chat-import/001's `images` array contract is documented precisely enough (ADR §3) to mock in this ticket's own tests without 001 being merged first — mirroring ai-import/008's relationship to ai-import/006 — but real end-to-end manual verification requires both merged.

**Reuse ai-import/008's size-retry guard, per image.** `MAX_IMAGE_BASE64_LENGTH` and the one-shot re-normalize-then-give-up pattern already exist in the current `ImportForm.tsx` for the single-image case; apply the same guard independently to each image in the multi-image loop rather than reinventing it, and flag/name the specific oversized image in the error rather than failing the whole batch silently.

**Convergence point, extended.** ai-import/008's `handleImageSelected(source: File | Blob)` is the natural starting point; extend it (or a renamed sibling) from "set the one pending image" to "append to `attachedImages`, respecting the 10-item cap," while keeping file-picker/drag-drop/paste all funneling through the same function so the cap and per-image error handling live in exactly one place.

## Implementation Plan

1. **Restore image-normalize wiring.** Re-import `normalizeImageToJpeg`, `blobToBase64`, and `MAX_UPLOAD_BYTES` (chat-import/002 had dropped them); re-add `IMAGE_SYSTEM_PROMPT`, `MAX_IMAGE_BASE64_LENGTH`, `DEFAULT_IMAGE_MESSAGE`, `MAX_IMAGES`, and the cap message as module constants. Restore forwarding of the `instrument` prop (`resolvedInstrument`).
2. **State + convergence point.** Add `attachedImages` (`{ id, file, url }[]` wrapping ADR §6's `File[]` with a stable key and object-URL preview) and a composer-area `composerError`, distinct from the in-thread `error`. Funnel file-picker, drag-drop, and clipboard-paste through one `addImages(File[])` that filters non-images, enforces the 10-image cap (surfacing the cap message rather than silently dropping), and creates previews. `removeImage(id)` revokes its URL and clears the cap error.
3. **Per-image normalization on send.** `normalizeOne(file)` reuses ai-import/008's one-shot size-retry guard independently per image, returning either the `{ mediaType, data }` wire object or an image-specific error. `handleSend` normalizes each attached image in order; any failure sets `composerError` (naming the image) and aborts without sending, keeping all attachments.
4. **Request assembly.** On a real send, substitute `DEFAULT_IMAGE_MESSAGE` when the textarea is empty and images are attached, append the user `ChatMessage` with `imageCount`, clear `attachedImages` (revoking URLs), and post `images` + per-turn `system` (`IMAGE_SYSTEM_PROMPT` when the turn has images, else `SYSTEM_PROMPT`) + `instrument`. Retry re-sends the identical turn.
5. **Render.** Removable thumbnail row above the composer, an attachment button + hidden multi-select file input, composer-error line, image-count badge on image-bearing user turns, and a drag-highlight on the thread.
6. **Tests + gates.** Extend `ImportForm.test.tsx` (mocking `@/lib/image-normalize`, stubbing object URLs) for every §"Acceptance Criteria" test bullet; keep all chat-import/002 tests green. `pnpm build`, `pnpm lint`, `pnpm test` all pass.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
