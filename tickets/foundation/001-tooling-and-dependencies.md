# Ticket: Tooling and Dependency Setup

**Feature:** foundation
**Status:** Done
**Priority:** P0
**Estimate:** S
**Related:** ADR-0002

## Context

The project was scaffolded with `create-next-app`, which installed Next.js 16, React 19, Tailwind CSS 4, and ESLint. The ADR specifies a different toolchain: Biome replaces ESLint/Prettier, Vitest replaces Jest, and additional runtime dependencies (Drizzle ORM, Cloudflare D1 adapter, nanoid) plus Cloudflare Pages build tooling must be added. The `package.json` currently uses a generic `guitar-hub-init` name and is missing all database, ORM, and test dependencies.

## Goal

Bring `package.json`, `biome.json`, `vitest.config.ts`, and `wrangler.toml` into alignment with ADR-0002 so that subsequent tickets can use Drizzle, run tests with Vitest, lint with Biome, and deploy to Cloudflare Pages.

## Acceptance Criteria

- [x] `package.json` name is updated to `guitar-hub`
- [x] Biome is installed (`@biomejs/biome`) and `biome.json` is present with formatting and linting rules enabled; the existing `eslint.config.mjs` is removed
- [x] `package.json` scripts include: `dev`, `build`, `start`, `lint` (biome check), `format` (biome format), `test` (vitest run), `test:watch` (vitest)
- [x] Vitest is installed (`vitest`, `@vitejs/plugin-react`) and `vitest.config.ts` is present; `pnpm test` exits 0 with no test files (no failures)
- [x] Runtime dependencies added: `drizzle-orm`, `@cloudflare/d1` (or `@cloudflare/workers-types` for types), `nanoid`
- [x] Dev dependencies added: `drizzle-kit`, `wrangler`, `@cloudflare/next-on-pages`
- [x] `wrangler.toml` is present with the project name, compatibility date, and a placeholder `[[d1_databases]]` binding named `DB`
- [x] `pnpm lint` runs Biome check and exits 0 on the current codebase
- [x] No lint errors
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Database schema creation (ticket 002)
- Cloudflare D1 database provisioning or actual deployment
- Converting any existing source files to pass Biome rules (beyond what `biome format --write` handles automatically)

## Notes

- The ADR calls for Biome, but the scaffold used ESLint. Remove `eslint` and `eslint-config-next` from devDependencies after Biome is in place.
- Biome's default rules align well with the TypeScript conventions in `conventions/typescript.md`. Enable `recommended` preset as the baseline.
- `@cloudflare/next-on-pages` is the adapter that makes Next.js run on Cloudflare Pages. It wraps the Next.js build output for the Workers runtime.
- The `wrangler.toml` binding name `DB` must match what Drizzle will reference in the database client (ticket 002).
- Vitest needs `@vitejs/plugin-react` to handle JSX in test files.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
