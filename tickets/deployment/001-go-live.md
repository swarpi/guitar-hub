# Ticket: Go Live — Provision D1, Migrate, Seed, Deploy

**Feature:** deployment
**Status:** Todo
**Priority:** P0
**Estimate:** S
**Related:** ADR-0004

## Context

Foundation ticket 008 wired up the Cloudflare Pages build pipeline: `wrangler.toml` has the D1 binding (with placeholder `database_id`), `pages:build` runs `@cloudflare/next-on-pages`, and `wrangler pages deploy` is the deploy command. What remains is execution — provisioning the actual D1 database, applying the migration, seeding the 21 songs, building, and deploying. Until this is done the app exists only in local development.

The seed script (`src/db/seed.ts`) uses `better-sqlite3` and targets the local Wrangler D1 SQLite file. It cannot be run directly against the remote D1. The two practical approaches are: (a) run the seed script locally first, then use `wrangler d1 export` to dump the populated local database to SQL and replay it against the remote; or (b) adapt the seed script to use `wrangler d1 execute` statements. The simpler approach — and the one this ticket uses — is to generate a seed SQL file and apply it via `wrangler d1 execute --file`.

## Goal

Guitar Hub is live on Cloudflare Pages with a functioning D1 database seeded with 21 songs across 8 artists, accessible from any device at the `*.pages.dev` URL.

## Acceptance Criteria

- [ ] `wrangler d1 create guitar-hub` executed and the returned `database_id` recorded
- [ ] `wrangler.toml` updated with the actual `database_id` (replacing `"your-d1-database-id"`) and the change committed
- [ ] Initial migration applied to the live D1: `wrangler d1 execute guitar-hub --file=migrations/0000_initial.sql` exits without error
- [ ] A `scripts/seed.sql` file generated from the seed data, containing `INSERT INTO artists` and `INSERT INTO songs` statements for all 21 songs across 8 artists
- [ ] Seed SQL applied to the remote D1: `wrangler d1 execute guitar-hub --file=scripts/seed.sql` exits without error
- [ ] `pnpm pages:build` completes without errors
- [ ] `wrangler pages deploy .vercel/output/static` completes successfully and prints the `*.pages.dev` URL
- [ ] Smoke test: home page loads and displays all 21 songs in A-Z order
- [ ] Smoke test: navigating to an artist page shows that artist's songs
- [ ] Smoke test: a song detail page renders the tab content in the monospace block, capo badge, and notes
- [ ] Smoke test: adding a new song via `/add` writes to D1 and the song appears on the home page
- [ ] Smoke test: editing a song via the edit form persists the change
- [ ] Smoke test: deleting a song removes it from the index
- [ ] `pnpm lint` passes
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Custom domain configuration (the default `*.pages.dev` URL is sufficient)
- CI/CD pipeline (manual `wrangler pages deploy` is the deploy workflow)
- SSL/TLS configuration (Cloudflare manages this automatically)
- Environment variables beyond the D1 binding already in `wrangler.toml`
- Authentication or access control

## Notes

- **Generating `scripts/seed.sql`**: The seed data is in `src/db/seed.ts`. The cleanest approach is a small script (`scripts/generate-seed-sql.ts`) that iterates over the same `SEED_SONGS` array and writes `INSERT INTO artists` and `INSERT INTO songs` statements with hardcoded UUIDs (use `nanoid()` to generate IDs during script execution, then write them as string literals). Run it with `pnpm tsx scripts/generate-seed-sql.ts > scripts/seed.sql`. Commit `scripts/seed.sql` alongside `scripts/generate-seed-sql.ts`.
- **Wrangler.toml `database_id`**: After `wrangler d1 create guitar-hub`, the CLI prints a TOML snippet with the `database_id`. Copy that value into `wrangler.toml`. Commit this change — future `wrangler pages deploy` runs need it.
- **Deployment output path**: The `pages:build` script runs `@cloudflare/next-on-pages`, which writes output to `.vercel/output/static`. This path is the argument to `wrangler pages deploy`.
- **`wrangler d1 execute` flags**: Use `--remote` flag if wrangler defaults to local mode: `wrangler d1 execute guitar-hub --remote --file=migrations/0000_initial.sql`.
- **Build verification**: `pnpm pages:build` was last confirmed passing in foundation ticket 008. If it fails, check `@cloudflare/next-on-pages` version compatibility with Next.js 16.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
