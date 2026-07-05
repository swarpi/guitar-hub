# Ticket: Falling-Notes Video Frame-to-MIDI Pipeline (Spike)

**Feature:** sheet-ingest
**Status:** Open
**Priority:** P3
**Estimate:** M
**Related:** ADR-0007 (Decision §2 "Synthesia-style falling-notes tutorials"), Assumption 5 ("frame-to-MIDI converter is referenced generically")
**Depends on:** sheet-ingest/006

## Context

Most piano tutorials on YouTube are "falling notes" (Synthesia-style) videos — effectively visual MIDI. ADR-0007 routes these through frame extraction (`yt-dlp` + `ffmpeg`) and per-frame key-press detection, referencing that open-source projects already do this frame-to-MIDI conversion, then `music21` for MIDI → MusicXML (§2, §3). The ADR is explicit that this is directional, not fixed: "a specific project needs selection during prototyping" (Assumption 5).

This ticket is therefore a spike: select a concrete open-source frame-to-MIDI project, wire it into the `yt-dlp`/`ffmpeg` tooling from ticket 006, and validate the output end-to-end on one real tutorial video. It depends on ticket 006 for the shared `yt-dlp`/`ffmpeg` download-and-extract plumbing and its `midiToNotation` function.

## Goal

A working pipeline that takes a falling-notes tutorial video, extracts frames, detects key presses to produce MIDI, converts to MusicXML via `music21`, and validates the result — with the chosen frame-to-MIDI project documented for reuse in the skill.

## Acceptance Criteria

- [ ] At least two candidate open-source frame-to-MIDI / falling-notes-detection projects are evaluated (search terms: "synthesia video to midi", "piano roll video OMR", "falling notes detector"); the choice and rejected alternatives are documented in this ticket's Notes
- [ ] The selected project is installed locally and its license is compatible with local personal use (documented)
- [ ] A module `scripts/lib/falling-notes-pipeline.ts` exports `extractFrames(videoPath: string, outputDir: string): Promise<void>` that shells out to `ffmpeg` to sample frames at a rate sufficient for key-press detection (document the chosen frame rate and why)
- [ ] The same module exports `framesToMidi(frameDir: string, outputMidiPath: string): Promise<void>` wrapping the chosen frame-to-MIDI project
- [ ] The resulting MIDI is converted to MusicXML using the `midiToNotation` function from ticket 006 (no duplicated `music21` invocation logic)
- [ ] An end-to-end manual run is documented: one real falling-notes tutorial video (public, e.g. a simple public-domain melody tutorial) taken through download → frame extraction → frame-to-MIDI → `music21` → `validate_notation` (ticket 004), with the outcome recorded in this ticket's Notes, including known failure modes observed (e.g., missed notes, false positives on sustained notes)
- [ ] Unit tests cover the shell-out plumbing (argument construction, error propagation on non-zero exit) with mocked `child_process.spawn`, matching the pattern from ticket 006
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Videos showing actual sheet music (the "sample frames, dedupe, feed into the screenshot pipeline" case from ADR-0007 §2) — that path reuses the screenshot ingestion pipeline (ticket 005) with a frame-sampling/dedup step in front of it; if that dedup step is needed it is a small follow-up, not part of this ticket
- Audio-only performance videos — ticket 006
- Robustness across arbitrary falling-notes video styles (different color schemes, camera angles, video quality) — this ticket proves the pipeline works end-to-end on one clean example; broader robustness is refined by the skill's documented failure patterns (ticket 008) as real videos are ingested over time

## Notes

- This is the hardest and least certain pipeline in ADR-0007 — the ADR itself flags the frame-to-MIDI converter as an open question (Assumption 5). If no existing open-source project produces usable results after reasonable investigation, document that finding clearly; a documented "this path needs more work / manual transcription is currently the fallback" outcome is an acceptable result for a spike ticket and should still be captured in the skill (ticket 008) rather than silently dropped.
- Keep `framesToMidi`'s internals swappable — if the chosen project changes later, the module boundary (frames in, MIDI out) should not need to change at call sites.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
