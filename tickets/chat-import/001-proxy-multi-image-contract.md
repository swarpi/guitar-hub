# Ticket: Proxy — Multi-Image Array Contract and Handling

**Feature:** chat-import
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0010 (Sections 3 "Multi-image proxy contract", 4 "Proxy-side multi-image handling", 8 "What changes in existing code"), ai-import/006 (established `runImageExtraction` / single-image temp-file pattern this ticket extends)

## Context

ai-import/006 gave `scripts/image-import.ts` a `runImageExtraction` function scoped to exactly one image: write one temp file, build a one-path `-p` prompt, run `claude -p`, clean up one file. It has no awareness of conversation history — the single-image UI always sent exactly one fixed user message ("Transcribe the attached sheet.").

ADR-0010 replaces the proxy's singular `image` field with a plural `images` array (0-10 items) to support multi-panel screenshot stitching, and requires the proxy to thread the full multi-turn conversation history into the `-p` prompt (ADR §4.3), since the new chat UI (chat-import/002, chat-import/003) sends the entire message history on every request. It also requires a **backward-compat shim**: requests still carrying the legacy singular `image` field (no `images`) are wrapped into a one-element array internally, so nothing that already depends on ai-import/006's contract breaks.

Two bug fixes already on `master` touch this area and must be preserved: JSON fence-stripping (client-side `ImportForm.tsx`, not affected by this ticket) and `--add-dir tmpdir()` in the `claude -p` spawn args in `scripts/image-import.ts` (proxy-side — must remain in the args list this ticket modifies).

This ticket is proxy-only. It has no dependency on chat-import/002 or chat-import/003 and can be implemented and fully unit-tested (mocked `child_process`/`fs`) against the documented request shape before either client ticket lands, mirroring how ai-import/006 and ai-import/007 developed in parallel against ADR-0009's documented contract.

## Goal

Extend `scripts/image-import.ts`'s `runImageExtraction` and `scripts/ai-proxy.ts`'s request handling to accept a plural `images` array (with the legacy singular `image` field still accepted via a backward-compat shim), writing, prompting, and cleaning up all images for the current turn, with prior conversation history threaded into the `-p` prompt.

## Acceptance Criteria

- [x] `scripts/image-import.ts`'s request type gains `images?: Array<{ mediaType: string; data: string }>` alongside the existing `image?: { mediaType: string; data: string }`; when `images` is present it takes precedence, otherwise a present `image` is wrapped into a one-element array, otherwise (both absent) the function's behavior is unchanged from today (no images written) — matching ADR §3's "wraps it in a single-element array internally" shim
- [x] `writeTempImageFile` is called once per image in the resolved array; each call produces a distinct temp path (existing `guitarhub-import-<uuid>.<ext>` naming, one `uuid` per file), and all resolved paths are collected before the `claude -p` prompt is built
- [x] The `-p` prompt embeds **all** resolved image paths verbatim (e.g. as a comma-or-newline-separated list), remains instrument-aware (guitar tab/chord wording vs. piano ABC wording, unchanged branching from ai-import/006), and — when more than one image is present — instructs the model to treat the images as panels of a single piece to stitch together (ADR §4.2: "transcribe them as a single complete piece")
- [x] The single-image case (exactly one path in the resolved array, whether it arrived via `images: [one item]` or the legacy `image` shim) produces a prompt that still satisfies ai-import/006's existing prompt assertions (contains the path verbatim; guitar wording contains "tab"/"chord", no "ABC"; piano wording contains "ABC") — no regression to the wording those tests check
- [x] `runImageExtraction` accepts an optional `messages: Array<{ role: "user" | "assistant"; content: string }>` mirroring `ai-proxy.ts`'s `RequestBody.messages`:
  - [x] When `messages` is absent, or has length ≤ 1, the prompt is built exactly as ai-import/006 did today (the single current-turn text, if any, plus the image path reference(s)) — no regression to the legacy single-turn shape
  - [x] When `messages` has length > 1, all messages except the last are formatted as alternating `Human:`/`Assistant:` lines (matching `ai-proxy.ts`'s existing `buildPrompt` multi-message formatting) and prepended to the prompt; the last message's text (the current turn) plus the image path reference(s) for the *current* request's images follow
- [x] **Images attach to the current turn only** (ADR §4, "Images attach to the current turn only"): only the images present in the current request are written to temp files and referenced in the prompt; no mechanism re-writes or re-references images from a prior turn, even though prior turns' *text* is threaded in via `messages`
- [x] **Bulk cleanup.** On `close` (success or non-zero exit) and on spawn `error`, `cleanupTempImageFile` is called once per temp file written for the current request — every file, not just the first — before resolving; a failure to clean up any one file is caught/logged (existing `console.warn` behavior) and never prevents cleanup of the remaining files or crashes the request
- [x] `scripts/ai-proxy.ts`'s `RequestBody` interface gains `images?: Array<{ mediaType: string; data: string }>` alongside the existing `image?`
- [x] The existing image-branch dispatch (`if (data.image) { ... }`) becomes `if (data.image || data.images) { ... }` and forwards both `data.image` and `data.images` (plus `data.messages`, newly forwarded — previously this branch did not pass `data.messages` through at all) into `runImageExtraction`
- [x] Requests with neither `image` nor `images` are handled exactly as before — no change to the literal-prompt or URL branches
- [x] `pnpm test` passes, including new/updated tests in `scripts/image-import.test.ts` (extending the existing mocked-`child_process`/mocked-`fs/promises` pattern) covering:
  - [x] `images` array with 2-3 entries: `writeFile` is called once per entry with distinct paths; the assembled `-p` prompt contains every written path verbatim
  - [x] Legacy `image` singular field (no `images`): produces the same prompt/temp-file/cleanup behavior as an equivalent one-element `images` array (regression parity with ai-import/006's existing assertions)
  - [x] `messages` with more than one entry: the assembled prompt contains `Human:`/`Assistant:`-formatted prior turns, in order, before the current turn's text and image path reference(s)
  - [x] `messages` absent or length ≤ 1: prompt shape matches ai-import/006's pre-existing single-turn behavior exactly
  - [x] Multi-image success path: fake child closes with code `0`; `unlink` is called once per temp file written (bulk cleanup); response envelope unchanged (`status: 200`, `body.content[0].text` = trimmed stdout)
  - [x] Multi-image failure path (non-zero exit) and spawn-error path: `unlink` is still called once per temp file written (cleanup runs regardless of outcome)
  - [x] Instrument branching (guitar/piano wording) and `model`/`system` defaulting/passthrough continue to pass unmodified from ai-import/006's existing tests
- [x] `pnpm lint` passes on all changed files
- [x] `pnpm build` compiles without errors
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `src/components/ImportForm.tsx`, `AddPageClient.tsx`, or any other client code — that is chat-import/002 and chat-import/003, which consume this ticket's documented contract
- Server-side enforcement of the "maximum 10 images" cap — per ADR §7, the client disables further attachment at 10; this is local single-user dev tooling (the same posture ai-import/006 took on rate limiting/auth), so the proxy does not additionally reject an oversized `images` array
- Any change to `scripts/url-import.ts` or the URL-detection branch in `ai-proxy.ts` — both are unaffected and remain as dead-code-from-the-UI per ADR §2
- Automated end-to-end tests of the real HTTP handler or a real `claude` CLI invocation — per the convention established in ai-import/004/006, only the extracted pure/mockable functions in `scripts/image-import.ts` are unit tested; `ai-proxy.ts`'s handler wiring is manually verified
- Changing the response envelope shape — unchanged per ADR §3 ("Response (unchanged)")

## Notes

**Why `runImageExtraction` needs `messages` now, when ai-import/006 didn't need it.** ai-import/006's single-image UI always sent exactly one fixed message, so history threading was irrelevant. The new chat UI sends the full conversation on every turn (ADR §1.3 "Multi-turn"), and per ADR §4.3 that history must reach the `-p` prompt the same way the non-image branch's `buildPrompt` already does it for multi-message arrays. This ticket is what makes multi-turn *and* multi-image compose correctly — without it, chat-import/003's multi-turn image requests would silently lose all prior conversation context.

**Manual verification.** As with ai-import/006, verify by hand with `pnpm dev:ai` running: a `curl` request with a 2-3 item `images` array and a 3-message `messages` array (two prior turns + one current), confirming a `200` response, a prompt (visible in the proxy's console log) that includes both prior-turn text and all image paths, and that none of the temp files remain in `os.tmpdir()` afterward. Also verify a request using the legacy singular `image` field still succeeds unchanged. Document the result in the PR/commit message.

**Naming.** Whether the multi-path prompt builder is a modified `buildImagePrompt` (now taking `string[]` instead of `string`) or a new sibling function is an implementation choice — keep the existing single-path callers (if any remain, e.g. in tests) working by updating them consistently, don't maintain two divergent prompt builders.

## Implementation Plan

1. `scripts/image-import.ts`: widen `ImageExtractionRequest` with optional `images` array and `messages` history; resolve `images ?? [image]` (shim) in `runImageExtraction`
2. `buildImagePrompt` accepts `string | readonly string[]` (single builder, no divergence); >1 path adds the "single complete piece" stitching instruction
3. New `buildExtractionPrompt(paths, instrument, messages)` composes: prior turns as `Human:`/`Assistant:` lines → current turn text → image instruction; reduces to the ai-import/006 shape with no messages
4. Write one temp file per resolved image; `cleanupAll()` loops `cleanupTempImageFile` over every written path on close (any exit code) and on spawn error
5. `scripts/ai-proxy.ts`: `RequestBody.images` added; dispatch on `data.image || data.images`, forwarding `images` and `messages` into `runImageExtraction`
6. Tests: multi-image write/prompt/cleanup, legacy-singular parity, history threading, single-turn regression shape, cleanup on failure/spawn-error/partial-unlink-failure
7. Manual verification (2026-07-18): 2-image + 3-message request → 200, proxy logged "2 images", stitched 2371-char tab returned, zero `guitarhub-import-*` files left in tmpdir; legacy singular `image` request → 200, unchanged behavior

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
