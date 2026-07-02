# ADR-0007: MCP-Based Sheet Ingestion Pipeline — Screenshots, YouTube, and Audio to Validated Notation

**Status:** Accepted  
**Date:** 2026-07-02  
**Author:** Architect Agent

## Context

Guitar Hub (soon "Music Hub" under ADR-0005) is a personal, single-user music sheet collection. Songs are stored as text — guitar tabs as monospace text, piano and other instruments as ABC notation (ADR-0005). Content today enters the database one of two ways: the manual `/add` form, or the in-app AI import flow designed in ADR-0006.

ADR-0006 covers a specific, deliberately narrow case: the user already has notation-ish text (pasted from a website, fetched from a URL, or photographed) and wants Claude to split it into structured fields. That flow is browser-driven. The `ImportForm` client component posts to a local proxy (`scripts/ai-proxy.ts`), which shells out to `claude -p` and returns JSON that pre-fills `SongForm`. It is a one-shot transcription with a human review step.

The user now wants something substantially more capable: ingest a **screenshot of sheet music**, a **YouTube tutorial**, or an **audio performance**, and end up with clean, renderable notation in the collection — without hand-authoring ABC. This is not "parse text I already have." It is "watch/look at this source and produce correct notation for it." The quality bar is higher (the output must render and match the source), the tooling is heavier (OMR engines, `yt-dlp`, `ffmpeg`, audio-to-MIDI models, `music21`), and one-shot transcription is unreliable for anything past a simple lead sheet.

Three forces shape this decision:

1. **The runtime split is unchanged.** Production runs on Cloudflare Pages edge workers — no child processes, no filesystem, no long-running jobs (ADR-0006, constraint 1). Any pipeline that runs `yt-dlp`, `ffmpeg`, Audiveris, or `basic-pitch` cannot live in the app. It must run on the user's local machine.

2. **Transcription needs a feedback loop, not a single call.** Optical music recognition (OMR) misreads accidentals, ties, and voices. Audio-to-MIDI produces messy quantization. Vision transcription hallucinates on dense scores. The only reliable path is generate → render → compare → correct, iterated until the rendered output matches the source. This is an agentic loop, not a form submission.

3. **Copyright is a hard boundary.** Transcribing published sheet music into a personal collection is defensible as personal use; hosting that collection publicly is not. This constraint forces the whole ingestion pipeline to stay local and keeps the collection off any public deployment surface.

The question this ADR answers: what is the architecture for turning rich media (images, video, audio) into validated notation in a personal collection, given an edge-hosted app that cannot do any of the heavy lifting?

## Decision

Introduce a **local MCP (Model Context Protocol) server** that exposes the hub's collection as tools, and drive ingestion through **Claude Code** as the agent. Claude Code runs the media pipeline via `bash`, funnels everything through **MIDI/MusicXML as an intermediate format**, normalizes with `music21`, and closes the quality gap with a **validation-driven render-and-compare loop**. The whole system is local-only by design.

### 1. Architecture: Claude Code + Local MCP Server, not Browser + Proxy

The center of gravity moves out of the browser and into Claude Code.

```
                         (edge, read-only for browsing)
   Music Hub web UI  ─────────────────────────────────►  D1 (production)
        │
        │  (local development / ingestion)
        ▼
   Claude Code  ──MCP──►  local MCP server  ──►  local SQLite (dev D1)
        │
        │ bash
        ▼
   yt-dlp / ffmpeg / Audiveris / basic-pitch / music21 / Verovio
```

The local MCP server exposes the collection as tools:

| Tool | Purpose |
|------|---------|
| `add_sheet` | Insert a song with metadata (title, artist, instrument, difficulty, key, capo, source URL) |
| `list_sheets` | Query existing songs (for duplicate detection and context) |
| `update_sheet` | Edit an existing song's content or metadata |
| `validate_notation` | Render notation headlessly, return either parse/render errors or a rendered PNG |

The user's interaction becomes a natural-language instruction to Claude Code, for example: *"Here's a screenshot / YouTube URL — add this to the hub as a guitar lead sheet in G major."* Claude Code selects the pipeline, runs the tools, iterates on validation, and calls `add_sheet` when the notation is clean.

**Why MCP over the ADR-0006 browser proxy for this use case:** The ADR-0006 proxy is a dumb relay — browser sends text, proxy shells to `claude -p`, returns text. It has no concept of the collection, no tool loop, and no ability to orchestrate a multi-step pipeline with intermediate files. Rich-media ingestion is inherently agentic: download a video, extract frames, run OMR, inspect the output, render it, compare, correct, retry. That is exactly what Claude Code plus tools is built for. Forcing this into a single browser request would mean reimplementing an agent runtime inside `ai-proxy.ts`.

**`add_sheet` writes through the canonical path.** The MCP tool must call the same write logic as the web form — `createSongLogic` in `src/app/actions.ts` (ADR-0006, constraint 2) — against the local dev database. No second write path, no schema divergence. The tool is a thin adapter over the existing function.

**New metadata columns.** The `add_sheet` metadata includes three fields the ADR-0005 schema does not have. They become first-class nullable columns via a small additive migration, consistent with ADR-0005's stance that instrument-specific structured fields are added as nullable columns when needed:

```sql
ALTER TABLE songs ADD COLUMN difficulty TEXT;   -- e.g. 'beginner' | 'intermediate' | 'advanced'
ALTER TABLE songs ADD COLUMN key TEXT;          -- e.g. 'G', 'Am'
ALTER TABLE songs ADD COLUMN source_url TEXT;   -- provenance of ingested content
```

Columns over stuffing into `notes` because all three are exactly the fields a collection gets filtered by ("show me easy songs in G"), and `source_url` is provenance metadata the pipeline should record mechanically, not prose. All three are nullable, apply to every instrument, and remain optional in the web form. This migration depends on the ADR-0005 schema migration (`instrument` column, `content` rename) landing first.

### 2. Ingestion Paths — Route by Input Type

There is no single ingestion algorithm. The pipeline branches on what the source actually is.

**Screenshots / images.** Two approaches, to be prototyped side by side rather than chosen up front:

- **Path A — Claude vision direct.** Claude Code reads the image and transcribes it straight to ABC. This works well for lead sheets, chord charts, and simple melodies. It falls apart on dense piano scores.
- **Path B — OMR preprocessing.** Run the image through Audiveris (open source, outputs MusicXML), then have Claude *clean up and validate* the OMR output rather than transcribe from scratch. OMR does the pixel-level work; Claude does the judgment work — fixing misread accidentals, adding chord symbols, splitting hands. This is the more robust pipeline for anything non-trivial.

The decision defers the A-vs-B choice to a prototype comparison but establishes the heuristic: **vision-direct for simple monophonic/chart material, OMR-assisted for dense scores.**

**YouTube videos.** The right pipeline depends on the video type:

- **Synthesia-style falling-notes tutorials** (the majority of piano tutorials) are effectively visual MIDI. Extract frames with `yt-dlp` + `ffmpeg`, detect per-frame key presses (open-source projects already do this frame-to-MIDI conversion), then convert MIDI → MusicXML with `music21`.
- **Videos showing actual sheet music.** Sample frames, dedupe repeated pages, and feed the distinct pages into the screenshot pipeline above.
- **Audio-only / performance videos.** Run audio-to-MIDI with Spotify's `basic-pitch` (open source; works decently for piano and monophonic guitar), then MIDI → notation via `music21`. Quantization will be rough — this is where a Claude review-and-clean pass earns its keep.

### 3. The Unifying Trick: MIDI as Intermediate Format

Everything derived from video or audio converges on **MIDI as the common intermediate representation**, then `music21` normalizes MIDI to MusicXML/ABC, then Claude does a review pass.

```
falling-notes video ─┐
audio / performance ─┼─► MIDI ─► music21 ─► MusicXML / ABC ─► Claude review ─► validate ─► add_sheet
                     │
sheet-music frames ──┴─► (screenshot pipeline) ─► MusicXML / ABC ─┘
```

MIDI is the pivot because every audio/video-derived signal reduces cleanly to "which notes, when, how long," and MIDI → MusicXML is a solved problem (`music21` does it in a few lines). This collapses N source types into one normalization path instead of N bespoke transcribers.

The stored format remains as ADR-0005 dictates: ABC for piano and staff-notation instruments, monospace tab text for guitar. MusicXML is a transit format, not a storage format — consistent with ADR-0005's rejection of MusicXML for storage (verbose, not hand-authored).

### 4. Validation-Driven Loop — Never Trust One-Shot Transcription

The quality mechanism is `validate_notation`, and it is the heart of this ADR.

`validate_notation` renders the candidate notation **headlessly in Node** (`abcjs` for ABC — already a dependency under ADR-0005 — or Verovio for MusicXML). It returns one of two things:

- **Parse/render errors** — the notation is malformed; Claude fixes and retries.
- **A rendered PNG** — Claude visually compares the rendered output against the source screenshot/frame, spots discrepancies (wrong pitch, missing bar, dropped accidental), corrects, and re-validates.

This self-correction loop is what makes ingestion reliable instead of flaky. A single transcription pass is treated as a draft, never as the answer. Only notation that renders cleanly and matches the source reaches `add_sheet`.

`abcjs` is already the chosen renderer (ADR-0005) so ABC validation reuses it. Verovio is added for MusicXML rendering during the validation loop; it runs locally in the MCP server, never on the edge.

### 5. A Claude Code Skill Encodes the Pipeline

The routing logic, notation conventions, and known failure modes live in a Claude Code skill at `sheet-ingest/SKILL.md`. It encodes:

- Which path to take for which input type (the routing table in sections 2–3)
- The ABC conventions the collection uses (consistent with ADR-0005)
- Common OMR error patterns and how to correct them
- The validation loop protocol (render, compare, correct, repeat)

The skill turns tacit pipeline knowledge into a reusable, versioned artifact so ingestion behaves consistently across sessions rather than being re-derived each time.

### 6. Local-Only by Design (Copyright Boundary)

The entire ingestion apparatus — MCP server, media tools, validation renderer — runs on the user's machine and writes to the local database. For personal use, transcribing sheet music is fine. Transcribing *published* sheet music into a *publicly hosted* collection is a copyright problem. Therefore:

- The MCP server and pipeline are never deployed. They are local development tools, like the ADR-0006 proxy.
- The collection stays personal. This ADR does not authorize making the collection (or transcribed content) public.
- The production edge deployment remains a read/browse surface for the single user, not a public library.

This is a decision driver, not a footnote: it is *why* the architecture is local-first rather than a hosted ingestion service.

### 7. Relationship to ADR-0006 (AI Tab Import)

ADR-0006 and this ADR overlap on the image/photo case and must be reconciled.

- **ADR-0006 Phase 1 (paste text) and Phase 2 (URL) stand.** They serve a genuinely different, lightweight need: the user already has notation-shaped text and wants it split into fields, in-app, without opening Claude Code. Those phases have tickets (`tickets/ai-import/`) and remain valid.
- **ADR-0006 Phase 3 (in-app image transcription via the browser proxy) is superseded by this ADR.** One-shot image transcription through the browser proxy has no validation loop and no OMR fallback — exactly the weaknesses this ADR exists to fix. Image ingestion moves to the Claude Code + MCP pipeline. The ADR-0006 Phase 3 proxy image-handling work (temp files, `--image` flag, client-side resize) should be treated as **descoped**, not implemented, unless a lightweight in-app photo path is later wanted as a convenience.
- **Net:** ADR-0006 becomes the "I already have the text" path; ADR-0007 becomes the "produce notation from rich media" path. They share the same write path (`createSongLogic`) and the same storage formats (ADR-0005). They are complementary, with a clean handoff at the image boundary.

This ADR does not deprecate ADR-0006. It supersedes only ADR-0006 Phase 3.

## Consequences

### Positive

- **Reliability through feedback.** The render-and-compare loop turns unreliable one-shot transcription into a self-correcting process. Output that reaches the collection has been rendered and visually checked against the source.
- **One normalization path for many sources.** MIDI-as-intermediate collapses video, audio, and (via `music21`) OMR output into a single MusicXML/ABC normalization step, avoiding a bespoke transcriber per source type.
- **Edge constraints respected.** All heavy tooling runs locally under Claude Code. Nothing about the pipeline pressures the Cloudflare edge runtime, and the app's write path is untouched — `add_sheet` reuses `createSongLogic`.
- **Reuses ADR-0005 choices.** ABC stays the storage format; `abcjs` doubles as the validation renderer. No new storage model.
- **Copyright-safe posture.** Local-only ingestion and a personal (non-public) collection keep the project on the defensible side of the copyright line.
- **Knowledge is captured, not tacit.** The `sheet-ingest` skill makes pipeline decisions reproducible across sessions.

### Negative

- **Heavy local dependency footprint.** `yt-dlp`, `ffmpeg`, Audiveris (Java), `basic-pitch` (Python), `music21` (Python), and Verovio (Node) are a real toolchain to install and maintain. This is a meaningfully larger setup than the ADR-0006 proxy.
- **Ingestion is not in-app.** The rich-media flow requires driving Claude Code, not clicking a button in the web UI. For a developer-user this is acceptable; it does mean no phone-based "photograph and ingest" from the deployed PWA.
- **New surface: the MCP server.** A local MCP server is new infrastructure — process lifecycle, tool schemas, and its adapter over `createSongLogic` all need building and testing.
- **Quality still varies by source.** Dense polyphonic scores, noisy audio, and non-standard tutorial videos will still challenge the pipeline. The validation loop reduces bad output; it does not guarantee perfect transcription.
- **Partial supersession of in-flight work.** ADR-0006 Phase 3 tickets, if any exist, are descoped. This is minor churn but must be communicated so no one implements the now-superseded proxy image path.

### Neutral

- **A-vs-B image strategy is deferred.** Vision-direct vs. OMR-assisted is left to a prototype comparison rather than fixed here. The architecture supports both; the skill will encode the winner per input class.
- **Two AI entry points coexist.** The in-app ADR-0006 flow (text/URL) and the Claude Code MCP flow (rich media) both exist. This is intentional division of labor, not redundancy, but it is two things to understand rather than one.
- **MusicXML re-enters the picture as transit only.** ADR-0005 rejected MusicXML for storage; this ADR uses it purely as an intermediate format. No contradiction, but worth stating explicitly.

## Assumptions and Open Questions

Because this ADR was produced non-interactively, the following are recorded assumptions rather than confirmed requirements. They should be validated before or during implementation.

1. **MCP transport and host.** Assumed the MCP server is a local stdio/HTTP server that Claude Code connects to on the user's machine. The exact MCP transport, auth (likely none, single-user local), and process manager are unspecified.
2. **Which database ingestion writes to.** Assumed `add_sheet` writes to the **local dev D1 / SQLite**, and content reaches production via the normal deploy/seed path rather than the MCP server writing to production D1 directly. If direct-to-production writes are wanted, that needs its own decision (and re-examines the copyright/local-only stance).
3. **New metadata fields.** *Resolved 2026-07-02:* `difficulty`, `key`, and `source_url` become first-class nullable columns via a small additive migration (see Decision, section 1). Rationale: these are the fields the collection gets filtered by, and provenance belongs in structured data, not prose.
4. **Fate of ADR-0006 Phase 3.** *Resolved 2026-07-02:* Phase 3 (in-app image import via the browser proxy) is descoped in favor of this pipeline. If a lightweight in-app photo path is later wanted for convenience, that is a new decision.
5. **Tooling choices are directional.** Audiveris, `basic-pitch`, `music21`, and Verovio are named as the current best open-source options. Assumed they are acceptable; none is contractually fixed by this ADR. The frame-to-MIDI "falling notes" converter is referenced generically — a specific project needs selection during prototyping.
6. **Scope of instruments.** Assumed the pipeline targets guitar and piano first (per ADR-0005), with the same routing logic extensible to ukulele later.
7. **Legal posture is pragmatic, not legal advice.** The copyright boundary is treated as "keep it personal and local." This ADR does not constitute a legal opinion.

## Alternatives Considered

### Alternative 1: Extend the ADR-0006 Browser Proxy to Handle Rich Media

Add video/audio/OMR handling to `scripts/ai-proxy.ts` and keep ingestion in the browser as an extended `ImportForm`.

**Why rejected:** The proxy is a single-request relay with no tool loop and no orchestration. Rich-media ingestion is multi-step and iterative — download, extract, transcribe, render, compare, correct, retry. Building that inside the proxy means reinventing an agent runtime, temp-file management, and a validation loop that Claude Code already provides. It also keeps long-running media jobs behind a browser HTTP request, which is the wrong execution model for minutes-long `ffmpeg`/OMR work.

### Alternative 2: One-Shot Transcription Without a Validation Loop

Have Claude transcribe the image/audio/video directly to notation in a single pass and save it, trusting the output (as ADR-0006 Phase 3 effectively did for images).

**Why rejected:** One-shot transcription is unreliable beyond simple lead sheets — OMR misreads accidentals, audio-to-MIDI mis-quantizes, vision hallucinates on dense scores. Without render-and-compare, errors land silently in the collection and are expensive to find later. The validation loop is the single most important quality mechanism in this design; removing it defeats the purpose.

### Alternative 3: A Custom Transcriber Per Source Type

Build dedicated end-to-end transcribers: one for falling-notes video, one for audio, one for sheet-music images, each producing ABC directly.

**Why rejected:** This multiplies maintenance across N bespoke pipelines and discards the leverage of a common representation. MIDI-as-intermediate plus `music21` normalization collapses the audio/video cases into one path, and OMR already emits MusicXML. Per-source transcribers would re-solve MIDI→notation repeatedly instead of once.

### Alternative 4: A Hosted Ingestion Service

Run the pipeline as a cloud service (containers with `ffmpeg`, OMR, ML models) so ingestion works from any device, including the deployed PWA on a phone.

**Why rejected:** Two blocking reasons. First, copyright — a hosted service transcribing published sheet music into a network-accessible collection moves squarely off the defensible personal-use ground. Second, cost and complexity — GPU/CPU containers, model hosting, job queues, and API-key management are wildly out of proportion for a single-user personal app. The local-first design is a deliberate response to both.

### Alternative 5: Store MusicXML Directly Instead of Normalizing to ABC

Since the pipeline already produces MusicXML, store MusicXML as the content format and render it with Verovio in the app.

**Why rejected:** ADR-0005 already decided ABC for storage — human-readable, compact, hand-editable, and rendered by the lighter `abcjs`. MusicXML is 10–50x larger, not hand-authorable, and would require shipping Verovio to the edge/browser for every view. Keeping MusicXML as a transit-only format preserves ADR-0005's storage decision while still using MusicXML where it is genuinely useful — inside the local pipeline.
