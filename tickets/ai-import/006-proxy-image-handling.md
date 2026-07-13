# Ticket: AI Proxy — Image Input Handling

**Feature:** ai-import
**Status:** Todo
**Priority:** P1
**Estimate:** M
**Related:** ADR-0009 (Sections 4 "Proxy request/response shape", 5 "How the image reaches `claude -p`", 7), ai-import/004 (established the pure-module + mocked-I/O test pattern this ticket reuses)

## Context

ADR-0009 adds an **Image** sub-mode to the in-app AI import flow. The proxy (`scripts/ai-proxy.ts`) already dispatches on request shape — literal prompt, or the ticket-004 URL branch (`extractUrlFromMessage` → `fetchUrlAsText` → `buildFetchedPageMessage`) — and returns one response envelope (`{ content: [{ type: "text", text }], model, role }`) regardless of branch. This ticket adds a third branch, checked **before** the URL branch (ADR §5): when the request body carries `image`, the proxy writes the base64 payload to a temp file under `os.tmpdir()`, points `claude -p` at that file by embedding its absolute path in the `-p` prompt, and cleans the temp file up afterward.

Per ADR §4, the request also gains an optional `instrument: "guitar" | "piano"` discriminator (default `"guitar"`), which selects the *target notation* instruction embedded in that same `-p` prompt — guitar keeps producing tab/chord text, piano is told to transcribe to ABC in the collection's existing subset (`.claude/skills/sheet-ingest/SKILL.md`, "ABC conventions for this collection", itself derived from ADR-0005 §2). The shared field-discipline instructions (five-field JSON, JSON-only, no markdown fences) continue to arrive via `data.system` → `--system-prompt`, unchanged from today — that field is owned by the client (ticket 008), not built here. This ticket is scoped to the `-p` prompt's short "what does the output format look like" instruction only.

Ticket 004 established the project's pattern for this kind of change: don't try to unit-test the whole HTTP handler (it has zero automated tests today, and stays that way); instead extract the new, side-effecting-but-mockable logic into a sibling pure(ish) module, unit test that module with mocked I/O, and wire a thin call into `ai-proxy.ts`. `scripts/lib/audio-pipeline.ts` / `audio-pipeline.test.ts` (sheet-ingest ticket 006) additionally show the project's convention for testing `child_process.spawn` call sites: mock `node:child_process`, drive a fake `EventEmitter`-based child through `stdout`/`stderr`/`close`/`error`. This ticket follows both patterns at once — the new module owns its own `spawn` call so it can be tested the same way.

## Goal

Add a `scripts/image-import.ts` module that writes an incoming base64 image to a temp file, runs `claude -p` against an instrument-aware prompt pointing at that file, and cleans up the temp file in every outcome; wire one new branch into `scripts/ai-proxy.ts` that calls it before the existing URL detection.

## Acceptance Criteria

- [ ] `scripts/image-import.ts` exports the following functions:
  - [ ] `mediaTypeToExtension(mediaType: string): string` — pure. `"image/jpeg"` → `"jpg"`, `"image/png"` → `"png"`, `"image/webp"` → `"webp"`; any other value falls back to `"jpg"`.
  - [ ] `buildImagePrompt(imagePath: string, instrument?: "guitar" | "piano"): string` — pure. Always includes the literal `imagePath` verbatim. When `instrument` is `"piano"`, the returned string mentions ABC notation (e.g. contains `"ABC"`). When `instrument` is `"guitar"` or omitted, it mentions tab/chord preservation (e.g. contains `"tab"` or `"chord"`, case-insensitive) and does **not** mention ABC.
  - [ ] `writeTempImageFile(base64Data: string, mediaType: string): Promise<string>` — decodes `base64Data` into a `Buffer` and writes it via `node:fs/promises` `writeFile` to a path under `node:os` `tmpdir()` named `guitarhub-import-<unique>.<ext>` (ext from `mediaTypeToExtension`); resolves with the absolute path written.
  - [ ] `cleanupTempImageFile(filePath: string): Promise<void>` — calls `node:fs/promises` `unlink(filePath)`; any rejection (e.g. the file is already gone) is caught and logged via `console.warn`, never re-thrown — cleanup failure must never crash the proxy or fail the request.
  - [ ] `runImageExtraction(request: { image: { mediaType: string; data: string }; instrument?: "guitar" | "piano"; system?: string; model?: string }): Promise<{ status: number; body: unknown }>` orchestrates: `writeTempImageFile` → build the `claude -p` args (`["-p", buildImagePrompt(path, instrument), "--output-format", "text", "--model", model ?? "claude-sonnet-4-5", ...(system ? ["--system-prompt", system] : [])]`) → `node:child_process` `spawn("claude", args, { stdio: ["ignore","pipe","pipe"], timeout: 120_000 })` → on `close`, always `cleanupTempImageFile` (success or failure), then resolve:
    - [ ] Exit code `0`: `{ status: 200, body: { content: [{ type: "text", text: stdout.trim() }], model: model ?? "claude-sonnet-4-5", role: "assistant" } }` — same envelope shape the literal/URL branches already return.
    - [ ] Non-zero exit code: `{ status: 500, body: { error: { message: stderr.trim() || "Process exited with code <code>" } } }`.
    - [ ] `spawn`'s `error` event (process could not start): cleanup runs, resolves `{ status: 500, body: { error: { message: err.message } } }`.
- [ ] `scripts/ai-proxy.ts`'s `RequestBody` interface gains two optional fields: `instrument?: "guitar" | "piano"` and `image?: { mediaType: string; data: string }`.
- [ ] The request handler gains a branch checked **before** the existing URL-detection logic: `if (data.image) { const result = await runImageExtraction({ image: data.image, instrument: data.instrument, system: data.system, model: data.model }); res.writeHead(result.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(result.body)); return; }`.
- [ ] Requests with no `image` field are handled exactly as before — no change to the literal-prompt or URL branches, and no change to their existing behavior for multi-message or single-message-without-`URL:` requests.
- [ ] `pnpm test` passes, including new tests in `scripts/image-import.test.ts` covering, with `node:child_process` mocked (`vi.mock("node:child_process", () => ({ spawn: vi.fn() }))`, fake `EventEmitter` child driven through `stdout`/`stderr`/`close`/`error` per the `audio-pipeline.test.ts` pattern) and `node:fs/promises` mocked (`writeFile`, `unlink`):
  - [ ] `mediaTypeToExtension`: all three known types plus an unknown-type fallback to `"jpg"`
  - [ ] `buildImagePrompt`: guitar wording (default and explicit `"guitar"`), piano wording (contains ABC), and that the image path always appears verbatim in the output
  - [ ] `writeTempImageFile`: `writeFile` is called with a path matching `/guitarhub-import-.+\.(jpg|png|webp)$/` under `os.tmpdir()`, and with a `Buffer` whose content matches the base64-decoded input; the returned path equals the path passed to `writeFile`
  - [ ] `cleanupTempImageFile`: calls `unlink` with the given path; when `unlink` rejects, the returned promise still resolves (does not throw) and `console.warn` is called
  - [ ] `runImageExtraction` success path: the fake child closes with code `0` and stdout text; the resolved value has `status: 200` and `body.content[0].text` equal to the trimmed stdout; `unlink` was called (cleanup ran) with the same path `writeFile` was called with
  - [ ] `runImageExtraction` failure path: the fake child closes with a non-zero code and stderr text; resolves `status: 500` with `body.error.message` equal to the trimmed stderr; cleanup still ran
  - [ ] `runImageExtraction` spawn-error path: the fake child emits `"error"`; resolves `status: 500` with `body.error.message` equal to the error's message; cleanup still ran
  - [ ] `runImageExtraction` passes `instrument: "piano"` through to the `-p` argument passed to `spawn` (assert on the mocked `spawn` call's args containing ABC wording) and defaults to guitar wording when `instrument` is omitted
  - [ ] `runImageExtraction` defaults `model` to `"claude-sonnet-4-5"` in both the `spawn` args and the success response body when `model` is omitted, and omits `--system-prompt` from the `spawn` args when `system` is omitted
- [ ] `pnpm lint` passes on all changed files
- [ ] `pnpm build` compiles without errors
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `src/components/ImportForm.tsx`, `AddPageClient.tsx`, or any other client code — that is ai-import/008 (depends on this ticket's request/response contract)
- Any change to `src/app/[instrument]/add/page.tsx` — that is ai-import/009 (independent of this ticket)
- Client-side canvas downscaling/normalization — that is ai-import/007 (independent of this ticket; produces the base64 JPEG this ticket's `image.data` field consumes)
- Building or documenting the `IMAGE_SYSTEM_PROMPT` client-side constant sent as `data.system` — owned by ai-import/008; this ticket only forwards whatever `data.system` arrives, unchanged from the existing passthrough behavior
- Request body size limits, rate limiting, or auth — this is local single-user dev tooling (ADR-0009 §5, unchanged posture)
- Automated end-to-end tests of the real HTTP handler or a real `claude` CLI invocation — per the project convention established in ai-import/004, `ai-proxy.ts`'s request handler itself has no automated tests; only the newly extracted pure/mockable functions in `scripts/image-import.ts` are unit tested. Manual verification (see Notes) covers the wiring.
- Retry with exponential backoff, request cancellation, or an `--image` CLI flag (ADR-0009 §5 explicitly prefers the path-in-prompt mechanism; a first-class flag is a drop-in substitute only if later confirmed to exist and behave better — not attempted here)

## Notes

**Why extract a new module instead of inlining in `ai-proxy.ts`.** Ticket 004 did the same thing for URL fetching (`scripts/url-import.ts`) for the same reason: the HTTP request handler mixes untestable I/O (sockets, process spawning) with logic that benefits from tests. Extracting `runImageExtraction` — including its own `spawn` call — lets this ticket use the exact mocked-`child_process` pattern from `scripts/lib/audio-pipeline.test.ts`, rather than leaving the image branch as untested inline code the way the pre-ticket-004 `ai-proxy.ts` handler was.

**Instrument-aware wording is not prescribed verbatim.** Unlike ADR-0006's Phase 1 `SYSTEM_PROMPT` (a verbatim block), ADR-0009 does not mandate exact instruction text for `buildImagePrompt` — only that guitar output stays tab/chord text and piano output targets ABC per the `sheet-ingest` skill's conventions. Suggested wording:

- Guitar: `"This is a guitar tab or chord sheet. Preserve exact tab spacing and line breaks (fret numbers on string lines), or the chords-over-lyrics layout for chord charts. Emit that text verbatim as the content field."`
- Piano: `"This is piano staff notation. Transcribe it to ABC notation in the collection's existing conventions (X:/T:/M:/L:/K: header, one voice unless the source is clearly multi-staff). Emit the ABC as the content field."`

Tests should assert on the presence of key terms (`"ABC"` for piano; `"tab"`/`"chord"` for guitar), not an exact string match, so wording can be refined without breaking tests.

**Temp file naming.** `guitarhub-import-<unique>.<ext>` mirrors the naming ADR-0009 §5 suggests (`guitarhub-import-<random>.jpg`). Use `node:crypto`'s `randomUUID()` (or equivalent) for `<unique>` — no need to mock it in tests; assert the resulting path against a regex instead of an exact string.

**Manual verification.** Because this touches the real `claude` CLI, verify by hand after implementation with `pnpm dev:ai` running (or `AI_PROXY_PORT` pointed at a spare port, per ticket 004's convention) and a `curl` request carrying a small base64 JPEG in the `image.data` field for both `instrument: "guitar"` and `instrument: "piano"`; confirm a `200` response with the expected content shape and that the temp file no longer exists in `os.tmpdir()` afterward. Document the result in the PR/commit message, as ticket 004 did.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
