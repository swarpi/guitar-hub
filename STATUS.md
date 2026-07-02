# Project Status

> Last updated: 2026-07-02 21:26 UTC

## Current Phase

| Phase | Status |
|-------|--------|
| Decide | ● sheet-ingest (ADR-0007 accepted) |
| Map | |
| Decompose | ● sheet-ingest (8 tickets created, blocked on multi-instrument merge) |
| Execute | ● multi-instrument (tickets 001–006 done), ai-import (tickets 001–002, 004–005 done) |
| Review | |
| Audit | |
| Learn | |
| Report | |

## Active Work

Multi-instrument feature (ADR-0005) in progress on branch `worktree-multi-instrument-001` (worktree at `.claude/worktrees/multi-instrument-001`). Tickets 001–006 are done and verified on that branch: schema migration, instrument-aware queries/actions, test suite updates, the guitar route group (all CRUD under `/guitar/...`), the Music Hub landing page, and permanent redirects from the legacy `/artists`, `/add`, `/edit` paths (verified live via curl, HTTP 308). Next step: ticket 007 (piano route group), then 008 (ABC notation rendering).

AI import feature (ADR-0006) on master: Phase 1 (pasted text, tickets 001–002) and Phase 2 (URL import, tickets 004–005) are done and verified. The proxy now fetches `URL:`-prefixed links server-side (`scripts/url-import.ts`, 502 error contract) and `ImportForm` has a Paste Text / URL input toggle. Remaining: ticket 003 (duplicate warning banner, parked until multi-instrument lands). Note: any already-running `pnpm dev:ai` proxy must be restarted to pick up the URL-fetching code.

Sheet ingestion (ADR-0007, accepted 2026-07-02): local MCP server + Claude Code pipeline for ingesting screenshots, YouTube videos, and audio into validated notation. Decomposed into 8 tickets in `tickets/sheet-ingest/`; all blocked until `worktree-multi-instrument-001` merges (they build on the `instrument`/`content` schema). ADR-0006 Phase 3 (in-app image import) is descoped in its favor.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `master`  
**Last commit:** 2026-07-02 21:26 UTC

| Hash | Date | Message |
|------|------|---------|
| `cfb57ca` | 2026-07-02 | Add branded offline fallback page served by the service worker |
| `4d1d5ef` | 2026-07-02 | Add AI tab import: paste and URL extraction via local AI proxy (ADR-0006) |
| `c6251ba` | 2026-07-02 | Exclude Claude Code agent worktrees from vitest, biome, and git |
| `6d1e7cd` | 2026-06-24 | Add service worker, offline caching, and offline UI indicators |
| `bfec8b4` | 2026-06-24 | Add web app manifest and PWA icons for home screen install |
| `2eab698` | 2026-06-24 | Deploy Guitar Hub to Cloudflare Pages with seeded D1 database |
| `3c381d7` | 2026-06-20 | Initial commit: complete foundation (tickets 001–009) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 .gitignore                                            |   3 +
 STATUS.md                                             |  22 +-
 architecture/decisions/0006-ai-tab-import.md          | 268 ++++++++++++++++++++++
 package.json                                          |   4 +-
 public/icons/icon-192x192.png                         | Bin 0 -> 4132 bytes
 public/icons/icon-512x512.png                         | Bin 0 -> 13007 bytes
 public/icons/icon-source.svg                          |   4 +
 public/manifest.json                                  |  20 ++
 public/offline.html                                   |  88 +++++++
 public/sw.js                                          |  63 +++++
 scripts/ai-proxy.ts                                   | 154 +++++++++++++
 scripts/url-import.test.ts                            | 175 ++++++++++++++
 scripts/url-import.ts                                 |  96 ++++++++
 src/app/add/page.tsx                                  |   4 +-
 src/app/layout.tsx                                    |  14 +-
 src/components/AddPageClient.test.tsx                 | 164 +++++++++++++
 src/components/AddPageClient.tsx                      |  99 ++++++++
 src/components/ImportForm.test.tsx                    | 395 ++++++++++++++++++++++++++++++++
 src/components/ImportForm.tsx                         | 251 ++++++++++++++++++++
 src/components/OfflineBanner.test.tsx                 |  68 ++++++
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| 007 — Piano Route Group | multi-instrument | Up Next |
| 008 — ABC Notation Rendering | multi-instrument | Up Next |
| 009 — App Rename | multi-instrument | Up Next |
| 010 — Service Worker and PWA Updates | multi-instrument | Up Next |
| 003 — Offline Fallback Page | pwa | Up Next |
| 003 — Duplicate Warning Banner | ai-import | Backlog (after multi-instrument) |

## Risks & Blockers

- `worktree-multi-instrument-001` branched from the initial commit, before the PWA commits on master. It must be rebased/merged onto master before landing; `SongForm.tsx` is touched by both the multi-instrument branch and the uncommitted ai-import changes on master, so expect a conflict there.

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Completed multi-instrument ticket 006 (permanent redirects for legacy `/artists`, `/add`, `/edit` paths in next.config.mjs, verified live with curl — HTTP 308 to `/guitar/...`); ticket-verifier approved; backlog synced. |
| 2026-07-02 | Completed multi-instrument ticket 005 (Music Hub landing page with instrument cards at `/`, plus getSongCountsByInstrument tests; 46 tests, build green); ticket-verifier approved; backlog synced. |
| 2026-07-02 | Completed ai-import Phase 2 (tickets 004–005): proxy URL fetching (`scripts/url-import.ts`, 502 contract, live-verified via curl) and ImportForm URL input mode (85 tests passing); planner decomposed Phase 2 from ADR-0006; both tickets ticket-verifier approved; backlog synced. |
| 2026-07-02 | Accepted ADR-0007 (MCP sheet ingestion pipeline) incl. schema decision for `difficulty`/`key`/`source_url` columns; planner decomposed it into 8 sheet-ingest tickets, backlog synced. Blocked on multi-instrument merge. |
| 2026-07-02 | Completed multi-instrument ticket 004 (guitar route group under `/guitar/...`, instrument-prefixed action redirects, FAB href prop, Header add-button removed, legacy routes deleted; 44 tests, build green); ticket-verifier approved; backlog synced. |
| 2026-07-02 | Completed multi-instrument ticket 003 (instrument validation + getSongsByInstrument test coverage, 39 tests passing) on the worktree branch; ticket-verifier approved; backlog synced. |
| 2026-07-02 | Completed multi-instrument ticket 002 (instrument-aware queries, actions, SongForm) on the worktree branch; ticket-verifier approved; backlog synced. |
| 2026-07-02 | Completed ai-import ticket 002 (ImportForm component wired into AddPageClient, 19 new/updated tests); ticket-verifier approved. Excluded `.claude/worktrees/` from vitest/biome/git to unblock test and lint gates. |
