# Project Status

> Last updated: 2026-07-05 17:00 UTC

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

Multi-instrument feature (ADR-0005), executing in this worktree. Tickets 007 (`4f3e7bf`), 008 (`b7a862c`), and 009 (app rename to Music Hub, `7400d13`) are done and verifier-approved. Ticket 010 (service worker cache bump) is blocked: it targets `public/sw.js`, which only exists on `master` — this branch was cut before the PWA commits (`6d1e7cd`, `cfb57ca`). Next step: integrate the branch with master (merge master in, or merge the branch back), then finish 010 plus the two deferred 009 criteria (manifest.json, offline.html renames).

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `worktree-multi-instrument-001`  
**Last commit:** 2026-07-05 17:00 UTC

| Hash | Date | Message |
|------|------|---------|
| `7400d13` | 2026-07-05 | Rename app Guitar Hub to Music Hub via layout title template (ticket 009) |
| `b7a862c` | 2026-07-03 | Render piano songs as staff notation via code-split abcjs (ticket 008) |
| `4f3e7bf` | 2026-07-03 | Add piano route group: full /piano CRUD flow (ticket 007) |
| `07728fd` | 2026-07-02 | Redirect legacy /artists, /add, /edit routes to /guitar equivalents |
| `a98958a` | 2026-07-02 | Replace home page with Music Hub instrument-picker landing page |
| `ed00f5b` | 2026-07-02 | Add guitar route group, instrument-prefixed redirects, remove legacy routes |
| `5ae355b` | 2026-07-02 | Add instrument validation and getSongsByInstrument test coverage |
| `883e408` | 2026-07-02 | Add instrument-aware queries, actions, and form support |
| `cb84190` | 2026-06-29 | Add instrument column, rename tabContent to content, update unique index |
| `3c381d7` | 2026-06-20 | Initial commit: complete foundation (tickets 001–009) |
<!-- AUTO:END -->

## Recent File Changes

<!-- AUTO:FILES:START -->
**Files changed (last 5 commits):**

```
 STATUS.md                                       |  53 +++++++++++++++++-----------
 next.config.mjs                                 |  27 ++++++++++++++-
 package.json                                    |   3 +-
 pnpm-lock.yaml                                  |   8 +++++
 src/app/actions.test.ts                         |  22 +++++++++++-
 src/app/guitar/[artistSlug]/[songSlug]/page.tsx |   2 +-
 src/app/guitar/[artistSlug]/page.tsx            |   2 +-
 src/app/guitar/add/page.tsx                     |   2 +-
 src/app/guitar/edit/[songId]/page.tsx           |   2 +-
 src/app/layout.tsx                              |   7 ++--
 src/app/page.tsx                                | 149 +++++++++++++++++++++++++++++++++----------------------------------------------
 src/app/piano/[artistSlug]/[songSlug]/page.tsx  |  75 ++++++++++++++++++++++++++++++++++++++++
 src/app/piano/[artistSlug]/page.tsx             |  66 +++++++++++++++++++++++++++++++++++
 src/app/piano/add/page.tsx                      |  52 ++++++++++++++++++++++++++++
 src/app/piano/edit/[songId]/page.tsx            |  86 ++++++++++++++++++++++++++++++++++++++++++++++
 src/app/piano/page.tsx                          |  99 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/components/AbcNotation.tsx                  |  23 +++++++++++++
 src/components/AbcNotationRenderer.test.tsx     |  48 ++++++++++++++++++++++++++
 src/components/AbcNotationRenderer.tsx          |  28 +++++++++++++++
 src/components/Header.tsx                       |   2 +-
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| multi-instrument/010 — Service worker / PWA updates | multi-instrument | Blocked (needs master integration) |

## Risks & Blockers

- **Branch topology gap:** `public/manifest.json`, `public/offline.html`, and `public/sw.js` exist only on `master` (PWA commits `6d1e7cd`, `cfb57ca` landed after this branch was cut). Two ticket-009 rename criteria are deferred and all of ticket 010 is blocked until this branch integrates with master. The 009 ticket file documents the exact post-merge remediation.

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
| 2026-07-05 | Ticket 009 done: Music Hub rename via layout title template, 8 page titles simplified, header/wrangler/package renamed; manifest+offline.html deferred (master-only files); ticket 010 flagged blocked pending master integration |
