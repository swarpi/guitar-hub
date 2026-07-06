# Project Status

> Last updated: 2026-07-06 17:15 UTC

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

sheet-ingest (ADR-0007) is underway. Ticket 005 (screenshot ingestion spike) is Done and verified: both paths ran against a 6-image corpus; the routing recommendation (vision-direct for anything with chord symbols and single-staff melodies, Audiveris-assisted for dense multi-voice scores) is documented in the ticket for ticket 008 to codify. Audiveris 5.10.2 is installed at `~/tools/Audiveris.app`. Next up: ticket 006 (local media tooling + audio pipeline) or 008 (the skill). Note: migration `0002_sheet-metadata.sql` has not yet been applied to production D1 — apply it alongside the next deploy.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-06 17:15 UTC

| Hash | Date | Message |
|------|------|---------|
| `1153d67` | 2026-07-06 | Extend validate_notation with MusicXML rendering via Verovio (sheet-ingest ticket 004) |
| `dfcbadb` | 2026-07-06 | Add validate_notation MCP tool: headless ABC rendering via abcjs (sheet-ingest ticket 003) |
| `156c00d` | 2026-07-06 | Sync STATUS.md dashboard after sheet-ingest ticket 002 commit |
| `283a3c4` | 2026-07-06 | Add local MCP sheet server: add_sheet, list_sheets, update_sheet (sheet-ingest ticket 002) |
| `3c05b20` | 2026-07-06 | Add sheet metadata columns: difficulty, key, source_url (sheet-ingest ticket 001) |
| `b46f14d` | 2026-07-06 | Merge remote-tracking branch 'origin/master' |
| `c6fed10` | 2026-07-05 | Close out route-consolidation: ticket 002 verified, dashboard synced |
| `5baa775` | 2026-07-05 | Mark route-consolidation/001 done in ticket and backlog |
| `bd8eb22` | 2026-07-05 | Consolidate /guitar and /piano into a dynamic [instrument] route group |
| `c24ab46` | 2026-07-05 | Correct wrangler.toml D1 database name and deployment instructions |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                                   |  65 +-
 migrations/0002_sheet-metadata.sql                          |   5 +
 package.json                                                |   8 +-
 pnpm-lock.yaml                                              | 907 ++++++++++++++++++++++++++
 scripts/lib/validate-abc.test.ts                            |  51 ++
 scripts/lib/validate-abc.ts                                 | 107 +++
 scripts/lib/validate-musicxml.test.ts                       |  70 ++
 scripts/lib/validate-musicxml.ts                            | 126 ++++
 scripts/lib/verovio.d.ts                                    |  26 +
 scripts/mcp-sheet-server.ts                                 | 237 +++++++
 scripts/mcp-sheet-tools.test.ts                             | 243 +++++++
 scripts/mcp-sheet-tools.ts                                  | 129 ++++
 scripts/next-on-pages-shim.ts                               |  13 +
 src/app/[instrument]/[artistSlug]/[songSlug]/page.tsx       |  38 +-
 src/app/[instrument]/edit/[songId]/page.tsx                 |   3 +
 src/app/[instrument]/pages.test.tsx                         |  57 ++
 src/app/actions.test.ts                                     | 105 +++
 src/app/actions.ts                                          |  41 ++
 src/components/SongForm.tsx                                 |  60 ++
 src/db/migrations.test.ts                                   |  47 ++
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| [003 — Offline Fallback Page](tickets/pwa/003-offline-fallback-page.md) | pwa | In Review |
| [006 — Local Media Tooling + Audio-to-MIDI Pipeline](tickets/sheet-ingest/006-local-media-tooling-audio-pipeline.md) | sheet-ingest | Open (next up) |

## Risks & Blockers

- Migration `0002_sheet-metadata.sql` is applied locally/in tests only; production D1 still lacks `difficulty`/`key`/`source_url`. Apply via `wrangler d1 execute` before or with the next deploy.

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
