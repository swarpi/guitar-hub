# Ticket: Local Media Tooling Setup and Audio-to-MIDI Pipeline

**Feature:** sheet-ingest
**Status:** Open
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

- [ ] Local tooling setup is documented in `scripts/lib/README.md` (or equivalent): `yt-dlp`, `ffmpeg`, Python 3 with `basic-pitch` and `music21` installed, including exact install commands (`brew install yt-dlp ffmpeg`, `pip install basic-pitch music21`, or a `requirements.txt` if a Python venv is used) and how the Node MCP server invokes them (`child_process.spawn`, matching the existing shell-out pattern in `scripts/ai-proxy.ts`)
- [ ] A module `scripts/lib/audio-pipeline.ts` exports `downloadAudio(youtubeUrl: string, outputPath: string): Promise<void>` that shells out to `yt-dlp` to extract audio-only from a YouTube URL to a local file
- [ ] The same module exports `audioToMidi(audioPath: string, outputMidiPath: string): Promise<void>` that shells out to `basic-pitch`'s CLI to produce a MIDI file from an audio file
- [ ] The same module exports `midiToNotation(midiPath: string): Promise<{ musicxml: string }>` that shells out to a small `music21` Python script (checked into the repo, e.g. `scripts/lib/midi_to_musicxml.py`) to convert MIDI to MusicXML text
- [ ] Each shelled-out step throws a descriptive `Error` (including the tool's stderr) on non-zero exit, rather than failing silently
- [ ] The resulting MusicXML is validated using `validate_notation` (ticket 004) as part of a documented manual walkthrough — not necessarily a new MCP tool, since Claude Code drives this pipeline via `bash` per ADR-0007 §1's architecture diagram
- [ ] An end-to-end manual run is documented: one public-domain or user-owned audio clip (e.g., a simple monophonic guitar or piano recording) taken through download → audio extraction → `basic-pitch` → `music21` → `validate_notation`, with the outcome (rendered PNG or errors) recorded in this ticket's Notes
- [ ] Unit tests cover the pure/parsing pieces where feasible (e.g., stderr-to-Error formatting, output path construction) using mocked `child_process.spawn`, following the no-network-I/O-in-unit-tests convention established in `scripts/url-import.test.ts`
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Falling-notes frame-to-MIDI extraction — ticket 007
- Wiring this pipeline into an MCP tool call (e.g., an `ingest_audio` tool) — ADR-0007's architecture has Claude Code drive the pipeline directly via `bash`, not necessarily through a dedicated MCP tool; if a tool wrapper turns out to be useful it can be added as a follow-up, not required here
- Quantization cleanup/correction logic — ADR-0007 explicitly expects this to be "rough" and handled by a Claude review pass, not automated
- MIDI → ABC conversion specifically (vs. MusicXML) — `music21` outputs MusicXML; the MusicXML → ABC step is a Claude Code judgment/transcription task during the review pass, not a mechanical conversion this ticket automates

## Notes

- `basic-pitch` and `music21` are Python, while the rest of this project is TypeScript/Node. The cleanest boundary is small, single-purpose Python scripts invoked as subprocesses (mirroring how `scripts/ai-proxy.ts` shells out to the `claude` CLI) rather than introducing a Python-Node RPC bridge.
- Confirm during implementation whether `basic-pitch` is invoked via its CLI (`basic-pitch <output-dir> <audio-file>`) or its Python API through a wrapper script — the CLI is simpler and sufficient for this ticket's scope.
- `yt-dlp` audio extraction should target a compressed intermediate (e.g., `--extract-audio --audio-format wav`) since `basic-pitch` expects a standard audio file, not a video container.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
