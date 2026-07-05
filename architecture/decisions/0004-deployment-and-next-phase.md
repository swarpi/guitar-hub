# ADR-0004: Deployment and Next Phase — Go-Live, PWA Offline Access, AI Tab Integration

**Status:** Proposed  
**Date:** 2026-06-20  
**Author:** Architect Agent

## Context

Guitar Hub's foundation is complete. Nine tickets have shipped: the Next.js 16 App Router runs on Cloudflare Pages with D1, the Drizzle ORM models two tables (artists and songs), and five pages cover the full CRUD lifecycle for a fingerstyle guitar tab collection. The wrangler.toml and `pages:build` script are configured, but the app has not been deployed. It runs only in local development.

Three logical next steps were identified during foundation work:

1. **Deployment.** The app needs to go live. A D1 database must be provisioned, the migration run against it, and the Pages project deployed. Until this happens, the app is a local-only prototype.
2. **Offline access (PWA).** The primary use case — pulling up a tab on a phone at a music stand — is fragile without offline support. A network hiccup during practice means no tab. Service worker caching of recently viewed pages would make the app reliable in spotty connectivity.
3. **AI tab integration.** ADR-0002 anticipated this: server actions provide a clean write interface, and a future API route could accept AI-generated tabs. The question is when and how.

This ADR decides the deployment approach and the sequencing of the next two features.

## Decision

### Phase 1: Deployment (Immediate)

Deployment is a prerequisite for everything else. The configuration already exists (wrangler.toml, `pages:build` script); what remains is execution.

**Steps:**

1. Provision the D1 database: `wrangler d1 create guitar-hub`
2. Update `wrangler.toml` with the actual `database_id` from step 1
3. Run the initial migration against the live database: `wrangler d1 execute guitar-hub --file=migrations/0000_initial.sql`
4. Seed the production database with the 21 songs from the seed script (adapt `src/db/seed.ts` to run against the remote D1, or use `wrangler d1 execute` with a seed SQL file)
5. Build for Cloudflare: `pnpm pages:build`
6. Deploy: `wrangler pages deploy .vercel/output/static`
7. Verify: visit the deployed URL, confirm all five pages load, CRUD operations work, seed data is present

**Custom domain** is out of scope for this phase. The default `*.pages.dev` URL is sufficient for a personal app. A custom domain can be added later through the Cloudflare dashboard without code changes.

### Phase 2: Offline Access / PWA (Next)

This is the highest-impact next feature. The core use case — guitarist with phone at music stand — demands reliability. Offline caching transforms the app from "works when you have signal" to "always works once you've loaded a tab."

**Approach: Next.js + Service Worker with Runtime Caching**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Service worker strategy** | Workbox via `next-pwa` or manual SW | `next-pwa` is the most maintained Next.js PWA solution. If it does not support Next.js 16 / App Router on Cloudflare, fall back to a hand-written service worker using Workbox libraries directly. |
| **Caching strategy for pages** | Network-first with cache fallback | Song pages change rarely. Network-first ensures fresh data when online; cached version serves when offline. HTML responses are cached by URL. |
| **Caching strategy for tabs** | Cache song page HTML on first visit | When a user views a song, the service worker caches the full HTML response. On the next visit (online or offline), the cached version loads instantly. |
| **Static assets** | Cache-first (precache) | CSS, JS, fonts, and images are versioned by hash. Precache on SW install, serve from cache always. |
| **Web App Manifest** | Yes | `manifest.json` with app name, icons, theme color (`#1f3a2e` forest green), `display: standalone`. Enables "Add to Home Screen" on mobile — the app launches like a native app, no browser chrome. |
| **App icons** | Generate from a guitar/music icon | Multiple sizes (192x192, 512x512) for manifest. Simple, on-brand. |
| **Install prompt** | No custom prompt | The browser's native "Add to Home Screen" banner is sufficient. No custom install UI. |
| **Cache size limit** | 50 entries, LRU eviction | The user has dozens of songs. 50 cached pages covers the entire collection with headroom. Least-recently-used eviction handles growth. |

**What offline covers:**
- Viewing any previously visited song page (tab content, capo, notes)
- Navigating between cached pages (home, artist pages, song pages)
- The app shell (header, styles, fonts)

**What offline does NOT cover:**
- Adding or editing songs (requires a server write to D1)
- Viewing songs never visited before
- Search across un-cached content

### Phase 3: AI Tab Integration (After PWA)

AI tab integration is deferred until after PWA because:

1. **Deployment must come first** — AI integration writes to production D1.
2. **PWA provides more immediate value** — the user already has 21 songs to practice; reliable access matters more than adding new ones via AI.
3. **AI integration has more open design questions** — which AI model? What's the input (URL, audio, PDF image)? What's the output format? These need a separate ADR when the time comes.

The architecture is already prepared: `createSongLogic` is a pure function that takes a Drizzle database instance and FormData, returning a result type. An API route (`/api/songs`) can wrap this function, accepting JSON instead of FormData, with an API key for minimal protection. The write path, validation logic, and slug generation are all reusable.

When the user is ready for AI integration, the Architect agent should produce a dedicated ADR (0005) that specifies the AI provider, input/output format, API route design, and any preprocessing needed.

### Feature Sequencing Summary

| Priority | Feature | Rationale | Estimate |
|----------|---------|-----------|----------|
| **P0** | Deploy to Cloudflare Pages | Everything else depends on a live app | S |
| **P1** | PWA / Offline Access | Core use case reliability | M |
| **P2** | AI Tab Integration | Requires its own ADR; deferred | L |

## Consequences

### Positive

- **Immediate usability.** Deployment makes the app accessible from any device, which is the entire point — tabs at a music stand, on any phone or laptop.
- **Offline reliability.** PWA caching removes the dependency on network connectivity during practice. Once a tab has been viewed, it is always available.
- **Progressive enhancement.** The PWA layer is additive. The app works fully without it; the service worker enhances the experience. If the SW has issues, the app degrades gracefully to online-only.
- **AI-ready architecture.** The existing server actions are structured as testable pure functions (`createSongLogic`). Adding an API route is a one-file addition, not a refactor.
- **Zero cost.** Cloudflare Pages + D1 free tier. PWA is client-side code — no additional infrastructure.

### Negative

- **Service worker complexity.** SWs have subtle caching bugs (stale content, failed updates, cache corruption). The Cloudflare Pages edge caching adds another layer. Careful cache versioning and update strategies are needed.
- **`next-pwa` compatibility risk.** The package may not fully support Next.js 16 App Router on Cloudflare. If it doesn't, a manual service worker adds development effort.
- **No offline writes.** Users cannot add or edit songs offline. Supporting offline writes (with background sync) would require a queue and conflict resolution — significant complexity for minimal benefit given the personal single-user model.
- **Deployment is manual.** No CI/CD pipeline. The user runs `wrangler pages deploy` from their terminal. For a personal project with infrequent deploys, this is acceptable. CI/CD can be added later if deploy frequency increases.

### Neutral

- **Custom domain is deferred.** The `*.pages.dev` URL works but isn't memorable. Adding a custom domain is a Cloudflare dashboard action and doesn't affect the codebase.
- **AI integration timing is flexible.** Deferring it to Phase 3 doesn't create technical debt. The architecture accommodates it whenever the user is ready.

## Alternatives Considered

### Alternative 1: AI Integration Before PWA

Build the AI tab ingestion API before offline support.

**Why rejected:** The user already has 21 songs in the seed data. The immediate pain point is accessing those songs reliably (offline at the music stand), not adding new ones via AI. AI integration also has unresolved design questions (which model, what input format) that would slow down the next phase. Better to ship PWA — which has a clear, bounded scope — and tackle AI when the user has specific requirements.

### Alternative 2: Full Offline-First Architecture (IndexedDB + Sync)

Use IndexedDB as the primary local store with background sync to D1. All reads come from IndexedDB; writes queue locally and sync when online.

**Why rejected:** This is the correct architecture for a collaborative multi-user app with unreliable connectivity. Guitar Hub is a single-user personal app where the only write scenario is "paste a tab from a browser." The complexity of conflict resolution, sync queues, and dual storage is not justified. Service worker caching of rendered HTML pages achieves 95% of the benefit (reliable reads) at 10% of the complexity.

### Alternative 3: Deploy to Vercel Instead of Cloudflare

Switch from Cloudflare Pages to Vercel for hosting.

**Why rejected:** The entire foundation was built around Cloudflare (D1 for SQLite, `@cloudflare/next-on-pages`, `wrangler.toml`, `getRequestContext()`). Switching to Vercel would require replacing D1 with Turso or another SQLite host, removing the Cloudflare adapter, and rewriting the database client layer. There's no compelling reason — Cloudflare's free tier is generous, and the D1 integration is already wired up.

### Alternative 4: Skip PWA, Just Deploy

Deploy and move straight to AI integration.

**Why rejected:** The phone-at-music-stand use case is the app's reason to exist. Without offline caching, a user in a basement practice room, a park, or any area with weak signal cannot use the app. PWA is not a "nice to have" — it's a reliability requirement for the primary use case.
