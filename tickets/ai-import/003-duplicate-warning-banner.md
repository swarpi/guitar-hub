# Ticket: Duplicate Warning Banner in Review Step

**Feature:** ai-import
**Status:** Todo
**Priority:** P1
**Estimate:** S
**Related:** ADR-0006

## Context

After the AI extracts song fields and the user enters the review step (ticket 001 and 002), there is a risk that the extracted song already exists in the collection. ADR-0006 specifies an advisory warning banner: "A song called [title] by [artist] may already exist in your songbook." This is non-blocking — the user can still edit fields or proceed to save. The server action (`createSongLogic`) enforces the hard uniqueness constraint; the banner surfaces the issue earlier at the cheapest possible moment.

The current `/add` page server component loads only artist names. This ticket extends that query to also load a flat `{ title, artistName }` list for all songs, passes it to the client wrapper, and shows the banner when a case-insensitive match is detected.

## Goal

Show a non-blocking advisory warning banner during the review step when the extracted title and artist match an existing song, and pass the necessary data from the server component to support this check.

## Acceptance Criteria

- [ ] A new query function `getAllSongsFlat(db)` (or inline query) is added to `src/db/queries.ts` that returns `{ title: string, artistName: string }[]` via a join of `songs` and `artists`
- [ ] `src/app/add/page.tsx` calls this query and passes the result to `AddPageClient` as a new prop `existingSongs: { title: string; artistName: string }[]`
- [ ] `AddPageClient` accepts the `existingSongs` prop
- [ ] In the review step, `AddPageClient` checks for a duplicate by comparing `extractedFields.title` and `extractedFields.artist` against `existingSongs` using case-insensitive string comparison
- [ ] When a duplicate is found, a warning banner is shown above the `SongForm` with the text: "A song called '[title]' by '[artist]' may already exist in your songbook."
- [ ] The warning banner is styled using warning-appropriate design system tokens (e.g., amber/orange tones). Look at the existing error text style (`text-delete` in `SongForm.tsx`) and choose a visually distinct warning variant.
- [ ] The warning banner does not block form submission — the "Save to Songbook" button remains active
- [ ] When no duplicate is found, no banner renders (the review step looks the same as before)
- [ ] When `existingSongs` is empty, no banner renders
- [ ] The manual mode path is unaffected — no banner ever appears when the user is in manual mode
- [ ] `pnpm build` compiles without errors
- [ ] `pnpm lint` passes on all changed files
- [ ] Tests cover:
  - [ ] Duplicate found (case-insensitive match on both title and artist) → banner rendered with correct text
  - [ ] Title matches but artist differs → no banner
  - [ ] Artist matches but title differs → no banner
  - [ ] Empty `existingSongs` array → no banner
  - [ ] Manual mode active → no banner
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Blocking submission when a duplicate is detected — the server action (`createSongLogic`) handles the hard constraint
- Real-time banner updates as the user edits title/artist fields in the review form — the warning is based on initial extracted values only; if the user changes the title, the banner may remain (acceptable for Phase 1)
- Pagination or limiting the songs list fetch — a personal collection is small enough that loading all songs is not a concern
- Any change to `src/app/actions.ts`, `src/db/schema.ts`, `scripts/ai-proxy.ts`, or `SongForm.tsx`

## Notes

**Query:** A simple inline join in `AddPage` is acceptable if the function is small. If adding to `queries.ts`, name it `getAllSongsFlat`. The SQL is:

```typescript
db.select({ title: songs.title, artistName: artists.name })
  .from(songs)
  .innerJoin(artists, eq(songs.artistId, artists.id))
  .orderBy(asc(songs.title))
```

**Case-insensitive comparison:** `title.toLowerCase() === extracted.title.trim().toLowerCase()` and the same for artist name. Trim both sides to avoid leading/trailing whitespace mismatches from AI extraction.

**Warning banner placement:** Render it between the "Back to Import" button and the `SongForm`, so it appears visually between the navigation control and the editable form fields.

**Warning banner styling example** (adapt to match the design system):

```tsx
<div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 font-serif text-[14px] text-amber-800">
  A song called &ldquo;{title}&rdquo; by &ldquo;{artist}&rdquo; may already exist in your songbook.
</div>
```

Check the actual Tailwind color palette in use — Guitar Hub uses custom tokens (`bg-leather`, `text-ink`, etc.) defined in the global CSS. If an amber/warning token does not exist, use a Tailwind built-in amber class. Do not add a new CSS variable for a single use.

**Test setup:** The duplicate check logic lives in `AddPageClient`. Tests for it can either render `AddPageClient` with mocked `existingSongs` and `extractedFields` or extract the comparison into a pure helper function that is tested directly — the pure function approach is simpler.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
