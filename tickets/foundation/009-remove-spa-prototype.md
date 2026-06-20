# Ticket: Remove SPA Prototype and Migrate Seed Data

**Feature:** foundation
**Status:** Done
**Priority:** P2
**Estimate:** S
**Related:** ADR-0002

## Context

The project currently has a working localStorage-backed SPA in `src/app/page.tsx` (677 lines), `src/lib/store.ts`, and `src/lib/types.ts`. These files were the prototype before the real database and App Router pages were built. Once tickets 002–007 are complete, the prototype is obsolete and should be removed to prevent confusion. The 21 seed songs from the prototype should be ported to a Drizzle seed script so the database can be populated for local development.

## Goal

Remove the prototype files, replace the flat `Song`/`Artist` TypeScript interfaces with the Drizzle-derived types, and provide a database seed script for local development.

## Acceptance Criteria

- [x] `src/app/page.tsx` is replaced by the new home page from ticket 004 (this file should already be the correct implementation; verify it contains no SPA routing code)
- [x] `src/lib/store.ts` is deleted
- [x] `src/lib/types.ts` is deleted; any remaining consumers use Drizzle-inferred types (`InferSelectModel<typeof songs>` etc.) or thin interface wrappers in `src/lib/`
- [x] `src/db/seed.ts` is a script that inserts the 21 prototype songs (with their artists, tabs, capo values, and notes) into the local D1 database using Drizzle; runnable via `pnpm tsx src/db/seed.ts` with the local `better-sqlite3` instance
- [x] A `seed` npm script is added: `"seed": "tsx src/db/seed.ts"`
- [x] `tsx` is added as a dev dependency (for running TypeScript scripts without compiling)
- [x] Running `pnpm seed` against a fresh local SQLite file produces 8 artists and 21 songs
- [x] No references to `localStorage`, `loadSongs`, `saveSongs`, `STORAGE_KEY` remain anywhere in `src/`
- [x] `pnpm build` succeeds
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Migrating existing localStorage data for any real users (personal app, single user, acceptable to start fresh)
- A web-based admin seeding UI

## Notes

- Drizzle type inference: `type Song = InferSelectModel<typeof songs>` from `drizzle-orm`. This replaces the handwritten `Song` interface in `src/lib/types.ts`.
- The seed script uses `better-sqlite3` directly (same pattern as the unit tests) and does not need the Cloudflare `getRequestContext()` binding. Point it at a local `.dev.vars` SQLite file or a path configurable via env var.
- After this ticket, any remaining references to the old types in component props should use the Drizzle-inferred types or thin view-layer interfaces (e.g., `SongRow = Pick<Song, 'id' | 'title' | 'slug' | 'capo'>`) to avoid importing the full Drizzle schema into client components.
- The `src/lib/slugify.ts` and `src/lib/nanoid.ts` utilities (created in ticket 002) survive — they are not part of the prototype.

## Implementation Plan

1. Deleted `src/lib/store.ts` (localStorage-based song persistence) and `src/lib/types.ts` (handwritten `Song`/`Artist` interfaces) — both are superseded by Drizzle schema and inferred types
2. Created `src/db/seed.ts` — a standalone script using `better-sqlite3` and Drizzle that runs the initial migration, inserts 8 artists and 21 songs with tabs, capo values, and notes
3. Added `tsx` (v4.22.4) as a dev dependency for running TypeScript scripts without a compile step
4. Added `"seed": "tsx src/db/seed.ts"` script to `package.json`
5. Verified no remaining references to `localStorage`, `loadSongs`, `saveSongs`, or `STORAGE_KEY` in `src/`
6. Confirmed `pnpm build`, `pnpm test` (33/33), and `pnpm lint` all pass

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
