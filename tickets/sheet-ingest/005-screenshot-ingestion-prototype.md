# Ticket: Screenshot Ingestion Prototype — Vision-Direct vs. Audiveris OMR

**Feature:** sheet-ingest
**Status:** Done
**Priority:** P2
**Estimate:** M
**Related:** ADR-0007 (Decision §2 "Screenshots / images", Neutral consequence "A-vs-B image strategy is deferred")
**Depends on:** sheet-ingest/002, sheet-ingest/003, sheet-ingest/004

## Context

ADR-0007 deliberately defers the choice between two screenshot ingestion strategies to a prototype comparison rather than fixing it up front:

- **Path A — vision-direct.** Claude Code reads the image and transcribes straight to ABC.
- **Path B — OMR-assisted.** Audiveris converts the image to MusicXML first; Claude cleans up and validates the OMR output rather than transcribing from scratch.

The ADR states a heuristic hypothesis — vision-direct for simple monophonic/chart material, OMR-assisted for dense scores — but the actual routing rule belongs in the `sheet-ingest/SKILL.md` skill (ticket 008), which needs a decided answer, not an open question, to encode.

This is a spike: its deliverable is a documented outcome and a set of example transcriptions, not a shipped feature. It exercises `add_sheet` and `validate_notation` (tickets 002–004), so it depends on those existing.

## Goal

Run both ingestion paths against a fixed set of test images spanning simple and dense material, and produce a documented recommendation for which path to use per image type.

## Acceptance Criteria

- [x] A test corpus of 6–8 source images is assembled and referenced from `scripts/fixtures/screenshot-corpus/`, spanning at minimum: a simple guitar chord chart, a simple piano lead sheet, a two-hand piano arrangement with multiple voices, and one dense/classical-style score
- [x] For each image, Path A (Claude vision → ABC directly) is run, the output validated with `validate_notation` (ticket 003), and the result (pass/fail, number of correction iterations, final rendered PNG) is recorded
- [x] Audiveris is installed locally and, for each image, Path B (Audiveris → MusicXML → Claude cleanup → ABC) is run, the intermediate MusicXML validated with `validate_notation` (ticket 004), the final ABC validated with `validate_notation` (ticket 003), and the same result data is recorded
- [x] A comparison table (image type × path × outcome × iteration count) is written into this ticket's Notes section, summarizing which path won for which image category
- [x] Audiveris installation steps (Java version, download source, invocation command) are documented in the same Notes section for reuse in the skill
- [x] The recommendation reached here is the input the `sheet-ingest/SKILL.md` routing table (ticket 008) codifies — this ticket does not itself write the skill file
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Writing `sheet-ingest/SKILL.md` — ticket 008 consumes this ticket's findings
- Automating the comparison (a script that runs both paths unattended) — this is a manual, driven-by-Claude-Code spike, not a CI benchmark
- Video frame extraction for the "videos showing sheet music" case — that reuses this same screenshot pipeline once decided, wired up in ticket 007
- Committing copyrighted source images to the repository if that conflicts with the copyright posture in ADR-0007 §6 — see Notes for the fallback

## Notes

- **Copyright caution:** ADR-0007 §6 treats the collection as personal and local, but this repository itself may end up on a remote (even if private). If the chosen test images are copyrighted sheet music, do not commit the source images — instead commit only the transcribed ABC/MusicXML outputs and a text description of each source image (title, complexity characteristics), keeping the actual image files local-only (`.gitignore`d under `scripts/fixtures/screenshot-corpus/`). Public-domain sources (IMSLP, traditional folk tunes) sidestep this entirely and are the preferred choice for the corpus where possible.
- This ticket's value is the documented outcome, not the code. Time-box it — if a clean win/loss pattern emerges after 4–5 images, it is fine to stop before exhausting the full corpus.
- Expect Audiveris setup friction (Java dependency, CLI invocation is not well documented upstream). Budget time for this in the plan-mode session; it is called out explicitly in ADR-0007's Negative consequences ("heavy local dependency footprint").

### Spike results (2026-07-06)

**Setup.** Corpus of six self-rendered public-domain images spanning the required range — see `scripts/fixtures/screenshot-corpus/README.md` for the piece list and rationale. OMR: Audiveris 5.10.2 (macOS x86_64 release build). Both paths' outputs live in `scripts/fixtures/screenshot-corpus/results/` (`pathA-*.abc/.png`, `pathB-*.musicxml/.abc/.png`).

**Comparison table.**

| # | Image type | Path A (vision → ABC) | Path B (Audiveris → MusicXML → cleanup → ABC) | Winner |
|---|-----------|----------------------|-----------------------------------------------|--------|
| 01 | Guitar chord chart (melody + chord symbols) | Pass, 1 validation iteration | MusicXML structurally valid, but all 11 chord symbols lost (some misread as *p*/*pp* dynamics), ~8 pitch/octave errors, hallucinated ottava; cleanup ≈ full retranscription (~20 corrections) | **A, decisively** |
| 02 | Piano lead sheet (6/8, chords, G# accidentals) | Pass, 1 iteration | Melody ~80% correct; all 8 chord symbols lost, hallucinated dynamics and accents, ~3 pitch errors (~15 corrections) | **A** |
| 03 | Folk melody (pickup triplets, natural accidental) | Pass, 1 iteration | Melody ~85–90%; triplets and the natural accidental preserved; ~4 hallucinated dynamics, ~3 pitch/rhythm fixes (~7 corrections) | **A** (B usable) |
| 04 | Two-hand piano, grand staff (Minuet) | Pass, 1 iteration | ~90% correct including the opening chord and slurs; 1 spurious dynamic, ~3 pitch/octave fixes (~4 corrections) | **Tie; B viable** |
| 05 | Dense two-voice counterpoint (16th-note runs) | Pass, 1 iteration (bias caveat below) | ~80–85% of 100+ notes captured, imitation structure intact across staves; ~6 rhythm/pitch fixes, 1 spurious dynamic (~7 corrections) | **B** for real-world use |
| 06 | SATB chorale (four voices, two per staff) | Pass, 1 iteration (bias caveat below) | ~85–90%; SATB voices merged into chords (acceptable for ABC storage), ~2 chord-member fixes, 1 spurious dynamic (~3 corrections) | **B** for real-world use |

All six Audiveris MusicXML exports passed `validate_notation(musicxml)` on the first try; all twelve final ABC outputs passed `validate_notation(abc)` on the first try.

**Bias caveat.** The corpus is self-rendered and the spike driver authored the sources, so Path A's perfect first-pass scores overstate real-world vision accuracy — on genuinely unfamiliar dense scores, vision transcription errors scale with note count. The load-bearing findings are structural and bias-independent: what OMR discards, what it hallucinates, and what it preserves.

**Key findings.**

1. **Audiveris systematically discards chord symbols**, sometimes misreading the letters as dynamics. Chord charts and lead sheets are this app's most common material — for anything with text chords, OMR destroys the most valuable content and Path A wins outright.
2. **Structurally valid ≠ accurate.** Every OMR export passed MusicXML validation while containing wrong notes. The render-and-visually-compare step (ADR-0007 §4) is mandatory, not optional, for both paths.
3. **On dense multi-voice notation OMR preserves structure well** (clean digital renders): ~80–90% of notes with voice imitation and chord verticals intact. Cleanup of ~5–10 errors beats transcribing 100+ notes from scratch.
4. **Decorative/tempo glyphs get hallucinated into music.** An early corpus version had a broken tempo-mark glyph; Audiveris invented an octave-shift marking from it. Screenshots should be cropped to the music before OMR.
5. **Spurious dynamics appear in nearly every OMR output** (from text or slur curves); they are cheap, predictable deletions during cleanup.

**Routing recommendation (input for the ticket 008 skill).**

- Image contains chord symbols, lyrics, or tab → **Path A (vision-direct)**, always.
- Single-staff melody (lead sheet, folk tune, chart) → **Path A**.
- Grand staff, multiple voices, or dense passages (roughly ≥40 notes or continuous 16th-note polyphony) → **Path B**: Audiveris scaffold, then vision-guided cleanup; expect ~5–10 corrections and strip spurious dynamics first.
- Both paths end the same way: `validate_notation`, then visual compare against the source before `add_sheet`.

This matches ADR-0007's heuristic hypothesis, with one sharpening: the chord-symbol finding makes Path A the default for *anything* chart-like, regardless of simplicity.

**Audiveris installation (macOS, documented for the skill).**

1. Download the release dmg for your architecture from https://github.com/Audiveris/audiveris/releases — tested: `Audiveris-5.10.2-macosx-x86_64.dmg` (~75 MB; an arm64 dmg exists too). The app bundles its own Java runtime, so no system Java is required (verified on a machine with only Java 17 installed).
2. Mount, auto-accepting the AGPL license prompt: `yes | hdiutil attach Audiveris-5.10.2-macosx-x86_64.dmg -nobrowse`
3. Install without admin rights: `cp -R /Volumes/Audiveris/Audiveris.app ~/tools/ && hdiutil detach /Volumes/Audiveris`
4. Batch OMR: `~/tools/Audiveris.app/Contents/MacOS/Audiveris -batch -export -output <out-dir> <image.png>` → writes `<out-dir>/<name>.mxl` (~30 s per page, logs to stdout).
5. `.mxl` is a zip container: `unzip <name>.mxl` yields `<name>.xml` (MusicXML), which `npx tsx scripts/lib/validate-cli.ts musicxml <name>.xml <render.png>` validates and renders.
6. Input guidance: ≥~2000 px wide, white background, cropped to the music (see finding 4).

## Implementation Plan

Corpus strategy: self-rendered images of public-domain material (traditional folk tunes, Bach), authored as ABC and engraved to high-resolution white-background PNGs via the ticket-003 abcjs/resvg pipeline. This sidesteps the copyright caution entirely (sources are committable), and matches the actual use case — screenshots of digitally engraved sheet music, not phone photos. Known limitation to be documented with the results: the spike driver authors the sources, so transcription bias is possible; Path A transcriptions are done from the images alone, and the self-rendered corpus means no scan/photo artifacts, which favors OMR.

1. Author 6 ABC sources spanning the required complexity range (simple guitar chord chart, simple piano lead sheet, folk melody with pickup/accidentals, two-hand grand-staff arrangement, dense two-voice counterpoint, dense SATB chorale) under `scripts/fixtures/screenshot-corpus/`, with a `generate-corpus.ts` script that renders each to PNG (high resolution, white background) and a README describing each image.
2. Add a small CLI wrapper `scripts/lib/validate-cli.ts` (`tsx scripts/lib/validate-cli.ts <abc|musicxml> <input-file> <output-png>`) over the ticket 003/004 validators, used to drive the validation loop during the spike (and reusable by the ticket-008 skill).
3. Install Audiveris from the official GitHub release (5.10.x macOS x86_64 dmg, bundles its own Java runtime); verify `-batch -export` works on one corpus image; document the exact install steps and invocation in this ticket's Notes.
4. Path A per image: transcribe the PNG to ABC by vision, run `validate_notation`(abc), fix and re-run until clean, visually compare the rendered PNG against the source; record pass/fail, iteration count, and final render under `scripts/fixtures/screenshot-corpus/results/`.
5. Path B per image: Audiveris → `.mxl` → unzip to MusicXML → `validate_notation`(musicxml) → clean up → normalize to ABC → `validate_notation`(abc); record the same data.
6. Write the comparison table (image type × path × outcome × iterations), Audiveris install documentation, and the routing recommendation into this ticket's Notes; time-box per the ticket (stop early if a clean pattern emerges).
7. `pnpm test`, `pnpm lint`, `pnpm build` (corpus/generator code must typecheck); invoke `/ticket-verifier`.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
