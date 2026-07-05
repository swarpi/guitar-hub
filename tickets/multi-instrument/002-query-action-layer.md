# Ticket: Query and Action Layer — Rename content, Add Instrument Support

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0005
**Depends on:** multi-instrument/001

## Context

After the schema migration (ticket 001), the `songs` table has `content` (renamed from `tab_content`) and `instrument`. All application code still references the old `tabContent` field name and none of the queries filter by instrument.

This ticket propagates the schema change through every layer that touches song data: queries, server actions, the `SongForm` component, and the two page components that render `tabContent` directly. It also adds the new instrument-related query functions that later tickets will use.

The existing route files (`/add`, `/edit`, `/artists`) are left in place; they continue to work after this ticket because the server action defaults `instrument` to `'guitar'` when the form does not supply it. Those old routes are removed in ticket 004.

## Goal

All files that reference `tabContent` or `tab_content` are updated to `content`; server actions accept and validate an `instrument` field; queries are instrument-aware; and the app compiles and passes all existing tests.

## Acceptance Criteria

- [x] `src/db/queries.ts`:
  - `getSongById` and `getSongBySlugs` return `content` instead of `tabContent`
  - `getSongsByArtistId` accepts an `instrument: string` parameter and adds `eq(songs.instrument, instrument)` to the WHERE clause
  - `getSongBySlugs` accepts an `instrument: string` parameter and adds `eq(songs.instrument, instrument)` to the WHERE clause
  - New function `getSongsByInstrument(db, instrument)` returns all songs for that instrument joined with artists, ordered by title ascending — used by instrument home pages
  - New function `getSongCountsByInstrument(db)` returns `{ guitar: number, piano: number }` — used by the landing page in ticket 005
- [x] `src/app/actions.ts`:
  - `createSongLogic` reads `formData.get("content")` (not `tabContent`); accepts `formData.get("instrument")` and validates it is `'guitar'` or `'piano'` (defaults to `'guitar'` if absent); inserts with the `instrument` value; returns `{ instrument, artistSlug, songSlug }` in the success case
  - `updateSongLogic` reads and writes `content` (not `tabContent`); preserves the song's existing `instrument` (instrument cannot be changed on edit — it is fixed at creation); returns `{ instrument, artistSlug, songSlug }`
  - `deleteSongLogic` returns `{ success: true, instrument: string }` so the wrapper can redirect to the correct instrument section
  - `createSong`, `updateSong`, `deleteSong` wrapper functions are NOT yet updated — they still redirect to `/artists/...` (those redirects are updated in ticket 004 once the guitar routes exist)
  - Existing duplicate-song check in `createSongLogic` updated to include `eq(songs.instrument, instrument)` in the WHERE clause
- [x] `src/components/SongForm.tsx`:
  - `SongFormInitialValues` interface renames `tabContent` to `content`
  - Internal state variable renamed from `tabContent` to `content`
  - Textarea `name` attribute changed from `"tabContent"` to `"content"`
  - Preview block reads `content` state variable
  - Accepts optional `instrument?: string` prop; renders a `<input type="hidden" name="instrument" value={instrument} />` when provided
- [x] `src/app/artists/[artistSlug]/[songSlug]/page.tsx`: renders `song.content` (not `song.tabContent`) in the `<pre>` block
- [x] `src/app/edit/[songId]/page.tsx`: passes `initialValues={{ ..., content: song.content }}` and `cancelHref` links updated to pass `instrument` where needed
- [x] `pnpm build` completes without TypeScript errors
- [x] `pnpm test` passes (existing test suite — test file updates are in ticket 003, but the build must not break existing passing tests)
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Creating the `/guitar/...` or `/piano/...` route groups — that is tickets 004 and 007
- Updating wrapper function redirect paths (`createSong`, `updateSong`, `deleteSong`) — those redirects are updated in ticket 004
- Updating `actions.test.ts` — that is ticket 003
- The `Header` component's "＋ Add" link — updated in ticket 004
- The `FAB` component's `href` — updated in ticket 004

## Notes

- `getSongsByArtistId` currently has no instrument filter. After this ticket, all callers must pass `instrument`. The one existing caller (`src/app/artists/[artistSlug]/page.tsx`) should be updated here to pass `'guitar'` as a temporary default until ticket 004 replaces that route.
- The `SongForm` `instrument` prop is optional to maintain backward compatibility with the old `/add` page until ticket 004 removes it.
- The `updateSongLogic` should read the song's instrument from `currentSong.instrument` (already fetched via `getSongById`) rather than accepting it from the form. This prevents changing a guitar song to piano on edit — instrument is immutable after creation per ADR-0005.
- For `getSongCountsByInstrument`, a straightforward approach is two separate count queries or a single `GROUP BY instrument` query. Either works; choose whichever is simpler with the Drizzle API.
- The `content` field in the schema is `text("content").notNull()`. Verify the Drizzle column name mapping is `content` (not `tabContent`) after ticket 001.

## Implementation Plan

Work happens on the `worktree-multi-instrument-001` branch (worktree at `.claude/worktrees/multi-instrument-001`), where ticket 001 already performed the mechanical `tabContent` → `content` rename across all files. This ticket adds the instrument-aware logic on top.

1. `src/db/queries.ts`: add `instrument` parameter to `getSongsByArtistId` and `getSongBySlugs` (WHERE clause via `eq(songs.instrument, instrument)`); add `getSongsByInstrument` (join with artists, ordered by title) and `getSongCountsByInstrument` (single `GROUP BY instrument` query mapped to `{ guitar, piano }`)
2. `src/app/actions.ts`: `createSongLogic` reads and validates `instrument` (`'guitar'`/`'piano'`, defaults `'guitar'`), scopes the duplicate check by instrument, inserts it, and returns it; `updateSongLogic` pins `instrument` from `currentSong` (immutable per ADR-0005), scopes its conflict check by instrument, and returns it; `deleteSongLogic` returns `{ success: true, instrument }`; wrapper functions untouched
3. `src/components/SongForm.tsx`: add optional `instrument` prop rendering a hidden input (rename already done in ticket 001)
4. Update callers of the changed query signatures to pass `'guitar'`: `artists/[artistSlug]/page.tsx` and `artists/[artistSlug]/[songSlug]/page.tsx` (both call sites)
5. Minimal test updates so the existing suite keeps passing against the new signatures/return shapes: `actions.test.ts` success-shape assertions gain `instrument: "guitar"`; `queries.test.ts` calls pass `"guitar"`. New instrument-specific coverage remains ticket 003.
6. Run `pnpm lint`, `pnpm test`, `pnpm build`; commit on the worktree branch; invoke `/ticket-verifier`

**Deviation note:** the ticket's Out of Scope says "Updating `actions.test.ts` — that is ticket 003," but the acceptance criterion "`pnpm test` passes" is unsatisfiable without touching the strict `toEqual` assertions on the changed return shapes. Only those assertions were updated; all new test coverage stays in ticket 003.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
