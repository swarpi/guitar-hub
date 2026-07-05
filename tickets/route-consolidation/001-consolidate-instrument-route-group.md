# Ticket: Consolidate /guitar and /piano Route Groups into a Dynamic [instrument] Group

**Feature:** route-consolidation
**Status:** Todo
**Priority:** P0
**Estimate:** L
**Related:** ADR-0008, ADR-0005

## Context

Cloudflare Pages fails to publish: the deployed worker bundle is 4.57 MiB gzipped against a 3 MiB free-plan cap. ADR-0008 traces this to `@cloudflare/next-on-pages` emitting one edge function per route, each statically bundling ~1.4 MiB of the Next.js edge runtime. ADR-0005's `/guitar/...` and `/piano/...` route groups duplicate five pages each, doubling the emitted function count from 7 to 14.

ADR-0008's fix is structural, not code-shrinking: collapse the two duplicated route groups into one dynamic `src/app/[instrument]/` group. The five pages currently exist twice under `src/app/guitar/` and `src/app/piano/`; this ticket merges them into five files parameterized by a validated `instrument` segment, preserving every per-instrument behavioral difference and every frozen URL.

Production is currently degraded (see route-consolidation/002) — this ticket is the direct, and only, fix for the bundle-size blocker.

## Goal

`src/app/[instrument]/` contains the five consolidated pages (list, add, edit, artist, song detail), `src/app/guitar/` and `src/app/piano/` no longer exist, every frozen URL still resolves with identical behavior, and unknown instruments 404.

## Acceptance Criteria

- [ ] `src/lib/instruments.ts` created, exporting `INSTRUMENTS = ["guitar", "piano"] as const`, an `Instrument` type, and `assertInstrument(value: string): Instrument` that calls `notFound()` for any value not in `INSTRUMENTS` (per ADR-0008's sketch) — used by all five consolidated pages
- [ ] `src/app/[instrument]/page.tsx` — validates `params.instrument` via `assertInstrument`; lists songs via `getSongsByInstrument(db, instrument)`; section label reads `"The Songbook · Guitar"` or `"The Songbook · Piano"`; `capo` is passed to `SongListItem` only when `instrument === "guitar"`; FAB `href` is `/${instrument}/add`; empty-state CTA link is `/${instrument}/add` and empty-state copy is preserved per instrument ("Add your first tab to begin the collection." for guitar, "Add your first piece to begin the collection." for piano)
- [ ] `src/app/[instrument]/add/page.tsx` — validates instrument; guitar branch renders `AddPageClient` with `existingSongs = getAllSongsFlat(db, "guitar")`, `instrument="guitar"`, `cancelHref="/guitar"`; piano branch renders plain `SongForm` with `instrument="piano"`, `cancelHref="/piano"`; both call the `createSong` action; the `getAllSongsFlat` query runs only on the guitar branch (not invoked for piano); breadcrumb reads `Home → {Guitar|Piano} → Add a Song`
- [ ] `src/app/[instrument]/edit/[songId]/page.tsx` — validates instrument; loads the song via `getSongById`; calls `notFound()` when `song.instrument !== validatedInstrument` (the existing guard, preserved verbatim); breadcrumbs and `cancelHref` are instrument-prefixed; capo field visibility inside `SongForm` is unchanged (already conditional on instrument)
- [ ] `src/app/[instrument]/[artistSlug]/page.tsx` — validates instrument; `getArtistBySlug` + `getSongsByArtistId(db, artist.id, instrument)`; capo passed to `SongListItem` only for guitar; preserves the pre-existing per-instrument discrepancy exactly as it is today: guitar renders the "N songs" state (including "0 songs") without a 404 when the artist has no guitar songs, while piano calls `notFound()` when the artist has no piano songs — see Notes
- [ ] `src/app/[instrument]/[artistSlug]/[songSlug]/page.tsx` — validates instrument; `getSongBySlugs(db, artistSlug, songSlug, instrument)`, `notFound()` if absent; renders a `<pre>` block for guitar and `AbcNotation` for piano; capo badge shown only for guitar; Edit link is `/${instrument}/edit/${song.id}`
- [ ] `generateMetadata` is preserved on the edit and detail pages with unchanged title logic
- [ ] `src/app/guitar/` and `src/app/piano/` directories are deleted in full
- [ ] An unknown instrument segment (e.g. `/banjo`, `/xyz`) returns a 404 via the new `[instrument]` route for the list page and at least one nested shape (e.g. `/banjo/add`)
- [ ] `next.config.mjs` redirects (`/artists/:artistSlug`, `/artists/:artistSlug/:songSlug`, `/add`, `/edit/:songId`) are unchanged and still resolve correctly (static routes continue to win over the dynamic `[instrument]` segment per Next.js routing precedence) — verified by a test or documented manual check
- [ ] Tests added/updated covering: invalid-instrument 404 (list route and one nested route), guitar-only capo rendering on list/artist/detail, guitar-only `AddPageClient` + `getAllSongsFlat` invocation vs piano's plain `SongForm`, `AbcNotation` (piano) vs `<pre>` (guitar) on the detail page, the edit-page instrument guard for both instruments, and the artist-page 0-songs behavior parity (guitar renders empty list, piano 404s)
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Confirming the actual emitted function count and gzipped bundle size, and the production deploy/rollout — that is route-consolidation/002
- Fixing the guitar-vs-piano artist-page 404-on-empty inconsistency — it predates this ADR, is not one of ADR-0008's or ADR-0005's documented differences, and is preserved as-is here rather than silently "fixed" as a side effect of the refactor
- Adding new instruments (e.g. ukulele) — this ADR makes that cheaper but does not execute it
- Changing `next.config.mjs` redirects
- Any change to the D1 schema or the `tab_content → content` column rename — that sequencing lives in route-consolidation/002 and is operator-run

## Notes

- `assertInstrument` centralizes the validation ADR-0008 requires. `src/app/actions.ts` already has its own local `INSTRUMENTS`/`isInstrument` for form validation — that is a different concern (validating a submitted form field, not a URL segment) and does not need to change here, though sharing the list is a reasonable follow-up if it doesn't add risk.
- **Discrepancy found while reading the current code, not called out in ADR-0008 or ADR-0005**: `src/app/guitar/[artistSlug]/page.tsx` renders "0 songs" and an empty list when the artist has no guitar songs; `src/app/piano/[artistSlug]/page.tsx` calls `notFound()` in the same situation. Since ADR-0008 requires preserving ADR-0005 behavior "exactly," and this specific difference was never documented as intentional, the safest move is to preserve both behaviors unchanged (i.e., keep the `if (songs.length === 0) notFound()` branch piano-only) rather than unify them as a side effect of this refactor. Flag it, don't fix it, here.
- The empty-state copy also differs by instrument ("tab" vs "piece") — preserve verbatim.
- A simple `instrument === "guitar" ? "Guitar" : "Piano"` (or a two-entry label map) is sufficient for breadcrumb/section labels — no need for a generic capitalization utility given there are only two values.
- `abcjs` stays behind `dynamic(..., { ssr: false })` in the `AbcNotation` client wrapper — importing that wrapper into the combined `[artistSlug]/[songSlug]/page.tsx` server function does not add `abcjs` to the server bundle (verified in ADR-0008). Don't attempt to further isolate it.
- Copying the existing guitar/piano pages side-by-side and merging them field-by-field is the safest implementation path — the two versions of each page are already nearly identical; the diff is exactly the behaviors listed above.

## Implementation Plan

1. Create branch `route-consolidation` off master
2. `src/lib/instruments.ts` — `INSTRUMENTS`, `Instrument` type, `isInstrument`, `assertInstrument` (calls `notFound()` on unknown values); unit test with `next/navigation` mocked
3. Create the five pages under `src/app/[instrument]/` by merging each guitar/piano pair field-by-field: list (label, capo, empty-state copy, FAB), add (guitar → `AddPageClient` + `getAllSongsFlat(db, "guitar")`, piano → plain `SongForm`; query only runs on the guitar branch), edit (instrument guard preserved), artist (guitar renders "0 songs", piano 404s — preserved discrepancy), song detail (`<pre>` + `CapoBadge` for guitar, `AbcNotation` for piano)
4. Delete `src/app/guitar/` and `src/app/piano/`
5. Page-level tests in `src/app/[instrument]/` covering every AC bullet: invalid-instrument 404 (list + add), capo guitar-only, AddPageClient vs SongForm split, AbcNotation vs pre, edit guard both instruments, artist 0-songs parity — server components invoked with mocked `@cloudflare/next-on-pages` + in-memory sqlite, heavy client children mocked
6. Redirects: documented manual check via dev-server curl (static routes win over `[instrument]`)
7. `pnpm test` / `lint` / `build`; sanity-preview the emitted function count; then `/ticket-verifier`

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
