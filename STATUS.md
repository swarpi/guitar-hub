# Project Status

> Last updated: 2026-07-12 20:39 UTC

## Current Phase

| Phase | Status |
|-------|--------|
| Decide | |
| Map | |
| Decompose | |
| Execute | Active |
| Review | |
| Audit | |
| Learn | |
| Report | |

## Active Work

sheet-ingest (ADR-0007) is feature-complete. Ticket 008 (sheet-ingest Claude Code skill) is Done and verified: `.claude/skills/sheet-ingest/SKILL.md` encodes the routing table, ABC conventions, OMR error patterns, the validation-loop protocol, and known limitations, all checked line-by-line against the actual outcomes of tickets 002–007 (routing table against ticket 005's decision, ABC conventions against the corpus files, OMR findings and Audiveris invocation against ticket 005, falling-notes tuning and audio-onset findings against tickets 006–007) — no discrepancies found. All eight sheet-ingest tickets (001–008) are now Done. Migration `0002_sheet-metadata.sql` was applied to production D1 on 2026-07-12 (`difficulty`/`key`/`source_url` columns verified present).

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-12 20:39 UTC

| Hash | Date | Message |
|------|------|---------|
| `a0f810a` | 2026-07-12 | Add sheet-ingest Claude Code skill (sheet-ingest ticket 008) |
| `53589db` | 2026-07-12 | Sync STATUS.md dashboard after ticket 006/007 commits |
| `a883575` | 2026-07-12 | Run falling-notes frame-to-MIDI spike: real Synthesia tutorial to validated MusicXML (sheet-ingest ticket 007) |
| `c58666b` | 2026-07-12 | Add local media tooling and audio-to-MIDI pipeline (sheet-ingest ticket 006) |
| `9282f3f` | 2026-07-06 | Run screenshot ingestion spike: vision-direct vs Audiveris OMR (sheet-ingest ticket 005) |
| `1153d67` | 2026-07-06 | Extend validate_notation with MusicXML rendering via Verovio (sheet-ingest ticket 004) |
| `dfcbadb` | 2026-07-06 | Add validate_notation MCP tool: headless ABC rendering via abcjs (sheet-ingest ticket 003) |
| `156c00d` | 2026-07-06 | Sync STATUS.md dashboard after sheet-ingest ticket 002 commit |
| `283a3c4` | 2026-07-06 | Add local MCP sheet server: add_sheet, list_sheets, update_sheet (sheet-ingest ticket 002) |
| `3c05b20` | 2026-07-06 | Add sheet metadata columns: difficulty, key, source_url (sheet-ingest ticket 001) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 .claude/skills/sheet-ingest/SKILL.md                        |  156 ++
 .gitignore                                                  |    3 +
 STATUS.md                                                   |   61 +-
 scripts/fixtures/audio-pipeline-e2e/README.md               |   17 +
 scripts/fixtures/audio-pipeline-e2e/twinkle-render.png      |  Bin 0 -> 10548 bytes
 scripts/fixtures/audio-pipeline-e2e/twinkle.mid             |  Bin 0 -> 2189 bytes
 scripts/fixtures/audio-pipeline-e2e/twinkle.musicxml        |  199 +++
 scripts/fixtures/falling-notes-e2e/README.md                |   16 +
 scripts/fixtures/falling-notes-e2e/tutorial-render.png      |  Bin 0 -> 61868 bytes
 scripts/fixtures/falling-notes-e2e/tutorial.mid             |  Bin 0 -> 610 bytes
 scripts/fixtures/falling-notes-e2e/tutorial.musicxml        | 1948 +++++++++++++++++++++++++
 .../fixtures/screenshot-corpus/01-guitar-chord-chart.abc    |   10 +
 .../fixtures/screenshot-corpus/01-guitar-chord-chart.png    |  Bin 0 -> 92461 bytes
 scripts/fixtures/screenshot-corpus/02-piano-lead-sheet.abc  |    8 +
 scripts/fixtures/screenshot-corpus/02-piano-lead-sheet.png  |  Bin 0 -> 67630 bytes
 scripts/fixtures/screenshot-corpus/03-folk-melody.abc       |    9 +
 scripts/fixtures/screenshot-corpus/03-folk-melody.png       |  Bin 0 -> 82548 bytes
 scripts/fixtures/screenshot-corpus/04-two-hand-piano.abc    |   13 +
 scripts/fixtures/screenshot-corpus/04-two-hand-piano.png    |  Bin 0 -> 100865 bytes
 .../fixtures/screenshot-corpus/05-dense-counterpoint.abc    |   13 +
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| [003 — Offline Fallback Page](tickets/pwa/003-offline-fallback-page.md) | pwa | In Review |

## Risks & Blockers

- None.

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
| 2026-07-05 | Ticket 009 done: Music Hub rename via layout title template, 8 page titles simplified, header/wrangler/package renamed; manifest+offline.html deferred (master-only files); ticket 010 flagged blocked pending master integration |
| 2026-07-05 | Merged master into branch (PWA, AI import, deploy config); re-homed AddPageClient onto /guitar/add; fixed tabContent→content wire mapping; finished 009 deferrals; ticket 010 done with programmatic SW v1-eviction proof; feature complete, verifier approved |
| 2026-07-05 | route-consolidation/002 done: measured 6 edge functions / 2.52 MiB gzipped (cap 3 MiB); production deployed and live smoke-tested; D1 rename-back contingency in ADR-0008's rollout plan turned out to be a no-op (schema was already final pre-deploy) — documented as a process deviation in the ticket; verifier approved |
| 2026-07-06 | sheet-ingest/001 done: migration 0002 adds nullable difficulty/key/source_url; parseSheetMetadata validation in create+update actions; SongForm gains three optional fields; detail page renders badges + source link; migration tested against real SQL files; 143/143 tests, verifier approved |
| 2026-07-06 | sheet-ingest/002 done: MCP server scaffold (`pnpm dev:mcp`, stdio) with add_sheet/list_sheets/update_sheet as thin adapters over createSongLogic/updateSongLogic; tsconfig.mcp.json shims @cloudflare/next-on-pages for plain-Node imports of actions.ts; 7 new handler tests (150/150 total); end-to-end stdio smoke test passed; verifier approved |
| 2026-07-06 | sheet-ingest/003 done: validate_notation tool renders ABC headlessly (abcjs under jsdom, XMLSerializer, resvg → PNG); pure validateAbc with stripped abcjs warnings, explicit X: header check; 4 new tests (154/154); stdio smoke test returned correct staff-notation PNG as MCP image block; verifier approved |
| 2026-07-06 | sheet-ingest/004 done: validate_notation gains musicxml branch via Verovio WASM (lazy toolkit singleton, buffered getLog diagnostics, DOMParser well-formedness pre-check since Verovio tolerates malformed XML); 4 new tests (158/158); stdio smoke test rendered correct one-measure score; verifier approved |
| 2026-07-06 | sheet-ingest/005 spike done: 6-image PD corpus + Audiveris 5.10.2 installed and run both ways; key finding — OMR discards chord symbols (misread as dynamics) but preserves dense multi-voice structure ~80–90%; routing recommendation documented in ticket for the 008 skill; verifier approved |
| 2026-07-06 | sheet-ingest/006 done: yt-dlp/ffmpeg + Python 3.11 venv (basic-pitch, music21; four platform pins documented); audio-pipeline.ts (downloadAudio/audioToMidi/midiToNotation, descriptive stderr Errors); 18 spawn-mocked tests (176/176); e2e synthesized clip → MIDI → MusicXML → VALID render committed to fixtures; live YouTube download verified; verifier approved |
| 2026-07-06 | sheet-ingest/007 spike done: evaluated 6 frame-to-MIDI projects, selected 41pha1/MIDI-Converter (user-approved clone to ~/tools, unlicensed → local-only posture); falling-notes-pipeline.ts (extractFrames 30 fps + framesToMidi stitch-and-detect with tuning options); 10 new mocked-spawn tests (187/187); real Synthesia tutorial e2e → VALID render, melody pitch-perfect, 6 failure modes documented for the 008 skill; verifier approved |
| 2026-07-12 | sheet-ingest/008 done: `.claude/skills/sheet-ingest/SKILL.md` written (routing table, ABC conventions, OMR error patterns, validation-loop protocol, known limitations); documentation-only, verified by read-through against ADR-0007, ADR-0005 §2, and tickets 002–007's actual results (no code, no test suite impact); sheet-ingest feature complete (001–008 all Done); verifier approved |
| 2026-07-12 | Applied migration `0002_sheet-metadata.sql` to production D1 (`guitar-hub`) via `wrangler d1 execute --remote`; `difficulty`/`key`/`source_url` columns confirmed present on the production `songs` table; standing risk cleared |
