# Ticket: Artist Page and Song Page

**Feature:** foundation
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0002, ADR-0003

## Context

ADR-0002 defines two read-only detail pages: `/artists/[artist-slug]` showing all songs by a given artist A–Z, and `/artists/[artist-slug]/[song-slug]` showing the full tab with capo badge, tab block, and notes section. The prototype implements these as `ArtistView` and `SongView` inside the single-page `src/app/page.tsx`. This ticket creates proper Next.js dynamic route segments for both pages, each reading from D1 via Drizzle.

## Goal

Implement the artist page (`/artists/[artist-slug]`) and song page (`/artists/[artist-slug]/[song-slug]`) as server-rendered Next.js App Router routes with correct data fetching, tab rendering, and breadcrumb navigation.

## Acceptance Criteria

- [x] `src/app/artists/[artistSlug]/page.tsx` is a Server Component that fetches the artist by slug and all their songs (A–Z by title) from D1; renders the artist name as an `<h1>`, song count subtitle, and a list of `<SongListItem>` rows linking to the song page
- [x] Navigating to an unknown `artistSlug` calls Next.js `notFound()`, resulting in a 404 response
- [x] `src/app/artists/[artistSlug]/[songSlug]/page.tsx` is a Server Component that fetches the song (joined with artist) by both slugs; renders the song title `<h1>`, artist name subtitle, capo badge (if `capo` is not null), tab block, optional notes section, and an Edit ghost button linking to `/edit/[song-id]`
- [x] Navigating to an unknown `songSlug` under a valid artist calls `notFound()`
- [x] The tab block is a styled `<pre>` element with `overflow-x: auto`, `white-space: pre`, paper background (`bg-paper`), warm brown text (`text-tab-text`), subtle border and box shadow, and JetBrains Mono font — matching ADR-0003 tab block spec
- [x] The capo badge on the song page renders at `size="lg"` (larger pill: `px-3 py-1.5 text-[11px]`)
- [x] The notes section only renders when `song.notes` is non-null and non-empty; it shows a mono uppercase label "NOTES" and the notes text in serif italic
- [x] Both pages include a `<Breadcrumb>` with the correct segments: artist page = Home › Artist Name; song page = Home › Artist Name › Song Title (each with correct `href`)
- [x] Next.js page `metadata` is exported from each route: artist page title is "{Artist Name} — Guitar Hub", song page title is "{Song Title} — Guitar Hub"
- [x] Unit tests for the slug-lookup utilities (e.g., `findArtistBySlug`, `findSongBySlugs`) verify not-found returns null
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The edit form or delete action — ticket 006
- The add form — ticket 007
- `generateStaticParams` / static pre-rendering (the app is dynamic — D1 data changes on every add/edit)
- Server actions for write operations

## Notes

- The `generateMetadata` function in each page file should be `async` and query D1 to get the entity name for the title.
- Both pages share a common Drizzle query pattern: join `songs` and `artists` on `songs.artistId = artists.id`, filter by slug(s). Consider a `src/db/queries.ts` file with named query functions (`getArtistBySlug`, `getSongBySlugs`) to keep page components clean.
- The tab block horizontal scroll on mobile is achieved by `overflow-x: auto` on the `<pre>`. No additional JS is needed — the custom scrollbar styles in `globals.css` already style the webkit scrollbar.
- The Edit button on the song page links to `/edit/[song-id]` (using the song's `id`, not its slug) so that the edit page can load the song by primary key without an additional artist-slug lookup.
- Do not add a "Back" button — the Breadcrumb handles navigation.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
