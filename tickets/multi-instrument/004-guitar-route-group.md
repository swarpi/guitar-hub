# Ticket: Guitar Route Group — Create /guitar/... Routes and Remove Legacy Routes

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0005
**Depends on:** multi-instrument/002

## Context

The app currently serves guitar content at `/`, `/artists/[artistSlug]`, `/artists/[artistSlug]/[songSlug]`, `/add`, and `/edit/[songId]`. ADR-0005 restructures the URL space so guitar content lives under `/guitar/...`.

This ticket creates all five guitar pages under `src/app/guitar/`, updates the server action wrappers to redirect to instrument-prefixed paths, updates the `Header` and `FAB` components for the guitar context, and deletes the old route directories that are no longer needed.

After this ticket, the old routes no longer exist as pages (they redirect in ticket 006). The landing page at `/` is replaced in ticket 005.

## Goal

All guitar CRUD flows work end-to-end under `/guitar/...`; the old `src/app/artists/`, `src/app/add/`, and `src/app/edit/` directories are removed.

## Acceptance Criteria

- [x] `src/app/guitar/page.tsx` renders the guitar song list (all songs where `instrument = 'guitar'`), A-Z grouped, with search, song count, and artist count — mirrors the current home page content but scoped to guitar
- [x] `src/app/guitar/add/page.tsx` renders `SongForm` with a hidden `instrument="guitar"` input and breadcrumb `Home → Guitar → Add a Song`; on submit calls `createSong` action
- [x] `src/app/guitar/edit/[songId]/page.tsx` renders `SongForm` pre-filled with the existing song; breadcrumb links are instrument-prefixed (e.g., `Home → Guitar → [Artist] → [Song] → Edit`)
- [x] `src/app/guitar/[artistSlug]/page.tsx` renders artist page scoped to guitar songs (uses updated `getSongsByArtistId(db, artistId, 'guitar')`)
- [x] `src/app/guitar/[artistSlug]/[songSlug]/page.tsx` renders song detail with `content` in a `<pre>` block; Edit link points to `/guitar/edit/[songId]`; uses `getSongBySlugs(db, artistSlug, songSlug, 'guitar')`
- [x] All five guitar pages export `export const runtime = "edge"`
- [x] `createSong` wrapper redirects to `/${result.instrument}/${result.artistSlug}/${result.songSlug}` (uses the `instrument` now returned by `createSongLogic`)
- [x] `updateSong` wrapper redirects to `/${result.instrument}/${result.artistSlug}/${result.songSlug}`
- [x] `deleteSong` wrapper redirects to `/${result.instrument}` (e.g., `/guitar`) using the `instrument` from `deleteSongLogic`'s return value; `revalidatePath` updated to `/guitar`
- [x] `src/components/FAB.tsx` accepts an `href` prop (defaults to `"/guitar/add"` or is passed from each page); guitar pages pass `href="/guitar/add"`
- [x] `src/components/Header.tsx` updated: the "＋ Add" button link removed or replaced — it no longer makes sense as a global nav item now that add is instrument-scoped. Either remove the button from Header entirely and rely on per-page FABs, or convert it to a contextual prop. ADR-0005 does not specify — choose the simpler option. Document the choice in Notes below.
- [x] Old directories deleted: `src/app/artists/`, `src/app/add/`, `src/app/edit/`
- [x] `pnpm build` passes with no TypeScript errors
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The landing page at `/` — that is ticket 005
- Redirects for old `/artists/...` URLs — that is ticket 006
- Piano routes — that is ticket 007
- App renaming (Guitar Hub → Music Hub) — that is ticket 009

## Notes

- Next.js matches static segments before dynamic segments: `/guitar/add` (static) takes priority over `/guitar/[artistSlug]` (dynamic). No additional configuration needed.
- The guitar song list page (`guitar/page.tsx`) uses `getSongsByInstrument(db, 'guitar')` added in ticket 002.
- The `Header` "＋ Add" link currently points to `/add`. After this ticket, there is no global add route. **Recommended approach**: remove the add button from `Header` entirely. Each instrument section has its own FAB. The header becomes navigation-only (logo → `/`, search). If search is guitar-specific, the header can be made per-section in a future pass.
- `SongForm`'s `cancelHref` in the guitar add page should be `/guitar`. In the edit page it should be `/guitar/${song.artistSlug}/${song.slug}`.
- Page titles should remain `"... — Guitar Hub"` for now — renaming is ticket 009.
- The `deleteSong` action currently calls `revalidatePath("/")`. After this ticket, it should call `revalidatePath("/guitar")` (and eventually `revalidatePath("/${instrument}")` — but since piano doesn't exist yet, `/guitar` is fine for now).
- **Header choice (documented per acceptance criterion):** the "＋ Add" button was removed from `Header` entirely — the recommended option. Add is instrument-scoped now; each section page renders its own FAB, and the header is navigation-only (logo → `/`, search). `deleteSong` uses `revalidatePath(`/${result.instrument}`)`, the forward-compatible form of `/guitar`.

## Implementation Plan

1. Create the five guitar pages under `src/app/guitar/` mirroring the existing pages: list (uses `getSongsByInstrument(db, 'guitar')`), add (`SongForm` with `instrument="guitar"`, `cancelHref="/guitar"`), edit (instrument-prefixed breadcrumbs and cancel), artist (scoped via `getSongsByArtistId(db, artistId, 'guitar')`), and song detail (`getSongBySlugs(..., 'guitar')`, Edit link to `/guitar/edit/[songId]`)
2. Update action wrappers: `createSong`/`updateSong` redirect to `/${result.instrument}/${artistSlug}/${songSlug}`; `deleteSong` calls `revalidatePath` and `redirect` with `/${result.instrument}` (equals `/guitar` today, forward-compatible with piano per the ticket's note)
3. Give `FAB` an `href` prop defaulting to `/guitar/add`
4. **Header choice:** remove the "＋ Add" button from `Header` entirely (the recommended option in Notes) — add is instrument-scoped now and each section page has a FAB; the header becomes logo + search
5. Delete `src/app/artists/`, `src/app/add/`, `src/app/edit/`
6. Add wrapper redirect tests (deferred from ticket 003's out-of-scope note): `createSong`, `updateSong`, and `deleteSong` redirect to instrument-prefixed paths, with `getDb`/`getRequestContext` mocked
7. Run `pnpm test`, `pnpm lint`, `pnpm build`

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
