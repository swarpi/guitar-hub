# Project Status

> Last updated: 2026-07-05 21:50 UTC

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

route-consolidation (ADR-0008) is complete and verified: both tickets (001 — consolidate the `[instrument]` route group; 002 — deploy verification and production rollout) are Done. The consolidated build measures 6 edge functions and a 2.52 MiB gzipped bundle (was 14 functions / 4.57 MiB), comfortably under the 3 MiB free-plan cap. Production is deployed (`https://ba947b8e.guitar-hub.pages.dev`, aliased to `guitar-hub.pages.dev`) on the final ADR-0005 schema (`content` column, `instrument` column, live smoke-tested). No open tickets in the Current Sprint besides pwa/003 (In Review).

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-05 21:50 UTC

| Hash | Date | Message |
|------|------|---------|
| `5baa775` | 2026-07-05 | Mark route-consolidation/001 done in ticket and backlog |
| `bd8eb22` | 2026-07-05 | Consolidate /guitar and /piano into a dynamic [instrument] route group |
| `c24ab46` | 2026-07-05 | Correct wrangler.toml D1 database name and deployment instructions |
| `6ceca24` | 2026-07-05 | Add abcjs/ABC notation learning |
| `89b934b` | 2026-07-05 | Merge multi-instrument feature into master |
| `26efbb9` | 2026-07-05 | Sync ticket statuses and backlog: multi-instrument 007-010 verified done |
| `0744d59` | 2026-07-05 | Add duplicate warning banner to AI import review step (ai-import ticket 003) |
| `3f16fb0` | 2026-07-05 | Update STATUS.md: multi-instrument feature complete, all 10 tickets done |
| `3371bce` | 2026-07-05 | Reconcile AI import with multi-instrument routes; finish Music Hub rename |
| `6c20e2c` | 2026-07-05 | Merge branch 'master' into worktree-multi-instrument-001 |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                                             |  97 +++++++--------
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
| [003 — Offline Fallback Page](tickets/pwa/003-offline-fallback-page.md) | pwa | In Review |

## Risks & Blockers

_None currently open._ Resolved: the production D1 schema lag (deployed database `84c8f3de…` running the pre-instrument schema) is closed — `0001_multi-instrument.sql` is applied against remote D1 (`instrument` column, `content` rename, composite unique index) and the consolidated worker is deployed and smoke-tested against it (route-consolidation/002).

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
| 2026-07-05 | Ticket 009 done: Music Hub rename via layout title template, 8 page titles simplified, header/wrangler/package renamed; manifest+offline.html deferred (master-only files); ticket 010 flagged blocked pending master integration |
| 2026-07-05 | Merged master into branch (PWA, AI import, deploy config); re-homed AddPageClient onto /guitar/add; fixed tabContent→content wire mapping; finished 009 deferrals; ticket 010 done with programmatic SW v1-eviction proof; feature complete, verifier approved |
| 2026-07-05 | route-consolidation/002 done: measured 6 edge functions / 2.52 MiB gzipped (cap 3 MiB); production deployed and live smoke-tested; D1 rename-back contingency in ADR-0008's rollout plan turned out to be a no-op (schema was already final pre-deploy) — documented as a process deviation in the ticket; verifier approved |
