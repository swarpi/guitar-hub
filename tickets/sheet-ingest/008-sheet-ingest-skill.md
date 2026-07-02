# Ticket: sheet-ingest Claude Code Skill — Routing, Conventions, and Validation Protocol

**Feature:** sheet-ingest
**Status:** Open
**Priority:** P2
**Estimate:** S
**Related:** ADR-0007 (Decision §5 "A Claude Code Skill Encodes the Pipeline")
**Depends on:** sheet-ingest/002, sheet-ingest/003, sheet-ingest/004, sheet-ingest/005, sheet-ingest/006, sheet-ingest/007

## Context

ADR-0007 §5 calls for the pipeline's tacit knowledge to be captured in a Claude Code skill at `sheet-ingest/SKILL.md`, so ingestion behaves consistently across sessions instead of being re-derived from the ADR text every time. The skill is documentation-as-artifact, not code — its job is to make routing decisions, format conventions, and known failure patterns reusable.

This ticket depends on the outcomes of the tooling tickets (002–007) because the skill documents real, working paths and real, observed failure modes — not the ADR's a-priori design. In particular:
- The routing table's image heuristic (vision-direct vs. OMR) is only as good as the comparison run in ticket 005
- The OMR error patterns section needs actual Audiveris output examples from ticket 005
- The video routing guidance needs the working/non-working pipelines from tickets 006 and 007

## Goal

Write `sheet-ingest/SKILL.md` encoding the input-type routing table, the collection's ABC conventions, known OMR/transcription error patterns and corrections, and the validation-loop protocol, so a future Claude Code session can drive ingestion without re-reading the ADR.

## Acceptance Criteria

- [ ] `sheet-ingest/SKILL.md` exists at the repository root (or the project's standard skill location, consistent with other Claude Code skills in this repo if any exist) with frontmatter/description sufficient for Claude Code to discover and load it
- [ ] A routing table section maps input type to pipeline: pasted text/URL (ADR-0006, unchanged), screenshot of simple material (Path A, vision-direct), screenshot of dense material (Path B, OMR-assisted), video with falling notes, video with sheet-music frames, video/audio-only performance — each row states which tools from tickets 002–007 to invoke and in what order
- [ ] An ABC conventions section documents the subset of ABC syntax this collection uses, consistent with ADR-0005 §2 (header fields used, how chords/voices are represented, how the collection's existing seeded piano songs — if any exist post multi-instrument merge — are formatted), so Claude produces consistent output rather than reinventing conventions per song
- [ ] An OMR error patterns section lists concrete misread patterns observed during ticket 005 (e.g., dropped courtesy accidentals, misread ties — whatever was actually observed) and the correction Claude should apply for each
- [ ] A validation-loop protocol section states the render-compare-correct-repeat sequence explicitly: call `validate_notation`, on error fix and retry, on success visually compare the PNG to the source, on mismatch correct and re-validate, only call `add_sheet`/`update_sheet` once validation passes and the visual compare is clean
- [ ] The skill references the outcome of ticket 005 (which image path won for which material) and ticket 007 (working/non-working status of the falling-notes pipeline) rather than restating the ADR's deferred/open framing as if still unresolved
- [ ] A short "known limitations" section carries forward anything ticket 007 found unresolved (e.g., "falling-notes pipeline: no working open-source converter found as of \<date\>; fall back to vision-direct on sampled frames")
- [ ] The skill file is proofread for the Alex Xu-style declarative tone consistent with this project's ADRs and tickets (per `CLAUDE.md` "Writing Style for Artifacts") — no hype, concrete guidance over vague adjectives
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any code changes — this ticket is documentation only
- Re-running or re-deciding the ticket 005 image-path comparison — this ticket consumes that decision, it does not redo it
- Automated testing of the skill's guidance quality — skills are prompted context for Claude Code, not executable code; verification is a human/Claude read-through for accuracy against tickets 002–007's actual outcomes

## Notes

- If tickets 005 or 007 are not yet complete when this ticket is picked up, either wait for them or write the skill with an explicit "pending prototype results, current best guess is..." section and a follow-up note — do not fabricate outcomes that were not actually observed.
- Keep the skill file focused on operational guidance (what to do, in what order, with what tool) rather than re-deriving the architectural rationale already captured in ADR-0007 — link to the ADR for "why," keep the skill itself as the "how."

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
