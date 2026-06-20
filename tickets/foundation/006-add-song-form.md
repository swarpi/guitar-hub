# Ticket: Add Song Form and Server Action

**Feature:** foundation
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0002, ADR-0003

## Context

ADR-0002 specifies an `/add` page where the user pastes a tab and fills in song metadata. The write path uses Next.js Server Actions — the same action that the form calls can later be called by an AI API route without changing the business logic. The prototype implements add/edit in a single `FormView` component inside the SPA. This ticket creates the dedicated `/add` route with a server action that writes to D1 via Drizzle, handling slug generation, artist upsert, and redirect on success.

## Goal

Implement the `/add` page with a server action that creates a new artist (if needed) and a new song in D1, then redirects to the song page.

## Acceptance Criteria

- [x] `src/app/add/page.tsx` renders the "Add a Song" form as a Server Component page; the form itself (`src/components/SongForm.tsx`) is a `"use client"` component with controlled inputs
- [x] The form has fields for: Song Title (text), Artist (text with `<datalist>` of existing artists), Capo (number input, 0–12, optional, `max-w-[170px]`), Tab Content (textarea, monospace, `min-h-[210px]`), Notes (textarea, serif, optional); all per ADR-0003 form input styles
- [x] A live tab preview (`<pre>` block) appears below the Tab Content field when the textarea is non-empty
- [x] The "Save to Songbook" primary button submits the form; "Cancel" returns the user to `/` (home)
- [x] A `createSong` server action in `src/app/actions.ts` validates inputs (title, artist, and tab content are required; capo must be 0–12 if provided), upserts the artist (insert if slug doesn't exist; no-op if it does), inserts the song with a nanoid, and calls `redirect()` to the new song's URL
- [x] If the song title + artist combination would produce a duplicate slug under that artist, the action returns a validation error displayed inline (not a thrown exception)
- [x] The server action sets `created_at` and `updated_at` to the current ISO 8601 timestamp
- [x] The breadcrumb on the page shows: Home › Add a Song
- [x] The FAB is hidden on this page (form pages do not show the FAB per ADR-0003)
- [x] Vitest tests for the `createSong` action logic (unit-tested against an in-memory SQLite via `better-sqlite3`): (a) valid input creates artist + song, (b) duplicate slug returns error, (c) missing required fields return error
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Edit song form — ticket 007
- Delete confirmation modal — ticket 007
- The `<datalist>` of existing artists requires a server fetch of all artist names, which happens in the page Server Component; no client-side fetch needed

## Notes

- The `SongForm` component is shared between Add (ticket 006) and Edit (ticket 007). Design it to accept an optional `initialValues` prop. When `initialValues` is absent, the form is in "add" mode.
- Server actions use `"use server"` at the top of the action file or inline. For reuse across add and edit, place actions in `src/app/actions.ts`.
- Slug generation for songs: `slugify(title)`. If the same artist already has a song with that slug, append a short suffix (e.g., `-2`). Keep this logic in the server action, not in the form component.
- Artist upsert: `INSERT INTO artists ... ON CONFLICT(slug) DO NOTHING` — Drizzle's `.onConflictDoNothing()`.
- The `redirect()` call from `next/navigation` must be called outside a `try/catch` block in server actions (it throws internally).
- Form validation errors should be returned as a typed object `{ error: string }` from the action, not thrown. The client component reads this and shows the error inline.
- The `<datalist>` for artist autocomplete requires the list of existing artist names, fetched server-side in the page component and passed as a prop to `SongForm`.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
