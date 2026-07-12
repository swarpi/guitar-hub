# Local Media Tooling — Audio-to-MIDI Pipeline

Setup and usage for the sheet-ingest audio pipeline (ADR-0007 §2–3, ticket
sheet-ingest/006). The pipeline takes a YouTube URL or local audio file and
produces MusicXML for the Claude review pass:

```
YouTube URL ──yt-dlp──► .wav ──basic-pitch──► .mid ──music21──► MusicXML ──► validate_notation
```

Everything runs locally, never on the edge (ADR-0007 §6). Claude Code drives
the steps via `bash`/`tsx`; they are deliberately not MCP tools.

## Requirements

| Tool | Role | Install |
|------|------|---------|
| `yt-dlp` | YouTube → audio extraction | `brew install yt-dlp` |
| `ffmpeg` | Audio conversion backend for yt-dlp | `brew install ffmpeg` |
| Python 3.11 venv | Runs `basic-pitch` + `music21` | see below |
| Audiveris | OMR for screenshots (ticket 005, not this pipeline) | see `tickets/sheet-ingest/005-*.md` Notes |

### Python environment

Managed with `uv` (per `conventions/python.md`), pinned in
`scripts/lib/requirements.txt`, installed into `scripts/lib/.venv-audio`
(gitignored). From the repo root:

```bash
uv venv scripts/lib/.venv-audio --python 3.11
uv pip install --python scripts/lib/.venv-audio/bin/python -r scripts/lib/requirements.txt
```

Version constraints that matter (all discovered the hard way on macOS x86_64,
2026-07):

- **Python 3.11, not newer.** `basic-pitch`'s resolution pulls
  `tensorflow-macos`, which has no cp312+ wheels on Intel macOS.
- **`numba==0.60.0` / `llvmlite==0.43.0`.** Later versions dropped macOS
  x86_64 wheels; these are the last with cp311 wheels (pulled in via
  `basic-pitch` → `resampy`).
- **`onnxruntime`.** basic-pitch needs at least one inference backend; ONNX
  is the portable choice (no TensorFlow install required).
- **`setuptools<81`.** `resampy` imports `pkg_resources`, which uv venvs
  don't ship and setuptools ≥ 81 removed.

Verify the install:

```bash
scripts/lib/.venv-audio/bin/basic-pitch --help
scripts/lib/.venv-audio/bin/python -c "import music21; print(music21.__version__)"
```

## How Node invokes the tools

`scripts/lib/audio-pipeline.ts` shells out with `child_process.spawn`
(same pattern as `scripts/ai-proxy.ts`): stdout/stderr are collected, and a
non-zero exit or spawn failure rejects with an `Error` carrying the tool's
stderr. Binaries resolve to `yt-dlp` on PATH and the venv's `basic-pitch` /
`python`; override with the `AUDIO_PIPELINE_YT_DLP`,
`AUDIO_PIPELINE_BASIC_PITCH`, or `AUDIO_PIPELINE_PYTHON` env vars.

| Export | Shells out to | Notes |
|--------|---------------|-------|
| `downloadAudio(youtubeUrl, outputPath)` | `yt-dlp --extract-audio --audio-format wav` | `outputPath` must end in `.wav`; the output template uses `%(ext)s` so yt-dlp's post-extraction rename lands on the requested path |
| `audioToMidi(audioPath, outputMidiPath)` | `.venv-audio/bin/basic-pitch <out-dir> <audio>` | basic-pitch names its output `<stem>_basic_pitch.mid`; the wrapper renames it to `outputMidiPath`. basic-pitch refuses to overwrite — delete stale outputs before re-running |
| `midiToNotation(midiPath)` | `.venv-audio/bin/python scripts/lib/midi_to_musicxml.py <midi>` | Returns `{ musicxml }` from the script's stdout |

`midi_to_musicxml.py` is the music21 boundary: parse MIDI, export MusicXML
to stdout, diagnostics to stderr. Quantization cleanup is deliberately *not*
automated — ADR-0007 assigns that to the Claude review pass.

## Manual end-to-end walkthrough

From the repo root, with `$WORK` as any scratch directory:

```bash
# 1. Get audio — from YouTube… (drive via a small .mts script; tsx --eval
#    compiles to CJS and rejects top-level await)
cat > $WORK/run.mts <<'EOF'
import { downloadAudio, audioToMidi, midiToNotation } from "./scripts/lib/audio-pipeline.ts";
import { writeFileSync } from "node:fs";
const W = process.env.WORK!;
await downloadAudio("https://www.youtube.com/watch?v=<id>", `${W}/clip.wav`);
await audioToMidi(`${W}/clip.wav`, `${W}/clip.mid`);
const { musicxml } = await midiToNotation(`${W}/clip.mid`);
writeFileSync(`${W}/clip.musicxml`, musicxml);
EOF
WORK=$WORK npx tsx $WORK/run.mts

# 2. …or start from a local audio file and skip downloadAudio.

# 3. Validate and render the MusicXML (ticket 004 validator):
npx tsx scripts/lib/validate-cli.ts musicxml $WORK/clip.musicxml $WORK/render.png

# 4. Visually compare render.png against the source; clean up in the Claude
#    review pass; normalize to ABC/tab; validate again; then add_sheet.
```

A committed reference run (synthesized 8-second "Twinkle Twinkle" clip →
MIDI → MusicXML → rendered PNG) lives in
`scripts/fixtures/audio-pipeline-e2e/`; outcome details are in the ticket
006 Notes.

## Falling-notes videos (ticket 007)

Synthesia-style tutorials route through `scripts/lib/falling-notes-pipeline.ts`
instead of basic-pitch:

```
YouTube URL ──yt-dlp──► .mp4 ──extractFrames (ffmpeg, 30 fps)──► frames/ ──framesToMidi──► .mid ──music21──► MusicXML
```

`framesToMidi` wraps [41pha1/MIDI-Converter](https://github.com/41pha1/MIDI-Converter)
(selection rationale and failure modes: ticket 007 Notes), installed outside
this repo — it has no published license, so it is used for local personal
evaluation only, never vendored or redistributed:

```bash
git clone https://github.com/41pha1/MIDI-Converter ~/tools/MIDI-Converter
uv venv ~/tools/MIDI-Converter/.venv --python 3.11
uv pip install --python ~/tools/MIDI-Converter/.venv/bin/python opencv-python numpy mido pytube
```

Override locations with `FALLING_NOTES_TOOL_DIR` / `FALLING_NOTES_PYTHON` /
`FALLING_NOTES_FFMPEG`. Real videos need per-video tuning via
`framesToMidi`'s options: `startSeconds` (a moment where the keyboard is
visible and unpressed — intro fades break the default of 0) and
`keyboardHeight` (~0.6 for standard Synthesia layouts; the sample row must
cross the black keys). The tool drops a `start_frame.jpg` detection overlay
into the frame dir — inspect it when tuning. A committed reference run lives
in `scripts/fixtures/falling-notes-e2e/`.

## Expectations and known behavior

- **Transcription is rough by design.** Repeated notes with soft attacks get
  merged; durations quantize oddly (dotted rests, split notes). ADR-0007
  treats basic-pitch output as a draft for the review pass, not an answer.
- **basic-pitch startup is slow** (~10–20 s model load) and prints
  scikit-learn/backend warnings to stderr; they are harmless.
- **music21 titles the score "Fragment"** and inserts metronome marks that
  Verovio renders as `?` boxes; both disappear during ABC normalization.
