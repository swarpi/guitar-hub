# Project Status

> Last updated: 2026-07-05 21:39 UTC

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

Multi-instrument feature (ADR-0005) complete: all ten tickets done and verifier-approved. Master was merged into this branch (`6c20e2c`), the AI import was re-homed onto `/guitar/add`, the Music Hub rename was finished (manifest, offline page), and the service worker cache was bumped to v2 with programmatically verified v1 eviction (`3371bce`). Branch is ready to land on master. Remaining before production deploy: run migration `0001_multi-instrument.sql` against the remote D1, then `pnpm pages:build` + `wrangler pages deploy`.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `route-consolidation`  
**Last commit:** 2026-07-05 21:39 UTC

| Hash | Date | Message |
|------|------|---------|
| `bd8eb22` | 2026-07-05 | Consolidate /guitar and /piano into a dynamic [instrument] route group |
| `c24ab46` | 2026-07-05 | Correct wrangler.toml D1 database name and deployment instructions |
| `6ceca24` | 2026-07-05 | Add abcjs/ABC notation learning |
| `89b934b` | 2026-07-05 | Merge multi-instrument feature into master |
| `26efbb9` | 2026-07-05 | Sync ticket statuses and backlog: multi-instrument 007-010 verified done |
| `0744d59` | 2026-07-05 | Add duplicate warning banner to AI import review step (ai-import ticket 003) |
| `3f16fb0` | 2026-07-05 | Update STATUS.md: multi-instrument feature complete, all 10 tickets done |
| `3371bce` | 2026-07-05 | Reconcile AI import with multi-instrument routes; finish Music Hub rename |
| `6c20e2c` | 2026-07-05 | Merge branch 'master' into worktree-multi-instrument-001 |
| `0b4eea9` | 2026-07-05 | Update STATUS.md: ticket 009 done, ticket 010 blocked on master integration |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                                             |  96 +++++++--------
 architecture/decisions/0008-consolidate-instrument-route-groups.md    | 262 ++++++++++++++++++++++++++++++++++++++++
 learnings/abcjs-abc-notation.md                                       |  41 +++++++
 migrations/0001_multi-instrument.sql                                  |   7 ++
 next.config.mjs                                                       |  27 ++++-
 package.json                                                          |   3 +-
 pnpm-lock.yaml                                                        |   8 ++
 public/manifest.json                                                  |   4 +-
 public/offline.html                                                   |   4 +-
 public/sw.js                                                          |   2 +-
 src/app/{artists => [instrument]}/[artistSlug]/[songSlug]/page.tsx    |  40 +++++--
 src/app/{artists => [instrument]}/[artistSlug]/page.tsx               |  27 +++--
 src/app/[instrument]/add/page.tsx                                     |  73 ++++++++++++
 src/app/{ => [instrument]}/edit/[songId]/page.tsx                     |  24 ++--
 src/app/[instrument]/page.tsx                                         | 121 +++++++++++++++++++
 src/app/[instrument]/pages.test.tsx                                   | 336 +++++++++++++++++++++++++++++++++++++++++++++++++++
 src/app/actions.test.ts                                               | 369 ++++++++++++++++++++++++++++++++++++++++++++++++++++-----
 src/app/actions.ts                                                    |  73 ++++++++----
 src/app/add/page.tsx                                                  |  48 --------
 src/app/layout.tsx                                                    |   7 +-
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| _None — multi-instrument feature complete_ | | |

## Risks & Blockers

- **Production D1 schema lag:** the deployed database (id `84c8f3de…`) still has the pre-instrument schema. Migration `0001_multi-instrument.sql` must run against remote D1 before (or with) the next deploy, or the live site breaks on the new queries.

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
| 2026-07-05 | Ticket 009 done: Music Hub rename via layout title template, 8 page titles simplified, header/wrangler/package renamed; manifest+offline.html deferred (master-only files); ticket 010 flagged blocked pending master integration |
| 2026-07-05 | Merged master into branch (PWA, AI import, deploy config); re-homed AddPageClient onto /guitar/add; fixed tabContent→content wire mapping; finished 009 deferrals; ticket 010 done with programmatic SW v1-eviction proof; feature complete, verifier approved |
