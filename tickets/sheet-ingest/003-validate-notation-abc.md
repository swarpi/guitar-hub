# Ticket: validate_notation Tool — Headless ABC Rendering via abcjs

**Feature:** sheet-ingest
**Status:** Done
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

- [x] `abcjs` is available to the MCP server script (already a dependency post multi-instrument merge per ADR-0005; add it as a `devDependency` here if it is not present after that merge)
- [x] A new module `scripts/lib/validate-abc.ts` exports a pure function `validateAbc(abcText: string): { ok: true; pngBuffer: Buffer } | { ok: false; errors: string[] }`
- [x] `validateAbc` parses the input with `abcjs`'s headless/Node-compatible rendering path (using a DOM shim such as `jsdom` if `abcjs` requires a `document`, consistent with this project's existing `jsdom`-based test setup) and rasterizes the resulting SVG to a PNG buffer
- [x] Malformed ABC (e.g., missing `X:` header, invalid pitch character, unbalanced bar count where `abcjs` flags a warning) returns `{ ok: false, errors: [...] }` with one human-readable message per parser warning/error — never throws
- [x] Well-formed ABC (e.g., the "Twinkle Twinkle" example from ADR-0005 §2) returns `{ ok: true, pngBuffer }` with a non-empty PNG buffer
- [x] The MCP server's `validate_notation` tool:
  - [x] Accepts `{ format: "abc", content: string }`
  - [x] Calls `validateAbc` and returns errors as text, or the PNG as an MCP image content block
- [x] Unit tests in `scripts/lib/validate-abc.test.ts` cover: valid ABC returns a PNG, ABC missing a required header returns errors, ABC with an invalid pitch character returns errors, empty string input returns errors (not a crash)
- [x] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- MusicXML/Verovio rendering — ticket 004 extends the same `validate_notation` tool with a `format: "musicxml"` branch
- The visual compare-against-source step itself — that is a Claude Code judgment call during ingestion (ADR-0007 §4), not something this tool automates; this tool only produces the rendered image for Claude to look at
- Guitar tab (monospace text) validation — guitar content has no parser/renderer to validate against; ADR-0007's validation loop targets notation formats (ABC, MusicXML), not plain tab text
- Any change to the client-side `abcjs` rendering already used on piano song pages (multi-instrument ticket 008) — this is a separate, headless, Node-side usage of the same library

## Notes

- `abcjs` was built for the browser; running it headlessly in Node typically requires a DOM (`jsdom`) to construct the SVG, plus a rasterizer (e.g., `sharp` or `resvg-js`) to convert SVG to PNG since `abcjs` itself only produces SVG/DOM output. Confirm the exact headless recipe during implementation — this is the main technical risk in the ticket and should be resolved early in the plan-mode session before writing the full test suite.
- Keep `validateAbc` a pure function (string in, result out) so it is testable without spinning up the MCP server, matching this project's convention of testing pure logic directly (see `scripts/url-import.ts` / `scripts/url-import.test.ts`).

## Implementation Plan

Headless recipe confirmed by prototype before writing code: abcjs loads without a DOM (globals are only needed at render time), `renderAbc` against a jsdom element produces SVG + a `warnings` array on the tune object, jsdom's `XMLSerializer` (not `outerHTML`, which drops `xmlns`) yields XML that `@resvg/resvg-js` rasterizes to a valid PNG. Two abcjs quirks the implementation must handle: warning strings contain embedded HTML markup (strip tags), and abcjs silently accepts ABC without an `X:` header (explicit check required to satisfy the acceptance criterion).

1. Add `@resvg/resvg-js` as a devDependency (`abcjs` is already a production dependency per ADR-0005; jsdom is already a devDependency).
2. Create `scripts/lib/validate-abc.ts` — pure sync `validateAbc(abcText)`:
   - Static `import abcjs from "abcjs"` (default import — named imports break under CJS interop); lazily create one module-private JSDOM and set `globalThis.window`/`document` only if undefined, since `renderAbc` requires globals at render time.
   - Reject empty/whitespace input; render into a fresh container; collect `tune.warnings` with HTML tags stripped; add an error if `/^X:\s*\d+/m` is missing; add an error if the tune has no music lines; wrap render in try/catch so nothing throws.
   - On success, serialize the SVG with `XMLSerializer` and rasterize via `Resvg` (`fitTo` width 800, system fonts) to a PNG buffer.
3. Extend `scripts/mcp-sheet-server.ts` with a `validate_notation` tool: `{ format: z.enum(["abc"]), content: string }` (ticket 004 extends the enum), returning errors as JSON text or the PNG as an MCP image content block plus a short text block; update the top-of-file tool list.
4. Create `scripts/lib/validate-abc.test.ts`: valid Twinkle ABC → ok with non-empty PNG (magic bytes checked), missing `X:` header → errors, invalid pitch character → errors, empty string → errors without crashing.
5. Run `pnpm test`, `pnpm lint`, `pnpm build`; smoke-test `validate_notation` over real stdio.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
