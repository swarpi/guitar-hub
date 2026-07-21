# ADR-0009: In-App Image Import — One-Shot Screenshot/Photo Transcription in the AI Import Form

**Status:** Superseded by ADR-0010 (UI and single-image contract); normalization and proxy patterns remain in effect  
**Date:** 2026-07-13  
**Author:** Architect Agent

> **Superseded (in part) by [ADR-0010](0010-chat-import-redesign.md)** (`architecture/decisions/0010-chat-import-redesign.md`). ADR-0010 replaces this ADR's three-tab (Paste Text / URL / Image) UI and its single-image-per-request contract with a multi-turn, multi-image chat interface. What this ADR established that *remains in effect* and is reused (extended to arrays) by chat-import: client-side canvas normalization, base64 transport, the proxy-side temp-file lifecycle, and instrument-aware prompts. The sections below are retained as the historical record of the single-image design.

## Context

The in-app "Import via AI" panel on `/[instrument]/add` currently offers two sub-modes: **Paste Text** and **URL**. Both follow the same shape: the browser posts to a local proxy (`scripts/ai-proxy.ts`, started with `pnpm dev:ai`), the proxy shells out to `claude -p`, and the returned JSON pre-fills `SongForm` for the user to review and save. This is the lightweight, "I already have the material in front of me" convenience path defined in ADR-0006.

The user wants a third sub-mode, **Image**, so a screenshot or phone photo of a song sheet can be transcribed into the collection without leaving the web UI. The image must be addable three ways — file picker, drag-and-drop, and (explicitly required) clipboard paste via Cmd+V — and the result must flow through the *identical* extract → prefill `SongForm` → human-review → save path that Paste Text and URL already use. One-shot transcription with review-in-form is the accepted quality bar; there is deliberately no render-and-compare loop here.

This decision has prior art and one decision it must reverse:

1. **ADR-0006 Phase 3** already sketched in-app image transcription through this same proxy: a base64 `image` field on the request body, a temp file written proxy-side, an image flag passed to the CLI, and client-side canvas downscaling of large photos. That design is revived and adapted here — not reinvented — with corrections for how `claude -p` actually consumes images and for the post-ADR-0005 schema (`tabContent` renamed to `content`) and post-ADR-0008 routes (`/[instrument]/add`).

2. **ADR-0007 §7 explicitly descoped ADR-0006 Phase 3** (resolved open-question #4), routing all image ingestion to the heavier local Claude Code + MCP `sheet-ingest` pipeline. Its two stated reasons were (a) the browser proxy has no validation loop and (b) copyright — hosting transcription of published sheet music is a problem. This ADR reinstates the in-app image path as a distinct, complementary feature, and both concerns are answered directly:

   - **Validation loop.** The user has explicitly accepted one-shot + review-in-form for this convenience path, exactly as Paste Text and URL already work. The high-accuracy `sheet-ingest` pipeline (ADR-0007, tickets 001–008, complete) remains the tool of choice when correctness matters. This feature is the fast path, not a replacement for it.
   - **Copyright.** "Import via AI" is already local-only dev tooling. `ImportForm` posts to a hardcoded `http://localhost:3456/v1/messages`, and the transcription itself is performed by a `claude -p` process that `scripts/ai-proxy.ts` spawns **on the user's own machine**. The proxy is never deployed — `pnpm build` is just `next build`; the proxy lives only in the `dev:ai`/`dev:all` scripts. On the deployed Cloudflare Pages app there is no listener on `localhost:3456`, so the request fails and nothing is transcribed. Adding image support changes none of this: the deployed app never receives, stores, or transcribes an image. The copyright posture is identical to the existing text/URL modes.

The question this ADR answers: how does an image reach `claude -p` through the existing proxy, how do three browser input methods converge on one code path, and how does the Image mode slot into the current toggle and extract flow with minimal disruption?

## Decision

Add an **Image** sub-mode to `ImportForm` that normalizes any supplied image client-side, sends it as a base64 field to the AI proxy, and reuses the existing response contract so the downstream prefill/review/save path is untouched. The proxy gains one new branch: when a request carries image data, it writes a temp file, points `claude -p` at that file, and returns the same JSON envelope it already returns for text and URL.

### 1. Scope and where it plugs in

Image mode is a third value on `ImportForm`'s existing `InputMethod` union (`"paste" | "url"` → `"paste" | "url" | "image"`) and a third pill in the sub-mode toggle already rendered inside `ImportForm`:

```
[ Paste Text ]  [ URL ]  [ Image ]
```

Nothing changes in `AddPageClient` (the Manual/Import toggle), `SongForm`, `src/app/actions.ts` (`createSongLogic`), the schema, or the queries. **Image mode is available for both guitar and piano**, because the user's primary goal is ingesting piano song sheets (staff notation) — guitar-only would miss the main use case. That requires widening the AI-import gate in `src/app/[instrument]/add/page.tsx`, which today is `instrument === "guitar"`, to admit piano as well (see §1a). Other instruments (e.g. ukulele) remain out of scope for a later, separate change.

### 1a. Widening the AI-import gate to guitar and piano

Today `src/app/[instrument]/add/page.tsx` only routes guitar through `AddPageClient` (which hosts the Import toggle and the duplicate-warning banner); piano renders a bare `SongForm`, and the flat song list used for duplicate detection is fetched only for guitar. To offer AI import (and therefore Image mode) on piano, the page becomes instrument-aware:

- The gate changes from `instrument === "guitar"` to "guitar or piano" so both route through `AddPageClient`.
- `getAllSongsFlat(db, instrument)` is fetched for both instruments (not just guitar), so the client-side duplicate-warning banner works for piano too.
- `AddPageClient` already takes `instrument` and `existingSongs` as props and is instrument-agnostic; no change is needed there.

Text and URL modes come along for free on piano as a side effect, which is acceptable — but the motivating and primary path is Image.

The extract flow is preserved end to end:

```
image (picker | drop | Cmd+V)
   -> normalize on <canvas> -> base64 JPEG
   -> POST localhost:3456/v1/messages  { messages, system, model, image }
   -> proxy writes temp file, runs claude -p, returns { content:[{text}], ... }
   -> ImportForm parses JSON, validates tabContent
   -> onExtracted(SongFormInitialValues)  ── unchanged from here down ──
   -> AddPageClient shows filled SongForm (with duplicate-warning banner)
   -> user reviews/edits -> createSong
```

The critical design property: **only the request body differs by mode; the response envelope and everything after `onExtracted` are identical across Paste Text, URL, and Image.** That is what keeps the change surface small.

### 2. Three inputs, one code path

The file picker, drag-and-drop, and clipboard paste each yield a `File`/`Blob`, and all three funnel into a single handler:

```
handleImageSelected(source: File | Blob) -> normalize() -> base64 -> runImageExtraction()
```

- **File picker.** A hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`; `onChange` passes `files[0]`.
- **Drag-and-drop.** A dropzone element with `onDragOver`/`onDrop`; `onDrop` reads `e.dataTransfer.files[0]` and `preventDefault`s.
- **Clipboard paste (Cmd+V).** A `paste` listener scoped to Image mode (attached to the dropzone/window while `method === "image"`, removed otherwise so it never intercepts the Paste Text textarea). The handler scans `e.clipboardData.items` for the first item whose `type` starts with `image/`, calls `getAsFile()`, and feeds the resulting `Blob` to `handleImageSelected`. If no image item is present (e.g., the user pasted text), it is ignored and a hint is shown.

Because all three converge before normalization, the accepted-format, size, and encoding logic is written once.

### 3. Client-side normalization (format + size in one step)

Every image is drawn onto a `<canvas>` and re-encoded before it leaves the browser. This single step solves three problems at once:

1. **Size.** Phone photos are 5–10 MB and base64 inflates payloads ~33%. The image is downscaled so its longest edge is ≤ ~1600 px and exported as `canvas.toBlob('image/jpeg', 0.8)`. That keeps the base64 payload well under ~1 MB while preserving enough detail for text/tab recognition. ADR-0006 Phase 3 called for exactly this (1–2 MP, JPEG ~80%).
2. **Format normalization.** iPhone screenshots/photos and clipboard blobs arrive as PNG, JPEG, WebP, or HEIC. Drawing to a canvas and exporting JPEG normalizes all of them to a format `claude -p` reliably ingests, so HEIC and other odd inputs are handled without a special case.
3. **Constraints.** Accepted inputs are raster images (`image/png`, `image/jpeg`, `image/webp`, plus anything the browser can paint to a canvas). A pre-normalization guard rejects non-image types and files over a sane cap (e.g., 25 MB before downscale) with a clear message. No new dependency is needed — `<canvas>` and `toBlob` are built-in, consistent with ADR-0006's "minimal bundle impact" stance.

### 4. Proxy request/response shape

The Image case adds two fields to the existing request body — the base64 `image` and an `instrument` discriminator — and reuses the existing response envelope verbatim.

**Request (Image mode):**

```jsonc
{
  "messages": [{ "role": "user", "content": "<short instruction, e.g. 'Transcribe the attached sheet.'>" }],
  "system": "<image extraction system prompt>",
  "model": "claude-sonnet-4-5",
  "instrument": "guitar",           // "guitar" | "piano" — selects the output-format instruction
  "image": {
    "mediaType": "image/jpeg",
    "data": "<base64, no data: prefix>"
  }
}
```

The `instrument` field is how the proxy learns which storage format to transcribe *to* (§5). `ImportForm` already knows the active instrument (it is passed down from the page via `AddPageClient`), so it simply forwards it. The field is optional and defaults to `guitar` server-side, preserving backward compatibility with the existing text/URL requests, which do not send it.

Compare with the current modes, which are unchanged on the wire:
- **Paste Text:** `{ messages: [{ role:"user", content:<pasted text> }], system, model }`.
- **URL:** `{ messages: [{ role:"user", content:"URL: https://…" }], system, model }`.

**Response (all three modes, identical):**

```jsonc
{ "content": [{ "type": "text", "text": "<JSON string>" }], "model": "…", "role": "assistant" }
```

Keeping the envelope identical means `ImportForm`'s existing parse-and-validate block (`JSON.parse(data.content[0].text)`, then require a non-empty content field) is reused as-is. The model's JSON contract stays the same five fields (`title`, `artist`, `capo`, notation content, `notes`). For wire-compatibility with the existing parser, the notation key stays `tabContent` (mapped to `content` downstream) for both instruments — a legacy name that now carries **monospace tab/chord text for guitar and ABC notation for piano**. No new field names enter the contract; only the *content format* varies by instrument, driven by the system prompt. `capo` stays meaningful for guitar and is expected to be null for piano (ADR-0005 makes `capo` a guitar/ukulele column).

### 5. How the image reaches `claude -p`

The proxy's dispatch gains one branch, checked **before** the existing URL detection:

```
if (data.image)          -> IMAGE branch (new)
else if (single msg && extractUrlFromMessage) -> URL branch (existing)
else                     -> literal-prompt branch (existing)
```

The IMAGE branch:

1. Decodes `data.image.data` and writes it to a temp file under `os.tmpdir()` (e.g., `guitarhub-import-<random>.jpg`), mirroring how ADR-0007's local tooling already writes intermediates.
2. **Points `claude -p` at that file by embedding its absolute path in the prompt** — e.g., `Read the image at <abs path> and transcribe it. <instruction>`. `claude -p` is the agentic Claude Code CLI: it reads the referenced file via its Read (vision) tool. This is the mechanism actually available, and it is preferred over ADR-0006 Phase 3's speculative `--image` flag; if a first-class image flag is confirmed to exist and behave better during implementation, it is a drop-in substitute. The proxy keeps the same `--output-format text --model … [--system-prompt …]` args and the same 120 s timeout.
3. On `close`/`error`, deletes the temp file (a `finally`-style cleanup) so images never linger on disk. Because base64 image data can be large, the proxy's request-body accumulation cap (if any) must accommodate ~1–2 MB bodies; this is a local single-user server, so no rate limiting or auth is added.

**The system prompt is instrument-aware.** The proxy reads `data.instrument` and selects the output-format instruction accordingly; the field discipline (five-field JSON, JSON-only, correct for skew and lighting) is shared, but the *target notation* differs:

- **Guitar (`instrument: "guitar"`).** The input is a tab or chord sheet. Preserve exact tab spacing and line breaks (fret numbers on string lines), or the chords-over-lyrics layout for chord charts. Emit that text verbatim as the content field. This is the existing behavior, unchanged.
- **Piano (`instrument: "piano"`).** The input is staff notation. Transcribe it to **ABC notation**, in the same ABC subset the collection already uses — not a reinvented dialect. The prompt points at the collection's ABC conventions as encoded in the `sheet-ingest` skill (`.claude/skills/sheet-ingest/SKILL.md`, "ABC conventions for this collection", which itself derives from ADR-0005 §2 and the ticket-005 corpus at `scripts/fixtures/screenshot-corpus/*.abc`). This keeps in-app one-shot output format-consistent with the higher-accuracy MCP pipeline, so a song imported either way looks the same in the collection and renders under the same `abcjs` path. `capo` is left null for piano.

Because this is the one-shot convenience path, there is no render-and-compare loop — the ABC (or tab) lands in the review form for the user to eyeball and correct before saving, exactly as guitar text does today. When ABC accuracy matters, the ADR-0007 pipeline with its `validate_notation` loop remains the right tool.

### 6. Error handling (deltas from ADR-0006 §6)

The existing error states (proxy unreachable → "AI service is not running…"; invalid JSON; empty `tabContent`; generic HTTP) all apply unchanged because the response path is shared. Image mode adds:

| Case | Behavior |
|------|----------|
| Pasted clipboard has no image | Ignore the paste; show a hint: "Paste an image, or use the file picker." Non-blocking. |
| Unsupported/oversized file (pre-normalize) | Inline error naming accepted formats and the size cap; offer file picker / manual entry. |
| Still too large after downscale | Re-encode at lower quality/size once; if it still exceeds the cap, show size guidance. |
| Claude cannot read the image | Same "empty tab content" / retry path already wired, plus "Use manual entry" fallback. |

Every failure still leaves a path to manual entry — the import feature stays additive, never a trap.

### 7. Relationship to ADR-0006 and ADR-0007

- **ADR-0006 Phase 3 is reinstated and superseded-in-detail by this ADR.** The intent (in-app image import via the local proxy) is revived; the specifics are updated for the current schema/routes and the real `claude -p` image mechanism. This ADR is the authoritative design for that path.
- **This overrides the ADR-0007 §7 descope** of ADR-0006 Phase 3 (its resolved open-question #4). ADR-0007 is *not* deprecated or superseded as a whole — its MCP `sheet-ingest` pipeline remains the high-accuracy, validation-looped path and the correct tool for dense scores, video, and audio. Only the narrow "no lightweight in-app photo path" stance is reversed, which ADR-0007 §7 itself anticipated ("unless a lightweight in-app photo path is later wanted as a convenience"). ADR-0007 §7 and its open-question #4 should be annotated to point here.
- **Net division of labor:** three in-app AI modes (text, URL, image) for one-shot review-in-form convenience; the MCP pipeline for when the output must render and match the source. All of them share the same write path (`createSongLogic`) and storage formats (ADR-0005), and all remain local-only.

### 8. What changes in existing code

| File / Area | Change | Scope |
|-------------|--------|-------|
| `src/components/ImportForm.tsx` | Add `"image"` to `InputMethod`; third toggle pill; dropzone + hidden file input + scoped paste listener; canvas normalization; image request branch that forwards the active `instrument` and calls shared parse/`onExtracted` | Modified |
| `scripts/ai-proxy.ts` | Add the `data.image` branch: temp-file write, path-in-prompt, cleanup; read `data.instrument` to pick the guitar-tab vs. piano-ABC output-format instruction; unchanged envelope | Modified |
| `src/app/[instrument]/add/page.tsx` | Widen the AI-import gate from `instrument === "guitar"` to guitar-or-piano; fetch `getAllSongsFlat` for piano too so both route through `AddPageClient` (§1a) | Modified |
| `src/components/AddPageClient.tsx` | None (already instrument-agnostic; takes `instrument` + `existingSongs`) | Unchanged |
| `src/components/SongForm.tsx` | None (already takes `initialValues`) | Unchanged |
| `src/app/actions.ts`, `src/db/*` | None | Unchanged |

## Consequences

### Positive

- **Fastest possible photo-to-song for the common case.** Cmd+V a screenshot, glance at the filled form, save. No Claude Code session, no MCP, no pipeline setup.
- **Tiny, well-contained change.** One new proxy branch and one new `ImportForm` mode. The response envelope, downstream prefill/review/save, schema, and server actions are all untouched — the same low-risk profile ADR-0006 promised.
- **Three inputs, one path.** File picker, drag-drop, and clipboard converge before normalization, so format/size/encoding logic exists once. Canvas re-encoding also neutralizes HEIC and oversized photos for free.
- **Copyright posture preserved.** Transcription happens in a local `claude -p` process; the deployed app never sees an image. Identical to the existing text/URL modes.
- **No new dependencies.** `<canvas>`, `toBlob`, `ClipboardEvent`, and `DataTransfer` are all built-in.

### Negative

- **Local-only, like all AI import.** Works only when `pnpm dev:ai` is running; there is no "photograph a sheet on my phone and import from the deployed PWA" story. Consistent with ADR-0006/0007 and accepted for a personal app.
- **One-shot accuracy ceiling.** No render-and-compare loop means dense or blurry sheets will need manual correction in the review form, or a hop to the `sheet-ingest` pipeline. This is the deliberate trade for speed.
- **Proxy grows another mode.** `ai-proxy.ts` now has three request shapes (literal, URL, image) plus temp-file lifecycle. Small, but more than the original text relay.
- **Paste-listener scoping is fiddly.** The Image-mode paste handler must be active only in Image mode so it never swallows a Cmd+V into the Paste Text textarea. A concrete correctness detail to get right and test.

### Neutral

- **Guitar and piano, others later.** Image mode ships for both guitar (tab text) and piano (ABC), which also brings the pre-existing text/URL modes to piano as a side effect. Ukulele and any further instruments are a separate, later decision, not a regression.
- **JSON contract stable, format varies by instrument.** The model still returns the legacy `tabContent` key, which `ImportForm` still maps to `content`; Image mode adds no new field names. The only variation is the *content format* — tab text for guitar, ABC for piano — driven by the instrument-aware system prompt and the new `instrument` request field, so in-app piano output stays format-consistent with the ADR-0007 MCP pipeline.
- **Two AI entry points still coexist** (in-app one-shot vs. MCP pipeline) — intentional division of labor, as ADR-0007 already framed it.

## Alternatives Considered

### Alternative 1: Route all image ingestion to the MCP `sheet-ingest` pipeline (keep ADR-0007 §7 as-is)

Do nothing in-app; tell the user to drive Claude Code for any image.

**Why rejected:** It ignores the actual request. The user wants a button in the web UI with clipboard paste, accepting one-shot quality for speed. The MCP pipeline is heavier (install footprint, a Claude Code session, a validation loop) and is the wrong tool when the user just wants a screenshot split into fields in five seconds. The two paths are complementary; removing the fast one leaves a real gap.

### Alternative 2: Send the raw image bytes as multipart/form-data instead of base64 JSON

Post the file as binary multipart to a new proxy endpoint.

**Why rejected:** The proxy is JSON-only today (`JSON.parse(body)`), and every mode returns the same JSON envelope. Adding a multipart code path and content-type branching is more disruption than a single optional `image` field, for no real benefit at ~1 MB payloads after client-side downscale. Base64-in-JSON keeps one request/response shape family and reuses the existing parser. (Prior art: ADR-0006 Phase 3 also specified a base64 field.)

### Alternative 3: Skip client-side downscaling; send the original image

Let the proxy handle any size.

**Why rejected:** 5–10 MB photos (×1.33 base64) bloat requests, slow the round trip, and risk hitting body-size limits, all for detail Claude does not need at ~1600 px. Canvas downscale is a few lines, needs no dependency, and — as a bonus — normalizes HEIC/WebP/PNG to one format. The cost of *not* downscaling is paid on every import.

### Alternative 4: Auto-save the transcription without the review step

Transcribe and insert directly, skipping the filled `SongForm`.

**Why rejected:** Same reasoning ADR-0006 gave for text/URL, only stronger for images. OCR-style transcription of tabs misreads spacing, capo notes, and artist/title more often than text parsing does. Review-before-save catches those at the cheapest moment — one glance and a click — and keeps the exact behavior the other two modes already have, which is what the user asked to match.
