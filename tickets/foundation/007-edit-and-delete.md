# Ticket: Edit Song Form and Delete Action

**Feature:** foundation
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0002, ADR-0003

## Context

ADR-0002 specifies `/edit/[song-id]` for editing existing songs. ADR-0003 specifies a delete confirmation modal (paper card, dimmed overlay, rust Delete button). The prototype handles both in the same `FormView` component. This ticket creates the edit route, a `updateSong` server action, a `deleteSong` server action, and the delete confirmation modal component.

## Goal

Implement the `/edit/[song-id]` page with server actions for updating and deleting songs, including the delete confirmation modal.

## Acceptance Criteria

- [x] `src/app/edit/[songId]/page.tsx` is a Server Component that fetches the song by `songId` from D1; calls `notFound()` if the song doesn't exist; renders `SongForm` (from ticket 006) pre-populated with the song's current values
- [x] The page heading is "Edit Song"; the breadcrumb shows: Home › Artist Name › Song Title › Edit
- [x] The "Save Changes" primary button submits the `updateSong` server action; "Cancel" links back to the song page at `/artists/[artistSlug]/[songSlug]`
- [x] A "Delete" ghost button (rust `text-delete`, right-aligned) reveals the delete confirmation modal
- [x] The `updateSong` server action in `src/app/actions.ts` validates inputs (same rules as `createSong`), updates the song record, handles slug conflicts, updates `updated_at`, and redirects to the updated song URL
- [x] If the artist name changes to a new artist that doesn't exist, `updateSong` upserts the new artist; if the old artist has no remaining songs after the update, it is deleted from the `artists` table
- [x] The `deleteSong` server action deletes the song, then deletes the artist if they have no remaining songs, and redirects to `/`
- [x] `src/components/DeleteModal.tsx` is a `"use client"` component that renders the ADR-0003 modal: fixed overlay (`bg-[rgba(40,28,16,0.55)]`), centered paper card (max 400px), serif heading "Delete this song?", description with song title and artist, "Cancel" ghost button, "Delete" rust primary button
- [x] The delete modal is triggered by the client-side Delete button in `SongForm`; it calls `deleteSong` on confirm
- [x] Vitest tests for `updateSong`: (a) valid update changes title and slug, (b) artist rename upserts new artist and cleans orphaned artist, (c) missing required fields return error; tests for `deleteSong`: (a) deletes song and orphaned artist, (b) does not delete artist with remaining songs
- [x] The FAB is hidden on the edit page
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — verified 2026-06-20

## Out of Scope

- Soft-delete or undo — data is permanently removed immediately
- Bulk delete
- Image or file attachments

## Notes

- The `SongForm` component (ticket 006) receives `initialValues` (the existing song data) and an optional `songId` prop. When `songId` is present, the form renders in edit mode: heading changes, primary button says "Save Changes", and the Delete button is visible.
- The Delete button in the form calls a client-side state setter to show the modal — it does not submit the form. The modal's confirm button calls `deleteSong` via a `<form action={deleteSong}>` with a hidden `songId` input.
- The orphaned-artist cleanup (`DELETE FROM artists WHERE id = ? AND NOT EXISTS (SELECT 1 FROM songs WHERE artist_id = ?)`) should be a single SQL operation in the server action, not two round trips.
- The `updated_at` timestamp must be set to `new Date().toISOString()` in the `updateSong` action, not left to a database trigger (D1 SQLite doesn't have automatic timestamp triggers unless explicitly defined).
- The redirect after update should go to the new song URL (which may have changed if the title or artist name changed).
- `deleteSong` must use `revalidatePath("/")` before `redirect("/")` so the home page cache is invalidated.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
