# Ticket: Screenshot Ingestion Prototype — Vision-Direct vs. Audiveris OMR

**Feature:** sheet-ingest
**Status:** Open
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

- [ ] A test corpus of 6–8 source images is assembled and referenced from `scripts/fixtures/screenshot-corpus/`, spanning at minimum: a simple guitar chord chart, a simple piano lead sheet, a two-hand piano arrangement with multiple voices, and one dense/classical-style score
- [ ] For each image, Path A (Claude vision → ABC directly) is run, the output validated with `validate_notation` (ticket 003), and the result (pass/fail, number of correction iterations, final rendered PNG) is recorded
- [ ] Audiveris is installed locally and, for each image, Path B (Audiveris → MusicXML → Claude cleanup → ABC) is run, the intermediate MusicXML validated with `validate_notation` (ticket 004), the final ABC validated with `validate_notation` (ticket 003), and the same result data is recorded
- [ ] A comparison table (image type × path × outcome × iteration count) is written into this ticket's Notes section, summarizing which path won for which image category
- [ ] Audiveris installation steps (Java version, download source, invocation command) are documented in the same Notes section for reuse in the skill
- [ ] The recommendation reached here is the input the `sheet-ingest/SKILL.md` routing table (ticket 008) codifies — this ticket does not itself write the skill file
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Writing `sheet-ingest/SKILL.md` — ticket 008 consumes this ticket's findings
- Automating the comparison (a script that runs both paths unattended) — this is a manual, driven-by-Claude-Code spike, not a CI benchmark
- Video frame extraction for the "videos showing sheet music" case — that reuses this same screenshot pipeline once decided, wired up in ticket 007
- Committing copyrighted source images to the repository if that conflicts with the copyright posture in ADR-0007 §6 — see Notes for the fallback

## Notes

- **Copyright caution:** ADR-0007 §6 treats the collection as personal and local, but this repository itself may end up on a remote (even if private). If the chosen test images are copyrighted sheet music, do not commit the source images — instead commit only the transcribed ABC/MusicXML outputs and a text description of each source image (title, complexity characteristics), keeping the actual image files local-only (`.gitignore`d under `scripts/fixtures/screenshot-corpus/`). Public-domain sources (IMSLP, traditional folk tunes) sidestep this entirely and are the preferred choice for the corpus where possible.
- This ticket's value is the documented outcome, not the code. Time-box it — if a clean win/loss pattern emerges after 4–5 images, it is fine to stop before exhausting the full corpus.
- Expect Audiveris setup friction (Java dependency, CLI invocation is not well documented upstream). Budget time for this in the plan-mode session; it is called out explicitly in ADR-0007's Negative consequences ("heavy local dependency footprint").

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
