# Ticket: Schema Migration — Add Instrument Column, Rename tab_content, Update Unique Index

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0005

## Context

The current `songs` table has a `tab_content` column and a unique constraint on `(artist_id, slug)`. To support multiple instruments, ADR-0005 requires three schema changes:

1. Add an `instrument TEXT NOT NULL DEFAULT 'guitar'` column. Existing rows get the default.
2. Rename `tab_content` to `content` for instrument-neutral semantics.
3. Expand the unique constraint from `(artist_id, slug)` to `(artist_id, slug, instrument)` so the same artist can have "River Flows in You" as both a guitar tab and a piano sheet.

This ticket covers the SQL migration file and the Drizzle schema TypeScript file. All downstream code that references `tabContent` or the old constraint is handled in ticket 002.

## Goal

Produce a migration SQL file and an updated `src/db/schema.ts` that reflect the new `songs` table shape; all other files are untouched.

## Acceptance Criteria

- [x] `migrations/0001-multi-instrument.sql` exists with three statements: `ALTER TABLE songs ADD COLUMN instrument`, `ALTER TABLE songs RENAME COLUMN tab_content TO content`, `DROP INDEX ... / CREATE UNIQUE INDEX` for the expanded constraint
- [x] `src/db/schema.ts` `songs` table definition adds `instrument: text("instrument").notNull().default("guitar")`, renames the `tabContent` field to `content` (mapped to column `content`), and updates the `unique()` call to include `table.instrument`
- [x] The Drizzle-generated TypeScript type for a `songs` row exposes `instrument: string` and `content: string` (no `tabContent`)
- [x] Running the migration SQL against a local SQLite database leaves existing rows with `instrument = 'guitar'` and renames the column correctly
- [x] `pnpm build` compiles without errors after the schema change (other files will have type errors until ticket 002 — verify this ticket alone does not break the build by checking that schema.ts compiles in isolation, or note the expected downstream type errors clearly)
- [x] `pnpm lint` passes on changed files
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Updating `src/db/queries.ts`, `src/app/actions.ts`, page components, or tests — that is ticket 002 and 003
- Running the migration on the production D1 database — that happens after all code changes land
- Adding a `CHECK(instrument IN ('guitar', 'piano'))` constraint — ADR-0005 explicitly deferred this; application-level validation handles it

## Notes

- The migration file numbering follows the existing `migrations/0000_initial.sql` pattern. Name it `0001-multi-instrument.sql` (no Drizzle CLI meta file needed — this project applies migrations manually via `wrangler d1 execute`).
- SQLite 3.25.0+ supports `ALTER TABLE RENAME COLUMN`. Cloudflare D1 uses a modern SQLite engine; this is safe.
- SQLite has no `DROP CONSTRAINT` command. The index must be dropped by name (`DROP INDEX IF EXISTS songs_artist_slug_unique`) and recreated as `songs_artist_slug_instrument_unique` on `(artist_id, slug, instrument)`.
- The Drizzle `unique()` helper in `schema.ts` takes a name string and `.on(cols...)`. Update the name to `"songs_artist_slug_instrument_unique"` to match the SQL.
- After this ticket, `pnpm build` will likely show TypeScript errors in files that still reference `songs.tabContent`. That is expected and will be fixed in ticket 002. The build check for this ticket is limited to `schema.ts` compiling correctly.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
