# Project Status

> Last updated: 2026-07-05 16:47 UTC

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

Multi-instrument feature (ADR-0005), executing in this worktree. Tickets 007 (piano route group, `4f3e7bf`) and 008 (ABC staff notation via code-split abcjs, `b7a862c`) are done and verifier-approved. Piano song detail pages now render SVG staff notation; the abcjs chunk loads only on that route. Next step: ticket 009 (rename Guitar Hub → Music Hub in titles and header).

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `worktree-multi-instrument-001`  
**Last commit:** 2026-07-05 16:47 UTC

| Hash | Date | Message |
|------|------|---------|
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
 STATUS.md                                                    |  53 +++++++++++++++---------
 next.config.mjs                                              |  27 +++++++++++-
 package.json                                                 |   1 +
 pnpm-lock.yaml                                               |   8 ++++
 src/app/actions.test.ts                                      | 119 +++++++++++++++++++++++++++++++++++++++++++++++++---
 src/app/actions.ts                                           |   8 ++--
 src/app/{artists => guitar}/[artistSlug]/[songSlug]/page.tsx |   7 ++--
 src/app/{artists => guitar}/[artistSlug]/page.tsx            |  11 +++--
 src/app/guitar/add/page.tsx                                  |  52 +++++++++++++++++++++++
 src/app/{ => guitar}/edit/[songId]/page.tsx                  |  13 +++---
 src/app/guitar/page.tsx                                      | 100 ++++++++++++++++++++++++++++++++++++++++++++
 src/app/page.tsx                                             | 149 ++++++++++++++++++++++++++++--------------------------------------
 src/app/piano/[artistSlug]/[songSlug]/page.tsx               |  75 +++++++++++++++++++++++++++++++++
 src/app/piano/[artistSlug]/page.tsx                          |  66 +++++++++++++++++++++++++++++
 src/app/{ => piano}/add/page.tsx                             |  17 ++++++--
 src/app/piano/edit/[songId]/page.tsx                         |  86 ++++++++++++++++++++++++++++++++++++++
 src/app/piano/page.tsx                                       |  99 ++++++++++++++++++++++++++++++++++++++++++++
 src/components/AbcNotation.tsx                               |  23 +++++++++++
 src/components/AbcNotationRenderer.test.tsx                  |  48 +++++++++++++++++++++
 src/components/AbcNotationRenderer.tsx                       |  28 +++++++++++++
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| multi-instrument/009 — App rename | multi-instrument | Up Next |
| multi-instrument/010 — Service worker / PWA updates | multi-instrument | Todo |

## Risks & Blockers

- None currently

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
| 2026-07-03 | Ticket 008 done: abcjs staff notation on piano song detail, code-split via client dynamic() wrapper, bundle isolation + browser render verified, verifier approved |
