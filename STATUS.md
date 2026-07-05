# Project Status

> Last updated: 2026-07-05 17:28 UTC

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
**Branch:** `worktree-multi-instrument-001`  
**Last commit:** 2026-07-05 17:28 UTC

| Hash | Date | Message |
|------|------|---------|
| `3371bce` | 2026-07-05 | Reconcile AI import with multi-instrument routes; finish Music Hub rename |
| `6c20e2c` | 2026-07-05 | Merge branch 'master' into worktree-multi-instrument-001 |
| `0b4eea9` | 2026-07-05 | Update STATUS.md: ticket 009 done, ticket 010 blocked on master integration |
| `7400d13` | 2026-07-05 | Rename app Guitar Hub to Music Hub via layout title template (ticket 009) |
| `b7a862c` | 2026-07-03 | Render piano songs as staff notation via code-split abcjs (ticket 008) |
| `4f3e7bf` | 2026-07-03 | Add piano route group: full /piano CRUD flow (ticket 007) |
| `69e06dd` | 2026-07-02 | Add planning artifacts: ADR-0005, ADR-0007, tickets, dashboard sync |
| `cfb57ca` | 2026-07-02 | Add branded offline fallback page served by the service worker |
| `4d1d5ef` | 2026-07-02 | Add AI tab import: paste and URL extraction via local AI proxy (ADR-0006) |
| `c6251ba` | 2026-07-02 | Exclude Claude Code agent worktrees from vitest, biome, and git |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 .claude/settings.json                                          |  33 ++++++
 .gitignore                                                     |   3 +
 CLAUDE.md                                                      |  34 +++++-
 STATUS.md                                                      |  65 ++++++-----
 architecture/decisions/0004-deployment-and-next-phase.md       | 130 +++++++++++++++++++++
 architecture/decisions/0005-multi-instrument-support.md        | 261 ++++++++++++++++++++++++++++++++++++++++++
 architecture/decisions/0006-ai-tab-import.md                   | 268 +++++++++++++++++++++++++++++++++++++++++++
 architecture/decisions/0007-mcp-sheet-ingestion-pipeline.md    | 214 +++++++++++++++++++++++++++++++++++
 biome.json                                                     |  21 +---
 package.json                                                   |   7 +-
 pnpm-lock.yaml                                                 |   8 ++
 public/icons/icon-192x192.png                                  | Bin 0 -> 4132 bytes
 public/icons/icon-512x512.png                                  | Bin 0 -> 13007 bytes
 public/icons/icon-source.svg                                   |   4 +
 public/manifest.json                                           |  20 ++++
 public/offline.html                                            |  88 +++++++++++++++
 public/sw.js                                                   |  63 +++++++++++
 scripts/ai-proxy.ts                                            | 154 +++++++++++++++++++++++++
 scripts/generate-seed-sql.ts                                   |  37 ++++++
 scripts/seed.sql                                               | 135 ++++++++++++++++++++++
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
