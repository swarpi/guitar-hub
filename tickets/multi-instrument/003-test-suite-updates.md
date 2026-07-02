# Ticket: Test Suite Updates — New Schema and Instrument Validation

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** S
**Related:** ADR-0005
**Depends on:** multi-instrument/001, multi-instrument/002

## Context

`src/app/actions.test.ts` uses an in-memory SQLite database built from hardcoded `MIGRATION_STATEMENTS`. After tickets 001 and 002, the schema has changed (`tab_content` renamed to `content`, `instrument` column added, unique index updated) and the actions accept a new `instrument` field with validation logic.

The test file currently references `tabContent` in assertions and its `MIGRATION_STATEMENTS` still reflect the old schema. This ticket brings the test file current and adds coverage for the new instrument behavior.

## Goal

`pnpm test` passes with an updated `actions.test.ts` that uses the new schema and covers instrument validation and the cross-instrument duplicate rule.

## Acceptance Criteria

- [x] `MIGRATION_STATEMENTS` in `actions.test.ts` updated:
  - `tab_content` column renamed to `content` in the `CREATE TABLE songs` statement
  - `instrument TEXT NOT NULL DEFAULT 'guitar'` column added to `CREATE TABLE songs`
  - `CREATE UNIQUE INDEX` updated to `songs_artist_slug_instrument_unique` on `(artist_id, slug, instrument)`
  - Old `songs_artist_slug_unique` index replaced
- [x] All existing test assertions that read `songRows[0].tabContent` updated to `songRows[0].content`
- [x] The `makeFormData` helper calls that pass `tabContent` field updated to `content`
- [x] The `seedSong` helper updated: `tabContent` field renamed to `content` in the `makeFormData` call
- [x] New test: `createSongLogic` with `instrument: "piano"` creates a song with `instrument = 'piano'`
- [x] New test: `createSongLogic` with an invalid `instrument` value (e.g., `"drums"`) returns `{ error: ... }`
- [x] New test: same artist, same title, different instruments — creating a guitar song and then a piano song for the same artist and title succeeds (both are inserted, no duplicate error)
- [x] New test: same artist, same title, same instrument — creating the same song twice under the same instrument returns the duplicate error
- [x] `getSongsByInstrument` query function has at least one test (can be in a new `queries.test.ts` file or appended to `actions.test.ts`)
- [x] `pnpm test` passes with no failures
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Component tests for `SongForm` or page-level tests — those are integration concerns handled in later tickets
- Testing the redirect paths in `createSong`, `updateSong`, `deleteSong` wrappers — those are updated in ticket 004

## Notes

- The test file imports and dynamic-imports pattern must be preserved (`await import("./actions")` after mocks are set up).
- `getSongsByInstrument` tests can use `createSongLogic` to seed data, then call the query directly against the in-memory db. Follow the existing pattern where `db` is cast to `ReturnType<typeof drizzle>` for direct table queries in assertions.
- The `instrument` field in `createSongLogic` defaults to `'guitar'` when absent. Existing tests that do not pass `instrument` should still pass unchanged — verify this expectation holds.
- For the cross-instrument duplicate test, verify both: (a) the `songs` table contains two rows with the same `artist_id` and `slug` but different `instrument`, and (b) `createSongLogic` returns a success result (not an error) for the second song.

## Implementation Plan

1. Verify `MIGRATION_STATEMENTS`, assertions, and helpers were already migrated to the new schema during ticket 002 (they were — baseline run: 33 tests passing)
2. Add instrument tests to the `createSongLogic` describe block: piano creation, invalid instrument (`drums`), cross-instrument duplicate allowed, same-instrument duplicate rejected
3. Add a `getSongsByInstrument` describe block in `actions.test.ts`: filtering + title ordering across guitar/piano seed data, and the empty-result case
4. Run `pnpm test` (39 passing) and `pnpm lint` (clean)

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
