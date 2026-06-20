# Ticket: Home Page — Song-Ordered A-Z Index

**Feature:** foundation
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0002, ADR-0003

## Context

ADR-0003 specifies a home page that lists all songs A–Z by title, grouped under alphabetical letter dividers (A, C, D...), with each row showing the song title, italic artist subtitle, and a capo badge if applicable. The prototype implements this in `HomeView` inside `src/app/page.tsx` using in-memory data from `localStorage`. This ticket replaces that SPA view with a proper Next.js App Router Server Component at `/` that reads songs from the Cloudflare D1 database via Drizzle. It also implements client-side search filtering via the URL `?q=` param established in ticket 003.

## Goal

Implement the `/` route as a server-rendered page that displays all songs A–Z, with letter dividers and artist subtitles, filtered by the optional `?q=` search param.

## Acceptance Criteria

- [x] `src/app/page.tsx` is a Server Component that fetches all songs (joined with artist name) from D1 via Drizzle, sorted A–Z by title
- [x] Songs are grouped into letter sections; each section renders a letter header in mono font, accent-green, uppercase, then the list of `<SongListItem>` rows linking to `/artists/[artist-slug]/[song-slug]`
- [x] Each `SongListItem` on the home page shows: song title (primary), artist name (italic subtitle), capo badge if `capo` is not null
- [x] When `?q=` is present in the URL, only songs whose title or artist name contains the query string (case-insensitive) are shown; zero-result state renders "No songs match '...'" message in serif italic
- [x] Empty-state (no songs in database) renders: heading "Your songbook is empty", italic subtitle, and a primary button linking to `/add`
- [x] The page header shows total song count and artist count: "21 songs · 8 artists" in serif italic below "THE SONGBOOK" mono label
- [x] Navigating to the home page from any other page includes the `ghFade` entry animation on the content wrapper
- [x] The `FAB` component (ticket 003) is visible on the home page
- [x] A Vitest test for the song-grouping logic (`groupSongsByLetter`) verifies: all letters present, correct letter assignment for titles starting with special chars (#), empty array returns empty sections
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The artist page at `/artists/[artist-slug]` — ticket 005
- The song page at `/artists/[artist-slug]/[song-slug]` — ticket 005
- The search input UI itself — already done in ticket 003's Header component
- Adding or editing songs — tickets 006 and 007
- Removing the old `src/app/page.tsx` SPA prototype (this ticket replaces it entirely)

## Notes

- The `groupSongsByLetter` utility function (extracted from the prototype's `getSongSections`) should live in `src/lib/songs.ts` and be unit-tested independently of the React component.
- Titles starting with a digit or non-alpha character should fall under `#` as the letter header.
- The search filter runs against a `searchParams.q` prop in the Server Component; no client-side state needed. The `<input>` in the Header (from ticket 003) pushes `?q=` to the URL via `router.push` or `<form action="/">`.
- The Drizzle query joins songs and artists: `db.select({ title: songs.title, artistName: artists.name, artistSlug: artists.slug, songSlug: songs.slug, capo: songs.capo }).from(songs).leftJoin(artists, eq(songs.artistId, artists.id)).orderBy(asc(songs.title))`.
- For local development before a real D1 database exists, `wrangler dev` with `--local` uses a local SQLite file. The dev workflow note should be captured in the implementation plan.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
