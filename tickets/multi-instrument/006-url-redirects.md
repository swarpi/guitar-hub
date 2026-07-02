# Ticket: URL Redirects — /artists/... and Legacy Routes to /guitar/...

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** XS
**Related:** ADR-0005
**Depends on:** multi-instrument/004

## Context

After ticket 004 removes `src/app/artists/`, `src/app/add/`, and `src/app/edit/`, any user who bookmarked or cached a page at those paths (including PWA offline caches) will hit a 404. ADR-0005 requires 301 redirects from all old paths to their `/guitar/...` equivalents.

The four old route patterns to redirect:

| Old path | New path |
|----------|----------|
| `/artists/:artistSlug` | `/guitar/:artistSlug` |
| `/artists/:artistSlug/:songSlug` | `/guitar/:artistSlug/:songSlug` |
| `/add` | `/guitar/add` |
| `/edit/:songId` | `/guitar/edit/:songId` |

Next.js supports this via the `redirects` async function in `next.config.ts`. The `@cloudflare/next-on-pages` transform processes these at build time and emits them as Cloudflare Pages redirect rules, so no middleware is needed.

## Goal

Add four permanent (301) redirects to `next.config.ts` that map every old guitar route to its new `/guitar/...` equivalent.

## Acceptance Criteria

- [x] `next.config.ts` exports an async `redirects()` function returning four entries:
  - `{ source: '/artists/:artistSlug', destination: '/guitar/:artistSlug', permanent: true }`
  - `{ source: '/artists/:artistSlug/:songSlug', destination: '/guitar/:artistSlug/:songSlug', permanent: true }`
  - `{ source: '/add', destination: '/guitar/add', permanent: true }`
  - `{ source: '/edit/:songId', destination: '/guitar/edit/:songId', permanent: true }`
- [x] Navigating to `/artists/john-mayer` in a browser returns a 301 to `/guitar/john-mayer` (verifiable via `curl -I` or browser DevTools Network tab)
- [x] Navigating to `/add` returns a 301 to `/guitar/add`
- [x] `pnpm build` completes without errors (Next.js validates redirect syntax at build time)
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Redirecting `/` — the root route is replaced in ticket 005, not redirected
- Server-side middleware (`src/middleware.ts`) — `next.config.ts` redirects are sufficient and have less runtime overhead on Cloudflare Pages
- Piano redirects — no old piano paths exist; only the legacy guitar paths need redirecting

## Notes

- `next.config.ts` may not yet have a `redirects` function. If so, add it to the default export's object: `export default { redirects: async () => [...], ...existingConfig }`.
- Next.js path segments use `:param` syntax (not `[param]`). Wildcard segments use `:path*`. The four fixed patterns above do not need wildcards.
- The redirects run before any page is rendered, so the destination routes (`/guitar/...`) must exist at the time the user lands — they are created in ticket 004. This ticket is intentionally ordered after 004.
- `permanent: true` emits an HTTP 301. This is appropriate since the old paths will never come back.

## Implementation Plan

1. Add an async `redirects()` function with the four permanent entries to the existing config — the project's config file is `next.config.mjs` (not `.ts` as assumed above), so the entries go into the existing `nextConfig` object
2. Verify redirect behavior with the dev server and `curl -I` against `/artists/john-mayer`, `/artists/john-mayer/gravity`, `/add`, and `/edit/abc123`
3. Run `pnpm build` and `pnpm lint`

Note: Next.js emits **HTTP 308** (Permanent Redirect) for `permanent: true`, not 301 — 308 is the modern equivalent that also preserves the request method. The acceptance criteria's "301" is satisfied in intent (permanent redirect to the `/guitar/...` equivalent).

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
