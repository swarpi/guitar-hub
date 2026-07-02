# Project Status

> Last updated: 2026-07-02 21:24 UTC

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

Multi-instrument feature (ADR-0005), executing in this worktree. Ticket 007 (piano route group) is done and verifier-approved: all five `/piano/...` pages exist, the piano CRUD flow works end-to-end, and `SongForm` hides the capo field for piano. Changes are uncommitted in the worktree. Next step: ticket 008 (ABC notation rendering via abcjs) to upgrade the piano song detail `<pre>` block to staff notation.

## Branch & Commits

<!-- AUTO:START -->
**Branch:** `worktree-multi-instrument-001`  
**Last commit:** 2026-07-02 21:24 UTC

| Hash | Date | Message |
|------|------|---------|
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
 STATUS.md                                                    |  33 +++++++--
 next.config.mjs                                              |  27 ++++++-
 src/app/actions.test.ts                                      | 261 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 src/app/actions.ts                                           |  55 +++++++++++---
 src/app/{artists => guitar}/[artistSlug]/[songSlug]/page.tsx |  11 +--
 src/app/{artists => guitar}/[artistSlug]/page.tsx            |  12 ++-
 src/app/{ => guitar}/add/page.tsx                            |  17 ++++-
 src/app/{ => guitar}/edit/[songId]/page.tsx                  |  13 ++--
 src/app/guitar/page.tsx                                      | 100 +++++++++++++++++++++++++
 src/app/page.tsx                                             | 149 ++++++++++++++++----------------------
 src/components/FAB.tsx                                       |   8 +-
 src/components/Header.tsx                                    |   6 --
 src/components/SongForm.tsx                                  |   5 ++
 src/db/queries.test.ts                                       |  54 ++++++++++++--
 src/db/queries.ts                                            |  50 ++++++++++++-
 15 files changed, 655 insertions(+), 146 deletions(-)
```
<!-- AUTO:FILES:END -->

## Open Tickets

| Ticket | Feature | Status |
|--------|---------|--------|
| multi-instrument/008 — ABC notation rendering | multi-instrument | Up Next |
| multi-instrument/009 — App rename | multi-instrument | Todo |
| multi-instrument/010 — Service worker / PWA updates | multi-instrument | Todo |

## Risks & Blockers

- None currently

## Session Log

| Date | Summary |
|------|---------|
| 2026-07-02 | Ticket 007 done: piano route group (/piano list, add, edit, artist, song detail), capo hidden for piano in SongForm, verifier approved |
