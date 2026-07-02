# Ticket: validate_notation Tool — Headless ABC Rendering via abcjs

**Feature:** sheet-ingest
**Status:** Open
**Priority:** P1
**Estimate:** M
**Related:** ADR-0007 (Decision §4 "Validation-Driven Loop")
**Depends on:** sheet-ingest/002

## Context

ADR-0007 calls the validation loop "the heart of this ADR" (§4). One-shot transcription — from OMR, audio-to-MIDI, or vision — is unreliable past simple lead sheets, so every candidate notation must be rendered and checked before it reaches the collection. `validate_notation` is the tool that makes this possible: it renders candidate notation headlessly in Node and returns either parse/render errors (which Claude fixes and retries) or a rendered image (which Claude visually compares against the source).

This ticket covers the ABC half of `validate_notation`. `abcjs` is already the chosen renderer for ABC under ADR-0005 (used client-side for piano staff notation), so this ticket reuses the same library headlessly in Node rather than introducing a second ABC parser. MusicXML validation via Verovio is a separate format path, covered in ticket 004.

## Goal

Add a `validate_notation` tool to the MCP server (ticket 002) that renders ABC text headlessly and returns structured parse errors or a rendered PNG.

## Acceptance Criteria

- [ ] `abcjs` is available to the MCP server script (already a dependency post multi-instrument merge per ADR-0005; add it as a `devDependency` here if it is not present after that merge)
- [ ] A new module `scripts/lib/validate-abc.ts` exports a pure function `validateAbc(abcText: string): { ok: true; pngBuffer: Buffer } | { ok: false; errors: string[] }`
- [ ] `validateAbc` parses the input with `abcjs`'s headless/Node-compatible rendering path (using a DOM shim such as `jsdom` if `abcjs` requires a `document`, consistent with this project's existing `jsdom`-based test setup) and rasterizes the resulting SVG to a PNG buffer
- [ ] Malformed ABC (e.g., missing `X:` header, invalid pitch character, unbalanced bar count where `abcjs` flags a warning) returns `{ ok: false, errors: [...] }` with one human-readable message per parser warning/error — never throws
- [ ] Well-formed ABC (e.g., the "Twinkle Twinkle" example from ADR-0005 §2) returns `{ ok: true, pngBuffer }` with a non-empty PNG buffer
- [ ] The MCP server's `validate_notation` tool:
  - [ ] Accepts `{ format: "abc", content: string }`
  - [ ] Calls `validateAbc` and returns errors as text, or the PNG as an MCP image content block
- [ ] Unit tests in `scripts/lib/validate-abc.test.ts` cover: valid ABC returns a PNG, ABC missing a required header returns errors, ABC with an invalid pitch character returns errors, empty string input returns errors (not a crash)
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- MusicXML/Verovio rendering — ticket 004 extends the same `validate_notation` tool with a `format: "musicxml"` branch
- The visual compare-against-source step itself — that is a Claude Code judgment call during ingestion (ADR-0007 §4), not something this tool automates; this tool only produces the rendered image for Claude to look at
- Guitar tab (monospace text) validation — guitar content has no parser/renderer to validate against; ADR-0007's validation loop targets notation formats (ABC, MusicXML), not plain tab text
- Any change to the client-side `abcjs` rendering already used on piano song pages (multi-instrument ticket 008) — this is a separate, headless, Node-side usage of the same library

## Notes

- `abcjs` was built for the browser; running it headlessly in Node typically requires a DOM (`jsdom`) to construct the SVG, plus a rasterizer (e.g., `sharp` or `resvg-js`) to convert SVG to PNG since `abcjs` itself only produces SVG/DOM output. Confirm the exact headless recipe during implementation — this is the main technical risk in the ticket and should be resolved early in the plan-mode session before writing the full test suite.
- Keep `validateAbc` a pure function (string in, result out) so it is testable without spinning up the MCP server, matching this project's convention of testing pure logic directly (see `scripts/url-import.ts` / `scripts/url-import.test.ts`).

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
