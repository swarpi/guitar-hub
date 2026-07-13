# Ticket: Client-Side Image Normalization Module

**Feature:** ai-import
**Status:** Todo
**Priority:** P1
**Estimate:** M
**Related:** ADR-0009 (Section 3 "Client-side normalization (format + size in one step)", Section 6 "Error handling")

## Context

ADR-0009 §3 requires every image handed to Image mode — regardless of whether it came from the file picker, drag-and-drop, or clipboard paste — to be drawn onto a `<canvas>` and re-encoded as JPEG before it leaves the browser. This single step solves three problems at once: downscaling large photos (longest edge ≤ ~1600px, `toBlob('image/jpeg', 0.8)`), normalizing odd formats (HEIC, WebP, PNG) to one format `claude -p` reliably ingests, and rejecting non-image or oversized inputs early with a clear message. No new dependency is used — `<canvas>`, `toBlob`, and `createImageBitmap` are all built-in.

This ticket extracts that normalization logic into a standalone, browser-API-light module so it has its own focused test file, separate from the UI wiring in `ImportForm.tsx` (ai-import/008, which consumes it). This mirrors the project's existing convention of separating pure/testable logic from its orchestrating component or HTTP handler (`scripts/url-import.ts` for ai-import/004, `scripts/image-import.ts` for ai-import/006).

## Goal

Add `src/lib/image-normalize.ts`: pure geometry and validation helpers plus one canvas-based normalize/encode function that turns any accepted image `Blob`/`File` into a downscaled JPEG `Blob`, and a helper to base64-encode that blob for the wire.

## Acceptance Criteria

- [ ] `src/lib/image-normalize.ts` exports the following constants: `MAX_LONG_EDGE = 1600`, `JPEG_QUALITY = 0.8`, `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`, `ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]` (as a readonly array).
- [ ] `computeDownscaledDimensions(width: number, height: number, maxEdge?: number): { width: number; height: number }` — pure, no browser APIs:
  - [ ] When the longer of `width`/`height` is ≤ `maxEdge` (default `MAX_LONG_EDGE`), returns `{ width, height }` unchanged (never upscales)
  - [ ] When `width` is the longer edge and exceeds `maxEdge`, returns dimensions scaled down so `width === maxEdge`, with `height` scaled by the same ratio and rounded to the nearest integer
  - [ ] When `height` is the longer edge and exceeds `maxEdge`, scales symmetrically on `height`
  - [ ] A square image exactly at `maxEdge` is returned unchanged
- [ ] `isAcceptedImageType(mimeType: string): boolean` — pure. Returns `true` for each of `ACCEPTED_IMAGE_TYPES`, `false` for anything else (e.g. `"application/pdf"`, `"text/plain"`, `""`).
- [ ] `validateImageInput(file: Blob): string | null` — pure (reads only `file.type`/`file.size`, no I/O). Returns `null` when `file` is an accepted type and `file.size <= MAX_UPLOAD_BYTES`. Otherwise returns a non-empty, user-facing error string that names the accepted formats (PNG, JPEG, WebP) when the type is rejected, or the size cap when the file is too large. Type is checked before size when both are invalid.
- [ ] `blobToBase64(blob: Blob): Promise<string>` — resolves with the base64-encoded content of `blob`, with no `data:` URL prefix (strip it if the implementation uses `FileReader.readAsDataURL` internally).
- [ ] `normalizeImageToJpeg(source: Blob): Promise<Blob>` — decodes `source` (via `createImageBitmap` or an equivalent browser API), computes target dimensions via `computeDownscaledDimensions` from the decoded image's natural width/height, draws it onto an in-memory `<canvas>` sized to those target dimensions, and resolves with the result of `canvas.toBlob("image/jpeg", JPEG_QUALITY)` as a `Promise<Blob>`. The resolved blob's `type` is `"image/jpeg"`.
- [ ] `pnpm build` compiles without errors
- [ ] `pnpm lint` passes on all changed files
- [ ] Tests in `src/lib/image-normalize.test.ts` (`// @vitest-environment jsdom`) cover:
  - [ ] `computeDownscaledDimensions`: landscape image over the cap scales down preserving aspect ratio; portrait image over the cap scales down by height; an image already under the cap is returned unchanged; a square image exactly at the cap is unchanged
  - [ ] `isAcceptedImageType`: true for `image/png`, `image/jpeg`, `image/webp`; false for `application/pdf`, `text/plain`, empty string
  - [ ] `validateImageInput`: `null` for an accepted type under the size cap; an error message naming the accepted formats for a rejected type; an error message naming the size cap for an oversized accepted-type file; type-rejection message takes precedence when both are invalid
  - [ ] `blobToBase64`: encodes a small known `Blob` (e.g. `new Blob(["hi"], { type: "text/plain" })`) to the expected base64 string (`"aGk="`) with no `data:` prefix
  - [ ] `normalizeImageToJpeg`: with `global.createImageBitmap` stubbed (`vi.stubGlobal`) to resolve a fake bitmap of known width/height, and `HTMLCanvasElement.prototype.getContext`/`toBlob` stubbed to a fake 2D context (`drawImage` spy) and a synchronous callback invocation respectively — asserts the canvas is sized to the value `computeDownscaledDimensions` would return for the fake bitmap's dimensions, `drawImage` is called with the bitmap, and `toBlob` is called with `("image/jpeg", JPEG_QUALITY)`; the function resolves with the `Blob` the stub handed to the callback
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any UI — the toggle pill, dropzone, file input, and clipboard-paste listener are ai-import/008, which imports and calls this module
- HEIC-specific handling beyond "canvas re-encode normalizes whatever the browser can decode" (ADR-0009 §3.2) — no HEIC-specific test fixture is required; if a browser cannot decode a given input at all, that failure surfaces as a rejected `createImageBitmap`/`Image` promise, which ai-import/008 is responsible for catching and mapping to a user-facing error
- The "still too large after downscale, re-encode once at lower quality" retry behavior (ADR-0009 §6) — that retry orchestration lives in ai-import/008; this ticket's `normalizeImageToJpeg` performs one normalization pass at the fixed `JPEG_QUALITY`
- Sending anything over the network — this module has no `fetch` calls
- Any change to `scripts/ai-proxy.ts`, `scripts/image-import.ts` (ai-import/006), or `src/components/ImportForm.tsx` (ai-import/008)

## Notes

**No dependency added.** `createImageBitmap`, `<canvas>`, `toBlob`, and `FileReader` are all built into the browser; ADR-0009 §3.3 and its "Consequences" section explicitly call out zero new dependencies. jsdom does not implement real canvas pixel drawing or `createImageBitmap`, so `normalizeImageToJpeg`'s test stubs these browser APIs directly rather than pulling in a canvas polyfill (e.g. the `canvas` npm package) — consistent with the project's existing pattern of stubbing browser globals for jsdom tests (e.g. service worker mocks in the PWA feature tests).

**Independent of ai-import/006.** This ticket has no dependency on the proxy-side ticket — it is a pure client-side module with no network calls. It can be implemented in parallel with ai-import/006.

**Consumed by ai-import/008.** ai-import/008 calls `validateImageInput` as the pre-normalize guard (ADR-0009 §6 "Unsupported/oversized file"), then `normalizeImageToJpeg` and `blobToBase64` to build the `image.data` field of the proxy request. Keep the public function signatures exactly as specified above so ai-import/008 can be planned against them without re-deriving the contract.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
