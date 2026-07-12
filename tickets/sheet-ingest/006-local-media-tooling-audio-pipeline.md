# Ticket: Local Media Tooling Setup and Audio-to-MIDI Pipeline

**Feature:** sheet-ingest
**Status:** Done
**Priority:** P2
**Estimate:** M
**Related:** ADR-0007 (Decision §2 "YouTube videos", §3 "MIDI as Intermediate Format")
**Depends on:** sheet-ingest/002, sheet-ingest/004

## Context

ADR-0007 routes audio-only and performance-video content through a MIDI intermediate: `basic-pitch` (Spotify's open-source audio-to-MIDI model) extracts a MIDI transcription from audio, then `music21` converts MIDI to MusicXML/ABC for a Claude review pass (§2 "Audio-only / performance videos", §3). This is the more tractable of the two YouTube pipelines — it does not require frame-by-frame video analysis, only audio extraction and a single ML model. The falling-notes frame-to-MIDI pipeline (§2 "Synthesia-style" videos) is a separate, harder problem and is its own ticket (007).

This ticket also covers the shared local tooling setup — `yt-dlp` and `ffmpeg` — that both this pipeline and ticket 007 depend on, since installing and documenting them once here avoids duplicating setup instructions across two tickets.

## Goal

A working local pipeline that takes a YouTube URL or local audio file, extracts audio, runs `basic-pitch` to get MIDI, converts MIDI to MusicXML/ABC via `music21`, and validates the result with `validate_notation`.

## Acceptance Criteria

- [x] Local tooling setup is documented in `scripts/lib/README.md` (or equivalent): `yt-dlp`, `ffmpeg`, Python 3 with `basic-pitch` and `music21` installed, including exact install commands (`brew install yt-dlp ffmpeg`, `pip install basic-pitch music21`, or a `requirements.txt` if a Python venv is used) and how the Node MCP server invokes them (`child_process.spawn`, matching the existing shell-out pattern in `scripts/ai-proxy.ts`)
- [x] A module `scripts/lib/audio-pipeline.ts` exports `downloadAudio(youtubeUrl: string, outputPath: string): Promise<void>` that shells out to `yt-dlp` to extract audio-only from a YouTube URL to a local file
- [x] The same module exports `audioToMidi(audioPath: string, outputMidiPath: string): Promise<void>` that shells out to `basic-pitch`'s CLI to produce a MIDI file from an audio file
- [x] The same module exports `midiToNotation(midiPath: string): Promise<{ musicxml: string }>` that shells out to a small `music21` Python script (checked into the repo, e.g. `scripts/lib/midi_to_musicxml.py`) to convert MIDI to MusicXML text
- [x] Each shelled-out step throws a descriptive `Error` (including the tool's stderr) on non-zero exit, rather than failing silently
- [x] The resulting MusicXML is validated using `validate_notation` (ticket 004) as part of a documented manual walkthrough — not necessarily a new MCP tool, since Claude Code drives this pipeline via `bash` per ADR-0007 §1's architecture diagram
- [x] An end-to-end manual run is documented: one public-domain or user-owned audio clip (e.g., a simple monophonic guitar or piano recording) taken through download → audio extraction → `basic-pitch` → `music21` → `validate_notation`, with the outcome (rendered PNG or errors) recorded in this ticket's Notes
- [x] Unit tests cover the pure/parsing pieces where feasible (e.g., stderr-to-Error formatting, output path construction) using mocked `child_process.spawn`, following the no-network-I/O-in-unit-tests convention established in `scripts/url-import.test.ts`
- [x] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Falling-notes frame-to-MIDI extraction — ticket 007
- Wiring this pipeline into an MCP tool call (e.g., an `ingest_audio` tool) — ADR-0007's architecture has Claude Code drive the pipeline directly via `bash`, not necessarily through a dedicated MCP tool; if a tool wrapper turns out to be useful it can be added as a follow-up, not required here
- Quantization cleanup/correction logic — ADR-0007 explicitly expects this to be "rough" and handled by a Claude review pass, not automated
- MIDI → ABC conversion specifically (vs. MusicXML) — `music21` outputs MusicXML; the MusicXML → ABC step is a Claude Code judgment/transcription task during the review pass, not a mechanical conversion this ticket automates

## Notes

- `basic-pitch` and `music21` are Python, while the rest of this project is TypeScript/Node. The cleanest boundary is small, single-purpose Python scripts invoked as subprocesses (mirroring how `scripts/ai-proxy.ts` shells out to the `claude` CLI) rather than introducing a Python-Node RPC bridge.
- Confirm during implementation whether `basic-pitch` is invoked via its CLI (`basic-pitch <output-dir> <audio-file>`) or its Python API through a wrapper script — the CLI is simpler and sufficient for this ticket's scope.
- `yt-dlp` audio extraction should target a compressed intermediate (e.g., `--extract-audio --audio-format wav`) since `basic-pitch` expects a standard audio file, not a video container.

### End-to-end run results (2026-07-06)

**Setup outcome.** `yt-dlp 2026.07.04` and `ffmpeg 8.1.2` via Homebrew; Python venv at `scripts/lib/.venv-audio` (uv, Python 3.11) with `basic-pitch 0.4.0` + `music21 10.5.0`. Install friction, all pinned in `scripts/lib/requirements.txt` and explained in `scripts/lib/README.md`: `tensorflow-macos` has no cp312+ wheels on Intel macOS (forces Python 3.11); newer `numba`/`llvmlite` dropped macOS x86_64 wheels (pinned 0.60.0/0.43.0); basic-pitch needs an explicit inference backend (`onnxruntime`); `resampy` needs `pkg_resources` (`setuptools<81`).

**basic-pitch invocation.** CLI confirmed (per the Notes question above): `basic-pitch <output-dir> <audio-file>`, writing `<stem>_basic_pitch.mid`. No Python-API wrapper needed; `audioToMidi` renames the output to the caller's path.

**E2E clip.** Synthesized user-owned clip (no copyright concerns, mirroring the ticket 005 self-authored corpus): first phrase of "Twinkle Twinkle Little Star" (C C G G A A G / F F E E D D C), 8 s of ffmpeg sine tones with ~10 ms attack / ~100 ms release envelopes. Pipeline run via the actual module functions (`audioToMidi` → `midiToNotation`), then `npx tsx scripts/lib/validate-cli.ts musicxml` (ticket 004 validator).

**Outcome: VALID, rendered.** Artifacts committed to `scripts/fixtures/audio-pipeline-e2e/` (MIDI, MusicXML, rendered PNG). All 13 pitch classes correct in order; rhythm is rough as ADR-0007 predicts — one E split into extra short notes, final durations quantized oddly, music21 adds a "Fragment" title and metronome marks that Verovio renders as `?` glyphs. Exactly the draft-quality input the Claude review pass is designed to clean up; no automation added for it (per Out of Scope).

**Envelope finding (matters for the skill, ticket 008):** a first attempt with un-enveloped sine tones caused basic-pitch to merge consecutive repeated notes (C C → one long C) — without re-articulation there is no onset to detect. Real instrument recordings have natural attacks, so this is a synthetic-audio artifact, but it confirms transcription quality depends on clear note onsets.

**`downloadAudio` verified live:** a 19 s YouTube clip extracted to a 3.6 MB WAV through `yt-dlp` with the `%(ext)s` output template (a literal `.wav` output path would have produced `.wav.wav` — the wrapper handles this).

## Implementation Plan

Tooling boundary: `yt-dlp`/`ffmpeg` via Homebrew; `basic-pitch` and `music21` in a project-local Python venv managed with `uv` (per `conventions/python.md`) at `scripts/lib/.venv-audio`, pinned via `scripts/lib/requirements.txt`. The Node module resolves venv binaries by path (overridable via env var) and shells out with `child_process.spawn`, mirroring `scripts/ai-proxy.ts`.

1. Install tooling: `brew install yt-dlp ffmpeg`; `uv venv scripts/lib/.venv-audio --python 3.12` + `uv pip install -r scripts/lib/requirements.txt` (`basic-pitch`, `music21`). Gitignore the venv. Verify each CLI runs.
2. Write `scripts/lib/midi_to_musicxml.py`: music21 script that parses a MIDI file (argv[1]) and writes MusicXML to stdout; errors to stderr with non-zero exit.
3. Write `scripts/lib/audio-pipeline.ts` exporting `downloadAudio`, `audioToMidi`, `midiToNotation`, built on a shared `runCommand` spawn helper that throws a descriptive Error (command, exit code, stderr) on failure. Pure helpers (error formatting, basic-pitch output-path construction, arg building) exported for unit testing. `audioToMidi` handles basic-pitch's `<output-dir>/<stem>_basic_pitch.mid` naming by running into the target directory and renaming to the requested path.
4. Unit tests `scripts/lib/audio-pipeline.test.ts` with mocked `child_process.spawn` (no network, no real binaries), covering stderr-to-Error formatting, arg/path construction, success and failure paths.
5. Write `scripts/lib/README.md`: exact install commands, venv layout, how the Node module invokes the tools, and the manual end-to-end walkthrough including `validate-cli.ts` validation.
6. End-to-end manual run on a user-owned clip: synthesize a simple monophonic melody WAV locally with ffmpeg (sidesteps copyright entirely, mirrors the ticket-005 self-authored-corpus strategy), then audio → basic-pitch → MIDI → music21 → MusicXML → `validate_notation` render; also exercise `downloadAudio` against a public-domain/CC YouTube clip if reachable. Record outcomes in Notes.
7. `pnpm test`, `pnpm lint`, `pnpm build`; update STATUS.md; invoke `/ticket-verifier`.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
