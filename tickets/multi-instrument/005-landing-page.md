# Ticket: Landing Page — Instrument Picker at /

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0005
**Depends on:** multi-instrument/004

## Context

After ticket 004, the root `/` route still serves the old guitar song list (from the previous `page.tsx`). ADR-0005 defines `/` as a landing page showing "Music Hub" branding with two entry points — Guitar and Piano — each displaying their song count.

This ticket replaces the root `page.tsx` with the instrument picker. The guitar song list moves to `/guitar` (ticket 004). The piano section does not exist yet, but the landing page should already show the Piano card pointing to `/piano` with a count of 0.

## Goal

The root `/` renders a landing page with Guitar and Piano instrument cards; each card shows the song count for that instrument and links to its section.

## Acceptance Criteria

- [x] `src/app/page.tsx` renders the Music Hub landing page (the name "Music Hub" is used here as content even though the full app renaming is ticket 009 — or use a placeholder; either is acceptable)
- [x] The page calls `getSongCountsByInstrument(db)` (added in ticket 002) to fetch counts
- [x] A Guitar card displays the guitar song count and links to `/guitar`
- [x] A Piano card displays the piano song count (0 initially) and links to `/piano`
- [x] The page exports `export const runtime = "edge"`
- [x] The `Header` is included (or replaced with a simpler landing-specific header — either is fine)
- [x] The old A-Z song list and search input are NOT present on this page
- [x] `pnpm build` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The full Music Hub rename everywhere (title metadata, manifest, etc.) — that is ticket 009
- Piano route group — that is ticket 007
- Visual polish beyond making the two cards functional and on-brand with the existing design system

## Notes

- The landing page is a new page with no direct equivalent in the existing codebase. Design it to fit the existing "worn leather songbook" aesthetic: warm paper tones, serif typography, the `bg-page`/`bg-canvas` backgrounds from `globals.css`.
- The `FAB` (floating add button) is not appropriate on the landing page since there is no single instrument context. Omit it from this page.
- The `SearchInput` in `Header` is guitar-specific in its current form (it filters the guitar song list). It is appropriate to remove search from the landing page header or render the header without the search bar. Check if `Header` accepts a prop to hide search, or render a simpler header inline.
- The two instrument cards should each show: instrument name, count line (e.g., "12 songs"), and a link/button to enter the section.
- Page title metadata: `"Music Hub"` is fine here even before the full rename in ticket 009. This is the one place where the new name can appear early.

## Implementation Plan

1. Replace `src/app/page.tsx` with the instrument-picker landing page: fetch counts via `getSongCountsByInstrument(db)`, render a Guitar card linking to `/guitar` and a Piano card linking to `/piano`, each with its count line
2. Render a simpler landing-specific header inline (same leather band styling as `Header`, "Music Hub" wordmark, no search input) — `Header` has no prop to hide search and the ticket notes endorse an inline header
3. Set page metadata title to "Music Hub" (the one place the new name appears before ticket 009)
4. Omit the `FAB` (no instrument context on the landing page)
5. Run `pnpm test`, `pnpm lint`, `pnpm build`

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
