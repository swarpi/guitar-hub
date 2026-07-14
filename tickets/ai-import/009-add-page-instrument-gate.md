# Ticket: Add Page — Widen AI-Import Gate to Guitar and Piano

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0009 (Section 1a "Widening the AI-import gate to guitar and piano")

## Context

`src/app/[instrument]/add/page.tsx` currently routes only guitar through `AddPageClient` (which hosts the Manual/Import toggle and the duplicate-warning banner); piano falls through to a bare `SongForm`, and `getAllSongsFlat` is fetched only for guitar. ADR-0009 §1a widens this because Image mode's primary motivating use case is piano song sheets (staff notation) — a guitar-only Image mode would miss the main reason the feature exists.

`AddPageClient` already accepts `instrument` and `existingSongs` as props and is instrument-agnostic (ADR-0009 §8: "None ... already instrument-agnostic"); this ticket only changes which instruments the page routes through it and for which instruments the duplicate-check query runs. Text and URL import modes come along for free on piano as a side effect of this change — ADR-0009 §1a explicitly accepts that ("acceptable — but the motivating and primary path is Image").

This ticket has no code dependency on ai-import/006, 007, or 008 (proxy image handling, the normalization module, and the ImportForm image mode) — it only changes routing/data-fetching on the add page. It can be implemented at any point, though the Image mode it unblocks for piano only becomes usable end-to-end once ai-import/008 has also landed.

## Goal

Route both guitar and piano through `AddPageClient` on `/[instrument]/add`, fetching the duplicate-check song list for both instruments.

## Acceptance Criteria

- [x] `src/app/[instrument]/add/page.tsx`'s gate changes from `instrument === "guitar"` to admit both `"guitar"` and `"piano"` (e.g. `instrument === "guitar" || instrument === "piano"`, or equivalent using `INSTRUMENTS`/`isInstrument` from `@/lib/instruments` if cleaner)
- [x] `getAllSongsFlat(db, instrument)` is now called for both `"guitar"` and `"piano"` (previously only for `"guitar"`) — the `Promise.all` fetch no longer conditions the query on the instrument being guitar specifically
- [x] For both guitar and piano, the page renders `<AddPageClient artistNames={...} existingSongs={...} action={createSong} instrument={instrument} cancelHref={`/${instrument}`} />`
- [x] No other instrument (e.g. a hypothetical future `"ukulele"`) is admitted by this change — the gate remains exactly `"guitar" | "piano"`, matching the current `Instrument` union in `@/lib/instruments`
- [x] The stale comment above the `Promise.all` ("The AI import (and its duplicate check) is guitar-only...") is removed or updated to reflect the new guitar-and-piano behavior
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` passes on all changed files
- [x] `src/app/[instrument]/pages.test.tsx`'s `"add page"` describe block is updated:
  - [x] The existing guitar case (`"renders AddPageClient with the duplicate-check list for guitar"`) continues to pass unmodified
  - [x] The existing piano case (`"renders a plain SongForm for piano and skips the duplicate query"`) is replaced with a case asserting piano now renders `AddPageClient` with `data-instrument="piano"`, `data-cancel="/piano"`, and `data-existing` equal to the seeded piano song count, and that `getAllSongsFlat` **was** called with `"piano"` as its second argument
  - [x] The invalid-instrument 404 case (`"404s on the add route"`) continues to pass unmodified
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `AddPageClient.tsx`'s own logic beyond what ai-import/008 needs to thread the `instrument` prop into `ImportForm` (that prop-threading is owned by ai-import/008, not this ticket, since `AddPageClient` already receives and forwards `instrument` to `SongForm` today)
- Any change to `ImportForm.tsx`, `scripts/ai-proxy.ts`, or `scripts/image-import.ts`
- Widening the gate to any instrument beyond guitar and piano
- Any change to `getAllSongsFlat`'s query implementation in `src/db/queries.ts` — it is already instrument-parameterized and used correctly here, just called under a new condition

## Notes

**Independent of the image-mode tickets.** This ticket is purely about routing and data-fetching on the add page; it does not touch `ImportForm` or the proxy. It can be picked up in any order relative to ai-import/006, 007, and 008. It should land before or alongside ai-import/008 if the goal is to exercise Image mode on piano end-to-end during that ticket's manual verification — but nothing in this ticket's own acceptance criteria requires that ordering.

**Existing metadata fixture.** `pages.test.tsx` already seeds one guitar song and one piano song (`seedBoth`) specifically to exercise instrument-scoped behavior across all pages in this route group — reuse that fixture rather than adding a new one.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
