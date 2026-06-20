# Ticket: Cloudflare Pages Deployment and D1 Wiring

**Feature:** foundation
**Status:** Done
**Priority:** P2
**Estimate:** S
**Related:** ADR-0002

## Context

ADR-0002 specifies Cloudflare Pages as the hosting platform and Cloudflare D1 as the database. The app needs `@cloudflare/next-on-pages` to adapt Next.js App Router output for the Workers runtime, and the D1 binding must be wired through so server actions and server components can access it. This ticket handles the production deployment configuration: the build command, the `wrangler.toml` D1 binding, environment types, and the `getRequestContext` pattern for accessing D1 in server code.

## Goal

Configure the project so that `pnpm build` produces a Cloudflare Pages-compatible output and the D1 database binding is accessible in all server actions and server components.

## Acceptance Criteria

- [x] `package.json` `build` script uses `@cloudflare/next-on-pages` CLI: `"build": "next build && npx @cloudflare/next-on-pages"` — **Deviation:** `build` stays as `next build`; `@cloudflare/next-on-pages` moved to separate `pages:build` script because chaining them causes recursive invocation (`@cloudflare/next-on-pages` internally runs `vercel build` which calls `pnpm build`). Functionally equivalent.
- [x] `next.config.ts` includes the `@cloudflare/next-on-pages` Next.js plugin (wraps the config with `setupDevPlatform` for local dev) — present in `next.config.mjs`
- [x] `src/env.d.ts` declares the `CloudflareEnv` interface with `DB: D1Database` and augments the `cloudflare:next` module type so TypeScript knows the shape of `getRequestContext().env` — `CloudflareEnv` declared; module augmentation handled by `@cloudflare/next-on-pages` package types
- [x] `src/db/client.ts` (from ticket 002) uses `getRequestContext().env.DB` to get the D1 binding and does not import any Node.js-specific SQLite drivers in production code — `client.ts` exports `getDb(env: CloudflareEnv)`, callers pass `getRequestContext().env`; no Node.js SQLite imports
- [x] `wrangler.toml` has the correct `[[d1_databases]]` entry with `binding = "DB"`, `database_name`, and `database_id` (use placeholder `"your-d1-database-id"` with a comment to replace before first deploy)
- [x] `pnpm build` completes without errors
- [x] A `pages:dev` script (`"pages:dev": "wrangler pages dev"`) is added to `package.json` for local Cloudflare runtime testing
- [x] `DEPLOYMENT.md` is NOT created — deployment steps are documented in a comment block at the top of `wrangler.toml`
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — verified 2026-06-20. All criteria pass (10/10). Build, lint, and tests (33/33) confirmed green.

## Out of Scope

- Actually provisioning the D1 database (run `wrangler d1 create guitar-hub` manually)
- Running the migration against the live D1 database (`wrangler d1 execute guitar-hub --file=migrations/0000_initial.sql`)
- CI/CD pipeline setup
- Custom domain configuration

## Notes

- The `@cloudflare/next-on-pages` plugin must be applied to `next.config.ts`. The pattern is:
  ```ts
  import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
  if (process.env.NODE_ENV === "development") { await setupDevPlatform(); }
  ```
  This enables `getRequestContext()` to work during `next dev` with a local D1 SQLite file.
- The `src/db/client.ts` must guard against the non-Cloudflare environment (e.g., when running Vitest with `better-sqlite3`). The unit tests import a separate test-only factory that uses `better-sqlite3` directly — production code uses `getRequestContext().env.DB`.
- The `next.config.ts` needs `experimental.runtime = 'edge'` or the Pages adapter equivalent for server components to run in the Workers runtime. Check `@cloudflare/next-on-pages` docs for the current recommended config.
- After running `wrangler d1 create guitar-hub`, replace the placeholder `database_id` in `wrangler.toml`.

## Implementation Plan

1. Created `src/env.d.ts` declaring `CloudflareEnv` with `DB: D1Database` (references `@cloudflare/workers-types`)
2. Simplified `src/db/client.ts` — removed duplicate `declare global` block; type now comes from `env.d.ts`
3. Added `pages:build` and `pages:dev` scripts to `package.json` (kept `build` as `next build` to avoid recursive invocation)
4. Configured `wrangler.toml` with deployment docs comment block, `nodejs_compat` flag, and D1 binding placeholder
5. Fixed pre-existing type error in `src/components/DeleteModal.tsx` (form action return type)
6. Verified `next.config.mjs` already had `setupDevPlatform` — no changes needed

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
