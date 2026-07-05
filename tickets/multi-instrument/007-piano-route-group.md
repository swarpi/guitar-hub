# Ticket: Piano Route Group — Create /piano/... Pages

**Feature:** multi-instrument
**Status:** Todo
**Priority:** P1
**Estimate:** M
**Related:** ADR-0005
**Depends on:** multi-instrument/002

## Context

ADR-0005 adds a `/piano/...` section mirroring the `/guitar/...` structure. After ticket 002, the query and action layers are instrument-aware: `getSongsByInstrument`, `getSongsByArtistId`, and `getSongBySlugs` all accept an `instrument` parameter, and `createSongLogic` accepts and validates `instrument`.

This ticket creates all five piano pages in `src/app/piano/`. The piano song detail page renders `content` in a `<pre>` block for now — identical to how guitar tabs render. Ticket 008 upgrades that block to ABC notation SVG rendering via abcjs.

After this ticket, the full piano CRUD flow works: list songs, add a song, edit a song, view an artist's songs, view a song detail (as preformatted text). ABC staff notation rendering is a rendering upgrade layered on top in ticket 008.

## Goal

All five piano pages exist under `src/app/piano/` and the full piano CRUD flow works end-to-end with `instrument = 'piano'`.

## Acceptance Criteria

- [ ] `src/app/piano/page.tsx` renders the piano song list scoped to `instrument = 'piano'` using `getSongsByInstrument(db, 'piano')`; layout mirrors the guitar list page (A-Z grouping by artist, song count, search input)
- [ ] `src/app/piano/add/page.tsx` renders `SongForm` with a hidden `<input type="hidden" name="instrument" value="piano" />` and breadcrumb `Home → Piano → Add a Song`; on submit calls `createSong`
- [ ] `src/app/piano/edit/[songId]/page.tsx` renders `SongForm` pre-filled with the song's existing data; breadcrumb links are piano-prefixed (`Home → Piano → [Artist] → [Song] → Edit`); `cancelHref` points to `/piano/[artistSlug]/[songSlug]`
- [ ] `src/app/piano/[artistSlug]/page.tsx` renders the artist's piano songs using `getSongsByArtistId(db, artistId, 'piano')`; returns 404 if the artist has no piano songs
- [ ] `src/app/piano/[artistSlug]/[songSlug]/page.tsx` renders the song detail; `content` is displayed in a `<pre>` block (identical to guitar for now); Edit link points to `/piano/edit/[songId]`; uses `getSongBySlugs(db, artistSlug, songSlug, 'piano')`, returns 404 if not found
- [ ] All five piano pages export `export const runtime = "edge"`
- [ ] The `deleteSong` action's `revalidatePath` call is updated from `/guitar` to `/${instrument}` so deleting a piano song revalidates `/piano` (requires reading `instrument` from the deleted song's record)
- [ ] The FAB on piano pages has `href="/piano/add"`
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- ABC notation rendering via abcjs — that is ticket 008; the `<pre>` block in the song detail is intentionally temporary
- App renaming (Guitar Hub → Music Hub) in page titles — that is ticket 009
- Updating the landing page to show the piano song count — the landing page in ticket 005 already calls `getSongCountsByInstrument`, so piano counts appear automatically once piano songs exist; no change needed here

## Notes

- Next.js matches static segments before dynamic segments: `/piano/add` (static) takes priority over `/piano/[artistSlug]` (dynamic). No extra configuration needed.
- The guitar and piano pages are structurally identical except for the `instrument` value passed to queries and the `instrument` hidden field in forms. Copy the guitar pages as a starting point and substitute `'guitar'` with `'piano'`.
- Piano songs have `capo = null` always. The `SongForm` renders the capo field conditionally. Either pass `instrument="piano"` and hide the capo field in the form, or simply let piano songs submit with no capo value (the schema allows null). The simpler approach is to hide the capo field when `instrument="piano"` in `SongForm` — check if ticket 002 already added this conditional rendering; if not, add it here.
- The `cancelHref` in the piano add page should be `/piano`. In the edit page it should be `/piano/${song.artistSlug}/${song.slug}`.
- The `deleteSong` wrapper currently hardcodes `revalidatePath("/guitar")` (set in ticket 004). To support both instruments, read the instrument from `deleteSongLogic`'s return value and call `revalidatePath(\`/\${result.instrument}\`)`. Update both the guitar and piano paths in this one change.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
