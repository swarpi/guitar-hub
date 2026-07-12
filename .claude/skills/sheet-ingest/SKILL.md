---
name: sheet-ingest
description: Ingest sheet music into the Music Hub collection from a screenshot, a YouTube tutorial, or an audio recording — route the source to the right pipeline, transcribe to ABC (piano) or tab (guitar), validate with a render-and-compare loop, then add it via the local MCP server. Use whenever the user points at an image/video/audio source and wants it added to the hub as a song.
---

# Sheet Ingestion

Turn a screenshot, YouTube video, or audio recording into clean, renderable notation in the Music Hub collection. This skill is the operational "how." For the "why" behind the architecture — local-only posture, MIDI-as-intermediate, the validation loop — read `architecture/decisions/0007-mcp-sheet-ingestion-pipeline.md`; do not re-derive it here.

The collection stores **guitar** content as monospace tab text and **piano** content as ABC notation (ADR-0005). Everything below funnels a source into one of those two stored formats and only writes to the collection once the notation renders and visually matches the source.

Everything runs locally. The MCP server writes to the **local dev SQLite database**, never production. Content reaches production through the normal deploy/seed path, not this pipeline.

## Prerequisites and tools

Start the local MCP server before ingesting:

```bash
pnpm dev:mcp        # stdio MCP server: add_sheet, list_sheets, update_sheet, validate_notation
```

Register it once with Claude Code (`claude mcp add`, or an `.mcp.json` entry pointing at the `dev:mcp` command — see the top-of-file comment in `scripts/mcp-sheet-server.ts`).

**MCP tools** (thin adapters over the app's own `createSongLogic` / `updateSongLogic` — same write path as the web form):

| Tool | Use |
|------|-----|
| `list_sheets` | Check for duplicates and browse context before adding. Filters: `instrument`, `artist`. Returns id/title/artist/instrument/slug/difficulty/key — no `content`. |
| `validate_notation` | Render candidate notation headlessly. Accepts ABC (via `abcjs`) or MusicXML (via Verovio). Returns parse/render errors, or a rendered PNG. This is the heart of the loop. |
| `add_sheet` | Insert the song once validation passes. Fields: `title`, `artist`, `instrument` (`guitar`\|`piano`), `content`, optional `capo`, `notes`, `difficulty`, `key`, `sourceUrl`. Returns `{ error }` on validation/duplicate failure — read it, do not treat as thrown. |
| `update_sheet` | Edit an existing song by `id`. Same optional fields; `instrument` is fixed at creation. |

**Validating from bash** (when driving the media pipeline outside an MCP client, the same renderer without a tool round-trip):

```bash
npx tsx scripts/lib/validate-cli.ts <abc|musicxml> <input-file> [output-png]
# exit 1 + printed errors on failure; writes the PNG and exits 0 on success
```

**Media pipeline modules** (invoke their exported functions from a short `tsx` driver; the manual walkthrough is in `scripts/lib/README.md`):

- `scripts/lib/audio-pipeline.ts` — `downloadAudio(youtubeUrl, outputPath)`, `audioToMidi(audioPath, outMidiPath)`, `midiToNotation(midiPath) → { musicxml }`. Requires `yt-dlp`, `ffmpeg`, and the Python venv at `scripts/lib/.venv-audio` (`basic-pitch`, `music21`). Binary paths override via `AUDIO_PIPELINE_YT_DLP` / `AUDIO_PIPELINE_BASIC_PITCH` / `AUDIO_PIPELINE_PYTHON`.
- `scripts/lib/falling-notes-pipeline.ts` — `extractFrames(videoPath, outputDir)` (samples at 30 fps), `framesToMidi(frameDir, outMidiPath)` (stitches frames to video, runs the detector). Then reuse `midiToNotation` from the audio module. Overrides: `FALLING_NOTES_FFMPEG`, `FALLING_NOTES_TOOL_DIR` (default `~/tools/MIDI-Converter`), `FALLING_NOTES_PYTHON`.
- **Audiveris** (OMR, installed at `~/tools/Audiveris.app`) — see the routing table and OMR section below.

## Routing table — pick the pipeline from the source

There is no single algorithm. Branch on what the source actually is. Every row ends the same way: **validate, then visually compare against the source, then `add_sheet`**.

| Input | Pipeline | Tools, in order |
|-------|----------|-----------------|
| **Pasted text or a URL** the user already has | Unchanged from ADR-0006 — this skill does not own it. Use the in-app `/add` import flow. | — |
| **Screenshot with chord symbols, lyrics, or tab** | **Path A (vision-direct)**, always. OMR destroys chord text (see below). | read image → transcribe to ABC/tab → `validate_notation` → compare → `add_sheet` |
| **Screenshot of a single-staff melody** (lead sheet, folk tune, chart) | **Path A (vision-direct)**. | as above |
| **Screenshot of a dense/multi-voice score** (grand staff, polyphony, roughly ≥40 notes or continuous 16th-note runs) | **Path B (OMR-assisted)** — let Audiveris do the pixel work, you do the judgment. | Audiveris → MusicXML → `validate_notation`(musicxml) → clean up → normalize to ABC → `validate_notation`(abc) → compare → `add_sheet` |
| **YouTube — Synthesia / falling-notes tutorial** | Frame-to-MIDI. Viable end-to-end on clean input (ticket 007); per-video tuning required. | `downloadAudio`-style `yt-dlp` video pull → `extractFrames` → `framesToMidi` → `midiToNotation` → `validate_notation`(musicxml) → review pass → ABC → compare → `add_sheet` |
| **YouTube — video showing actual sheet music** | Sample frames, dedupe repeated pages, then feed the distinct pages into the screenshot rows above (Path A or B by density). | `extractFrames` → dedupe → screenshot pipeline |
| **YouTube — audio-only / performance video**, or a local audio file | Audio-to-MIDI. Timing is rough by design — the review pass cleans it. | `downloadAudio` → `audioToMidi` → `midiToNotation` → `validate_notation`(musicxml) → review pass → ABC → compare → `add_sheet` |

### Path A vs. Path B — the decided rule (ticket 005)

The A-vs-B choice was left open in ADR-0007 and settled by the ticket-005 spike. The finding that sharpens the ADR's simple/dense heuristic: **Audiveris systematically discards chord symbols**, sometimes misreading the letters as `p`/`pp` dynamics. Chord charts and lead sheets are this collection's most common material, so:

- **Anything chart-like — chord symbols, lyrics, tab — is Path A, regardless of how simple or dense it looks.** OMR would delete the most valuable content.
- OMR (Path B) earns its place only on dense, purely-notated multi-voice material (clean digital renders), where it preserves ~80–90% of notes with voice imitation and chord verticals intact, and cleaning ~5–10 errors beats transcribing 100+ notes from scratch.

Caveat on the spike's confidence: its corpus was self-rendered, so Path A's first-pass accuracy is overstated. On genuinely unfamiliar dense scores, vision transcription errors scale with note count — which is exactly why dense material routes to OMR.

## ABC conventions for this collection

Piano (and any staff-notation) content is ABC, per ADR-0005 §2. Produce ABC in the subset the collection already uses — do not reinvent per song. These conventions come from the ADR-0005 examples and the ticket-005 corpus (`scripts/fixtures/screenshot-corpus/*.abc`).

**Header block**, in this order:

```
X:1                 tune number, always 1 for a single stored song
T:Title             title
C:Composer          composer / "Traditional" / "attr. …" (optional but preferred)
M:6/8               meter
L:1/8               default note length (unit)
K:Am                key
```

**Body conventions:**

- **Chord symbols** ride above the note in double quotes: `"Am"c2 d e`, `"G"d2 B`. This is the content OMR drops — preserve it, it is why chart material is Path A.
- **Grand staff (two hands)** uses an explicit voice layout:
  ```
  %%score {1 | 2}
  V:1 clef=treble
  V:2 clef=bass
  K:G
  [V:1] d2 (GA Bc) | d2 G2 G2 |
  [V:2] [G,B,D]4 A,2 | B,2 G,2 z2 |
  ```
- **Chords (simultaneous notes)** are bracketed: `[G,B,D]`. SATB or multi-voice-per-staff material may be stored merged into chords — acceptable for this collection.
- **Octaves:** commas lower (`G,`, `D,`), apostrophes raise (`c'`). Uppercase is the lower octave, lowercase the upper.
- **Accidentals:** `^` sharp, `_` flat, `=` natural — e.g. `^G`, `=F`.
- **Rhythm:** `>` / `<` for dotted (broken) rhythm (`e>f`), digits for multiples of the unit length (`c2`, `A3`), `/` for divisions (`B/G/`).
- **Slurs** `(...)`, **ties** `-` (`d6- | d4`), **rests** `z`, **repeats** `:|`, final barline `|]`.

Guitar content is not ABC — it stays monospace tab text (fret numbers on string lines), stored verbatim. `capo` is a guitar/ukulele column; piano rows leave it null.

## OMR error patterns and corrections (Path B)

Concrete misreads observed feeding the ticket-005 corpus through Audiveris. Apply the correction before or during the cleanup pass:

1. **Chord symbols dropped, sometimes as fake dynamics.** Every chord symbol was lost; some letters became `p`/`pp`. → Never route chart material to OMR (see Path A rule). When OMR is right for the material, re-add any chord symbols by reading the source.
2. **Spurious dynamics appear in nearly every export** (invented from text or slur curves). → Delete them; they are cheap, predictable removals.
3. **Decorative/tempo glyphs hallucinate into music.** A broken tempo-mark glyph became an invented octave-shift (ottava). → Crop the screenshot to just the music before running OMR; delete any ottava/dynamic that has no source.
4. **Structurally valid ≠ accurate.** All six corpus exports passed `validate_notation(musicxml)` while containing wrong notes and octaves (~3–8 pitch/octave errors each). → A clean validation is necessary but not sufficient; the visual compare against the source is mandatory.
5. **Input quality drives OMR quality.** Feed ≥~2000 px wide, white background, cropped to the music. Phone-photo artifacts degrade results sharply.

**Running Audiveris** (macOS, installed per ticket 005):

```bash
~/tools/Audiveris.app/Contents/MacOS/Audiveris -batch -export -output <out-dir> <image.png>
# ~30 s/page → <out-dir>/<name>.mxl  (a zip container)
unzip <name>.mxl              # yields <name>.xml (MusicXML)
npx tsx scripts/lib/validate-cli.ts musicxml <name>.xml render.png
```

The app bundles its own Java runtime (no system Java needed). Install from the official GitHub release dmg if it is ever missing.

## Media-pipeline correction patterns

The video/audio pipelines produce a **draft MIDI** — pitch-accurate but rough on timing, octave, and hands. Expect these and fix them in the review pass, not by trusting the raw output:

- **Falling-notes timing looks like triplet/dotted clutter.** The detector emits `delta_frames × fps` ticks against a 480-tick/beat default, so quarter notes can land at ~360 ticks (0.75 beat). Underlying timing is uniform and clean — infer the beat from the *dominant* note duration and re-quantize, rather than trusting music21's notated durations.
- **Absolute octave is a heuristic guess.** Middle C is chosen by a key-width pattern match; relative pitches are reliable but the whole thing can render an octave off / in the wrong clef. Set the octave from the video's on-screen key labels or by ear.
- **Both hands land in one track.** No hand separation — music21 renders one dense voice. Split melody/bass into `V:1`/`V:2` as a judgment call.
- **Falling-notes calibration must be tuned per video** (see Known Limitations).
- **Audio-to-MIDI needs clear note onsets.** Without re-articulation between repeated notes they merge (`C C` → one long `C`). Real recordings have natural attacks; watch for merged repeats on sustained or synthetic sources. Rhythm will be rough — this is expected draft quality, the review pass owns cleaning it.

## Validation-loop protocol

Never trust a single transcription pass. It is a draft, not the answer. The loop, explicitly:

1. **Transcribe** the source to candidate notation (ABC for piano, tab for guitar; MusicXML as a transit format for OMR/media paths).
2. **Validate.** Call `validate_notation` (or `validate-cli.ts` from bash). On **parse/render errors**, fix the notation and re-validate. Repeat until it renders.
3. **Visually compare** the rendered PNG against the source screenshot/frame. Check pitches, octaves, bar count, accidentals, ties, chord symbols, hand split. A clean render does **not** mean a correct transcription (see OMR finding 4).
4. **On any mismatch, correct and return to step 2.** Do not shortcut.
5. **Only once it renders cleanly and matches the source**, call `list_sheets` to confirm it is not a duplicate, then `add_sheet` (or `update_sheet`). Record `sourceUrl` when the source was a URL.

## Known limitations

Carried forward from the spikes; state them plainly rather than as open ADR questions.

- **Falling-notes pipeline is viable but needs per-video tuning (ticket 007).** A working converter was found — `41pha1/MIDI-Converter`, installed at `~/tools/MIDI-Converter`. It has **no published license**, so the posture is local personal evaluation only: not vendored into this repo, not redistributed, invoked from `~/tools`. Two knobs almost always need setting per video:
  - `startSeconds` — the tool baselines key brightness at this frame. Intro fades to black fail with "Did not detect a valid keyboard" (exit 2). Point it at a frame where the keyboard is visible and unpressed (~3 s is common). Inspect an extracted frame to choose it.
  - `keyboardHeight` — the default ratio (0.85) can sample the wood below the keys and miss them entirely; ~0.6 crosses the black-key region on the standard Synthesia layout. The `start_frame.jpg` overlay the tool drops into the frame dir is the tuning feedback loop.

  The detector reports some errors on **stdout** rather than stderr; the pipeline's `runCommand` already falls back to stdout so failures stay descriptive.
- **OMR needs clean, high-resolution, cropped digital renders** to hit ~80–90%. It is not a phone-photo transcriber, and it is never right for chart material.
- **Audio-to-MIDI timing is rough by design.** Quantization cleanup is a Claude review-pass judgment, not automated. Pitch order is generally reliable; rhythm is not.
- **Quality varies with source.** Dense polyphony, noisy audio, and non-standard tutorial styles still challenge every path. The validation loop reduces bad output; it does not guarantee a perfect transcription. When a source resists all paths, hand-transcription remains the fallback — but as of the ticket-007 spike, no source class required it.
