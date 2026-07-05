# Ticket: validate_notation Tool — MusicXML Rendering via Verovio

**Feature:** sheet-ingest
**Status:** Open
**Priority:** P2
**Estimate:** S
**Related:** ADR-0007 (Decision §4 "Validation-Driven Loop", §3 "MIDI as Intermediate Format")
**Depends on:** sheet-ingest/003

## Context

MIDI-derived and OMR-derived candidates converge on MusicXML as a transit format before Claude normalizes them to ABC or tab text (ADR-0007 §3). Before that normalization happens, the same render-and-compare discipline applies: Claude needs to see the MusicXML rendered as a score to catch OMR misreads or `music21` conversion artifacts. ADR-0007 §4 names Verovio as the MusicXML renderer for this step, run locally inside the MCP server and never on the edge — MusicXML remains a storage non-option per ADR-0005, purely a pipeline transit format.

This ticket extends the `validate_notation` tool built in ticket 003 with a second format branch, rather than building a parallel tool.

## Goal

Extend `validate_notation` to accept `{ format: "musicxml", content: string }` and render it headlessly via Verovio, returning parse errors or a PNG using the same contract as the ABC path.

## Acceptance Criteria

- [ ] Verovio's Node/WASM package is added as a `devDependency`
- [ ] A new module `scripts/lib/validate-musicxml.ts` exports `validateMusicXml(xml: string): { ok: true; pngBuffer: Buffer } | { ok: false; errors: string[] }`, mirroring the return shape of `validateAbc` (ticket 003) exactly
- [ ] Malformed MusicXML (invalid XML, missing required elements) returns `{ ok: false, errors: [...] }` without throwing
- [ ] Well-formed MusicXML (a minimal single-measure example) returns `{ ok: true, pngBuffer }` with a non-empty PNG buffer
- [ ] The MCP server's `validate_notation` tool branches on `format`: `"abc"` calls `validateAbc` (ticket 003), `"musicxml"` calls `validateMusicXml`; an unrecognized `format` value returns a tool error rather than a crash
- [ ] Unit tests in `scripts/lib/validate-musicxml.test.ts` cover: valid MusicXML returns a PNG, malformed XML returns errors, empty string input returns errors (not a crash)
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to the ABC validation path built in ticket 003
- Storing MusicXML anywhere — it is a transit format only, never written to `songs.content` (ADR-0005, ADR-0007 §3)
- The `music21` MIDI-to-MusicXML conversion step itself — that lives in the YouTube/audio pipeline tickets (006, 007); this ticket only validates MusicXML that already exists

## Notes

- If, during implementation, Verovio's Node/WASM integration turns out to share enough plumbing with the `abcjs` headless setup (ticket 003) that a combined `validate-notation.ts` module is clearly simpler than two files, that consolidation is fine — the acceptance criteria care about the `validate_notation` tool's external contract (format-branching, matching return shape), not the internal file layout.
- A minimal valid MusicXML fixture for the "well-formed" test case can be a single measure with one note — no need for a realistic song excerpt.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
