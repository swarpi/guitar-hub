# Ticket: Schema Migration — Add difficulty, key, and source_url Columns

**Feature:** sheet-ingest
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0007 (Decision §1 "New metadata columns"), ADR-0005 (schema precedent)

## Context

ADR-0007 designs `add_sheet`, the MCP tool that writes ingested notation into the collection, around three metadata fields the current schema does not have: `difficulty`, `key`, and `source_url`. The ADR resolves the "where do these fields live" question explicitly (Assumptions and Open Questions, item 3): they become first-class nullable `TEXT` columns via a small additive migration, not values stuffed into the existing `notes` field. Rationale: `difficulty` and `key` are exactly the fields a personal collection gets filtered by ("show me easy songs in G"), and `source_url` is mechanical provenance data the pipeline should record structurally, not as prose the user has to parse later.

This migration follows the same additive pattern ADR-0005 used for the `instrument` column: `ALTER TABLE ... ADD COLUMN`, nullable, no data transformation, safe against existing rows.

**Hard dependency:** this migration builds on top of the `songs` table shape that ADR-0005 produces (`instrument` column, `tab_content` renamed to `content`). That work is implemented on the unmerged branch `worktree-multi-instrument-001` (worktree at `.claude/worktrees/multi-instrument-001`) and has not landed on `master`. This ticket is **blocked until the multi-instrument branch merges to master.** Do not start this ticket against `master`'s current schema (`tab_content`, no `instrument` column) — the migration and Drizzle types must be written against the post-merge schema.

## Goal

Add nullable `difficulty`, `key`, and `source_url` TEXT columns to `songs`, update the Drizzle schema, and expose the fields as optional inputs on the manual add/edit form so they can be set outside the MCP pipeline too.

## Acceptance Criteria

- [x] The multi-instrument branch (`worktree-multi-instrument-001`) has merged to `master` before this ticket starts; confirm `src/db/schema.ts` on `master` already has `instrument` and `content` (not `tab_content`) before writing the migration
- [x] A new migration file (next number after the multi-instrument migration, e.g. `migrations/0002-sheet-metadata.sql`) adds three nullable columns to `songs`: `difficulty TEXT`, `key TEXT`, `source_url TEXT`
- [x] `src/db/schema.ts` `songs` table definition adds `difficulty: text("difficulty")`, `key: text("key")`, `sourceUrl: text("source_url")` — all nullable, no `.notNull()`
- [x] `createSongLogic` and `updateSongLogic` in `src/app/actions.ts` accept optional `difficulty`, `key`, and `sourceUrl` fields from `FormData`, trim them, store empty string as `null`, and pass them through to the insert/update
- [x] `difficulty`, when provided, is validated against the set `'beginner' | 'intermediate' | 'advanced'`; an invalid value returns `{ error: "Difficulty must be beginner, intermediate, or advanced." }`
- [x] `SongForm` gains three optional fields (difficulty select, key text input, source URL text input), positioned near `notes`; existing required fields and behavior are unchanged
- [x] Song detail pages render `difficulty`, `key`, and `source_url` when present (e.g., alongside capo/notes), and render nothing extra when they are `null`
- [x] Running the new migration SQL against a local SQLite database with existing rows leaves `difficulty`, `key`, and `source_url` as `NULL` on those rows
- [x] `pnpm test`, `pnpm lint`, and `pnpm build` pass
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The MCP server or any `add_sheet` tool implementation — that is ticket 002
- Filtering/sorting the song list by `difficulty` or `key` — a future convenience, not required by this ADR
- A `CHECK` constraint on `difficulty` in SQLite — application-level validation only, consistent with how `instrument` was handled in ADR-0005
- Running the migration against production D1 — happens after the multi-instrument migration is also applied to production, as its own deploy step

## Notes

- Follow the numbering and format precedent of `migrations/0001-multi-instrument.sql` (see `tickets/multi-instrument/001-schema-migration.md`) — a plain SQL file applied manually via `wrangler d1 execute`, no Drizzle CLI meta file.
- `key` as a column name is a SQL keyword in some dialects; SQLite tolerates it unquoted in practice, but quote it in the migration SQL to avoid ambiguity. Drizzle's `text("key")` maps the TS field name independently of the column name, so this is a migration-file concern only.
- This ticket intentionally lands the schema/form/action changes before any MCP server code exists (ticket 002), so `add_sheet` in ticket 002 can rely on `createSongLogic` already accepting these fields — no second write path.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
