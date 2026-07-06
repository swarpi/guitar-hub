# Project Status

> Last updated: 2026-07-06 10:15 UTC

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

sheet-ingest (ADR-0007) is underway, unblocked by the multi-instrument merge. Ticket 001 (schema migration: nullable `difficulty`, `key`, `source_url` columns plus form/action/detail-page support) is Done and verified. Next up is ticket 002 — the local MCP server scaffold with `add_sheet`/`list_sheets`/`update_sheet` tools wrapping `createSongLogic`. Note: migration `0002_sheet-metadata.sql` has not yet been applied to production D1 — apply it alongside the next deploy.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-06 10:15 UTC

| Hash | Date | Message |
|------|------|---------|
| `d4e58c9` | 2026-07-06 | Add sheet metadata columns: difficulty, key, source_url (sheet-ingest ticket 001) |
| `b46f14d` | 2026-07-06 | Merge remote-tracking branch 'origin/master' |
| `c6fed10` | 2026-07-05 | Close out route-consolidation: ticket 002 verified, dashboard synced |
| `5baa775` | 2026-07-05 | Mark route-consolidation/001 done in ticket and backlog |
| `bd8eb22` | 2026-07-05 | Consolidate /guitar and /piano into a dynamic [instrument] route group |
| `c24ab46` | 2026-07-05 | Correct wrangler.toml D1 database name and deployment instructions |
| `6ceca24` | 2026-07-05 | Add abcjs/ABC notation learning |
| `89b934b` | 2026-07-05 | Merge multi-instrument feature into master |
| `26efbb9` | 2026-07-05 | Sync ticket statuses and backlog: multi-instrument 007-010 verified done |
| `0744d59` | 2026-07-05 | Add duplicate warning banner to AI import review step (ai-import ticket 003) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 .github/workflows/notify-site.yml                           |  21 ++
 STATUS.md                                                   |  65 +++--
 .../decisions/0008-consolidate-instrument-route-groups.md   | 262 +++++++++++++++++
 migrations/0002_sheet-metadata.sql                          |   5 +
 src/app/[instrument]/[artistSlug]/[songSlug]/page.tsx       | 128 +++++++++
 src/app/{guitar => [instrument]}/[artistSlug]/page.tsx      |  23 +-
 src/app/{guitar => [instrument]}/add/page.tsx               |  39 ++-
 src/app/{piano => [instrument]}/edit/[songId]/page.tsx      |  23 +-
 src/app/{piano => [instrument]}/page.tsx                    |  42 ++-
 src/app/[instrument]/pages.test.tsx                         | 393 ++++++++++++++++++++++++++
 src/app/actions.test.ts                                     | 105 +++++++
 src/app/actions.ts                                          |  41 +++
 src/app/guitar/[artistSlug]/[songSlug]/page.tsx             |  83 ------
 src/app/guitar/edit/[songId]/page.tsx                       |  85 ------
 src/app/guitar/page.tsx                                     | 100 -------
 src/app/piano/[artistSlug]/[songSlug]/page.tsx              |  75 -----
 src/app/piano/[artistSlug]/page.tsx                         |  66 -----
 src/app/piano/add/page.tsx                                  |  52 ----
 src/components/SongForm.tsx                                 |  60 ++++
 src/db/migrations.test.ts                                   |  47 +++
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| [003 — Offline Fallback Page](tickets/pwa/003-offline-fallback-page.md) | pwa | In Review |
| [002 — MCP Server Scaffold](tickets/sheet-ingest/002-mcp-server-scaffold.md) | sheet-ingest | Open (next up) |

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
