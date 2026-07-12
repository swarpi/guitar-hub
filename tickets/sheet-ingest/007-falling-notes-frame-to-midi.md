# Ticket: Falling-Notes Video Frame-to-MIDI Pipeline (Spike)

**Feature:** sheet-ingest
**Status:** Done
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

- [x] At least two candidate open-source frame-to-MIDI / falling-notes-detection projects are evaluated (search terms: "synthesia video to midi", "piano roll video OMR", "falling notes detector"); the choice and rejected alternatives are documented in this ticket's Notes
- [x] The selected project is installed locally and its license is compatible with local personal use (documented)
- [x] A module `scripts/lib/falling-notes-pipeline.ts` exports `extractFrames(videoPath: string, outputDir: string): Promise<void>` that shells out to `ffmpeg` to sample frames at a rate sufficient for key-press detection (document the chosen frame rate and why)
- [x] The same module exports `framesToMidi(frameDir: string, outputMidiPath: string): Promise<void>` wrapping the chosen frame-to-MIDI project
- [x] The resulting MIDI is converted to MusicXML using the `midiToNotation` function from ticket 006 (no duplicated `music21` invocation logic)
- [x] An end-to-end manual run is documented: one real falling-notes tutorial video (public, e.g. a simple public-domain melody tutorial) taken through download → frame extraction → frame-to-MIDI → `music21` → `validate_notation` (ticket 004), with the outcome recorded in this ticket's Notes, including known failure modes observed (e.g., missed notes, false positives on sustained notes)
- [x] Unit tests cover the shell-out plumbing (argument construction, error propagation on non-zero exit) with mocked `child_process.spawn`, matching the pattern from ticket 006
- [x] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Videos showing actual sheet music (the "sample frames, dedupe, feed into the screenshot pipeline" case from ADR-0007 §2) — that path reuses the screenshot ingestion pipeline (ticket 005) with a frame-sampling/dedup step in front of it; if that dedup step is needed it is a small follow-up, not part of this ticket
- Audio-only performance videos — ticket 006
- Robustness across arbitrary falling-notes video styles (different color schemes, camera angles, video quality) — this ticket proves the pipeline works end-to-end on one clean example; broader robustness is refined by the skill's documented failure patterns (ticket 008) as real videos are ingested over time

## Notes

- This is the hardest and least certain pipeline in ADR-0007 — the ADR itself flags the frame-to-MIDI converter as an open question (Assumption 5). If no existing open-source project produces usable results after reasonable investigation, document that finding clearly; a documented "this path needs more work / manual transcription is currently the fallback" outcome is an acceptable result for a spike ticket and should still be captured in the skill (ticket 008) rather than silently dropped.
- Keep `framesToMidi`'s internals swappable — if the chosen project changes later, the module boundary (frames in, MIDI out) should not need to change at call sites.

### Spike results (2026-07-06)

**Candidate evaluation.**

| Project | Verdict | Reason |
|---------|---------|--------|
| [41pha1/MIDI-Converter](https://github.com/41pha1/MIDI-Converter) | **Selected** | Python 3, ~170-line headless CLI, pip-installable deps (opencv-python, numpy, mido), 77 stars; brightness-delta detection against per-key baselines; source fully code-reviewed before running |
| [svsdval/video2midi](https://github.com/svsdval/video2midi) | Rejected | Most mature of the field, but interactive pygame/OpenGL GUI (manual keyboard calibration, press Q) — not automatable headless |
| [alborrajo/sheetesia](https://github.com/alborrajo/sheetesia) | Rejected | GPL-3.0 and headless (cleanest license), but Rust + opencv crate 0.49 (~2021) — no local Rust toolchain, and old opencv bindings against brew OpenCV 4.12 is a high-risk bitrot build |
| [emilamaj/SynToMid](https://github.com/emilamaj/SynToMid) | Rejected | Own README: note extraction "very buggy, not yet usable" |
| [devbridie/synthesiavideo2midi](https://github.com/devbridie/synthesiavideo2midi) | Rejected | Python 2 (`sys.maxint`, `cmp`), dead `python-midi` git dependency over the removed `git://` protocol |
| [tu500/synthesia_to_midi](https://github.com/tu500/synthesia_to_midi) | Rejected | Frames-native interface (best boundary fit) but Python 2-only MIDI step, self-described "hacked together on one afternoon" |

**Install and license.** Cloned to `~/tools/MIDI-Converter` (alongside Audiveris; user approved running it 2026-07-06) with its own uv venv (Python 3.11: opencv-python, numpy, mido, pytube). **License: none published** — default copyright applies, so the posture is local personal evaluation only: not vendored into this repo, not redistributed, invoked from `~/tools`. If the project later adds a restrictive license or a frames-native GPL alternative matures, `framesToMidi`'s internals swap without call-site changes.

**Frame rate: 30 fps.** Two reasons, both documented in the module: (1) 16th notes at 120 bpm last ~125 ms, so 33 ms sampling resolves press/release with margin; (2) the tool's MIDI tick arithmetic (`delta_frames × fps` against mido's default 960 ticks/s) only approximates real time near 30 fps — other stitched rates compress all durations uniformly.

**Interface note.** The tool consumes a video, not frames, so `framesToMidi` stitches the sampled JPEG frames back into an `.mp4` at 30 fps (lossless enough — detection is brightness-threshold based) before invoking it. JPEG over PNG for frames: PNG for one minute of 720p runs to gigabytes.

**E2E run.** Source: "Twinkle Twinkle Little Star — EASY Piano Tutorial by PlutaX - Synthesia" (YouTube `zE0Fwm7gv1c`, 47 s, 1280×720@24, public-domain melody), downloaded with `yt-dlp -f "bv*[ext=mp4][height<=720]"`. `extractFrames` produced 1,425 frames (~50 s wall time); `framesToMidi` ran in ~15 s; `midiToNotation` (ticket 006, unmodified) in ~0.5 s; `validate_notation(musicxml)` returned **VALID** and rendered. Artifacts in `scripts/fixtures/falling-notes-e2e/`.

**Detection quality: strong.** All keys of the on-screen keyboard were found (verified via the tool's `start_frame.jpg` overlay), and the MIDI contains the full melody with correct relative pitches — `60 60 67 67 69 69` (C C G G A A) then `65 65 64 64 62 62 60` (F F E E D D C) — plus the arrangement's bass notes (C3/F3/D3). Repeated notes are cleanly separated (Synthesia videos show a release gap between re-articulations), with consistent ~360-tick quarter-note durations. No missed melody notes, no false positives from sustained notes observed in this clean-source run.

**Observed failure modes (input for the ticket 008 skill).**

1. **Default calibration fails on intro fades.** The tool baselines key brightness at `startSeconds` (default 0); this video opens on a black fade → "Did not detect a valid keyboard", exit 2. Fix: `startSeconds` pointing at a frame where the keyboard is visible and unpressed (3 s here). Inspect an extracted frame to choose it.
2. **Default keyboard-height ratio (0.85) misses the keys.** It sampled the wood texture below the keyboard. The sample row must cross the black-key region — ~0.6 on the standard Synthesia layout. The `start_frame.jpg` overlay dropped into the frame dir is the tuning feedback loop.
3. **Systematic tick-scale mismatch.** The tool emits `delta_frames × fps` ticks against mido's 480 ticks/beat default, so this tutorial's quarter notes land at 360 ticks = 0.75 beat → music21 renders dotted-note/tie/triplet clutter everywhere despite clean underlying timing. Uniform and correctable — the Claude review pass should infer the beat from the dominant duration (here 360 ticks) rather than trusting notated durations.
4. **Absolute octave registration is heuristic.** Middle C is picked as the middle candidate of a pattern match over key widths; this run landed the melody around C4 but rendered in bass clef/low register. Relative pitches are reliable; the review pass should set the octave from the video's key labels (this video labels C3) or by ear.
5. **No hand separation.** Both hands land in one MIDI track; music21 renders one dense voice. Splitting melody/bass is a review-pass judgment call.
6. **Tool reports errors on stdout.** `runCommand` was extended to fall back to stdout in the thrown Error when stderr is empty, so failures stay descriptive.

**Bottom line:** the pipeline is viable end-to-end on clean Synthesia-style input — pitch-accurate, structurally complete MIDI with rough-but-uniform timing, matching ADR-0007's "draft for the review pass" expectation. Manual transcription is not needed as a fallback for this video class; per-video tuning (`startSeconds`, `keyboardHeight`) is the price of admission and belongs in the skill's protocol.

## Implementation Plan

Candidate selection (done, details in Notes): **41pha1/MIDI-Converter** — Python 3, ~170-line headless CLI, pip-installable deps (opencv-python, numpy, mido), brightness-delta key-press detection. Rejected: svsdval/video2midi (interactive GUI, not automatable), alborrajo/sheetesia (Rust + opencv crate 0.49 bitrot, no local Rust toolchain), emilamaj/SynToMid (README says note extraction "not yet usable"), devbridie/synthesiavideo2midi and tu500/synthesia_to_midi (Python 2, dead `python-midi` git dependency).

Interface note: the chosen tool consumes a *video*, not a frame directory. `framesToMidi(frameDir, outputMidiPath)` honors the ticket's frames-in/MIDI-out boundary by losslessly stitching the sampled frames back into a video at the sampled frame rate (ffmpeg image2 demuxer) before invoking the tool — internals stay swappable if a frames-native detector is adopted later.

1. Install: clone MIDI-Converter to `~/tools/MIDI-Converter` (alongside Audiveris; not vendored into this repo), `uv venv` + deps. Document license posture (no published license → local personal evaluation only, not redistributed).
2. `scripts/lib/falling-notes-pipeline.ts`: `extractFrames(videoPath, outputDir)` (ffmpeg `fps=30` sampling — rationale documented in Notes) and `framesToMidi(frameDir, outputMidiPath)` (stitch + run tool), reusing `runCommand` from `audio-pipeline.ts`; pure arg-builder helpers exported for tests; env overrides for tool/python paths.
3. Unit tests with mocked `spawn`, matching the ticket 006 pattern (arg construction, error propagation, no network).
4. E2E: yt-dlp-download one clean public falling-notes tutorial of a simple melody, run download → extractFrames → framesToMidi → `midiToNotation` (ticket 006, no duplicated music21 logic) → `validate-cli musicxml` → PNG; record outcome + observed failure modes in Notes.
5. `pnpm test` / `pnpm lint` / `pnpm build`; update STATUS.md; invoke `/ticket-verifier`.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
