# Ticket: Service Worker and Offline Caching

**Feature:** pwa
**Status:** Todo
**Priority:** P1
**Estimate:** M
**Related:** ADR-0004

## Context

ADR-0004 specifies network-first caching for page HTML and cache-first for static assets. The motivating use case is a guitarist at a music stand with spotty or no connectivity: once they have viewed a tab online, that tab must load offline. The service worker is the mechanism — it intercepts network requests, stores responses in the Cache API, and serves them when the network is unavailable.

ADR-0004 also rules out `next-pwa` as a hard dependency. If `next-pwa` supports Next.js 16 App Router on Cloudflare Pages it may be used, but if there are compatibility issues the fallback is a hand-written service worker using Workbox libraries. This ticket must verify compatibility and choose accordingly.

## Goal

After a user visits a song page online, that page — and the app shell — are available offline. Navigating to a cached song, artist, or home page works with no network connection.

## Acceptance Criteria

- [ ] A service worker is registered by the app on first page load — verified in Chrome DevTools → Application → Service Workers (status: activated and running)
- [ ] Static assets (JS bundles, CSS, fonts) are precached on service worker install — subsequent navigations load the app shell with no network requests for these assets
- [ ] Page HTML responses (navigation requests) use a network-first strategy: online visits fetch from the network and update the cache; offline visits serve the cached response
- [ ] Song detail pages (`/artists/[artistSlug]/[songSlug]`) are cached on first visit and accessible offline — tab content, capo badge, and notes all render correctly from cache
- [ ] The home page (`/`) is cached on first visit and accessible offline — the song index renders from cache
- [ ] Artist pages (`/artists/[artistSlug]`) are cached on first visit and accessible offline
- [ ] The page cache is capped at 50 entries with LRU eviction — the 51st cached page evicts the least-recently-used entry (verified by inspecting Cache Storage in DevTools after cycling through 51 pages)
- [ ] Navigating between cached pages offline works — clicking a song link on the cached home page loads the cached song page without network access
- [ ] When the user returns online, the next navigation fetches fresh content from the network, updating the cache
- [ ] A service worker update is installed on the next page load after a new version is deployed — old caches from the previous version are deleted in the `activate` event
- [ ] A small `OfflineBanner` component (`src/components/OfflineBanner.tsx`) renders a muted banner at the top of each page when `navigator.onLine` is false and the `offline` window event fires — it disappears when the `online` event fires
- [ ] The `OfflineBanner` uses the app's design language: Spectral or JetBrains Mono at small size, forest green background (`#1f3a2e`), ivory text (`#faf9f3`), no external dependencies
- [ ] On the `/add` and `/edit/*` pages, the `SongForm` component (`src/components/SongForm.tsx`) checks `navigator.onLine` and shows a static message ("You need to be online to add or edit songs") instead of the form when offline
- [ ] Vitest unit test: `OfflineBanner` renders when `navigator.onLine` is `false` and does not render when `navigator.onLine` is `true`
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Offline writes — adding or editing songs while offline requires background sync and is not justified for this single-user app (per ADR-0004)
- Push notifications
- Background sync
- Predictive prefetching of un-visited pages
- Service worker interception of `/api` routes (not yet built)
- Offline fallback page for un-cached URLs — ticket 003

## Notes

- **`next-pwa` compatibility check**: run `pnpm add -D next-pwa` and try wiring it into `next.config.mjs`. If `pnpm pages:build` passes and the SW is generated correctly for the Cloudflare Workers runtime, use it. If it fails (likely due to the App Router or the Cloudflare edge runtime), remove it and use a hand-written service worker instead.
- **Hand-written SW location**: place the service worker at `public/sw.js`. Next.js serves `public/` as static files at the root, so `public/sw.js` is accessible at `/sw.js` — the correct scope for a root-level service worker.
- **Workbox in a hand-written SW**: import Workbox from a CDN in the SW file using `importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')`. Then use `workbox.routing.registerRoute`, `workbox.strategies.NetworkFirst`, `workbox.strategies.CacheFirst`, and `workbox.expiration.ExpirationPlugin`. Avoid a Node.js build step inside the SW — keep it a plain script.
- **Cache naming**: use versioned names — `pages-v1` and `assets-v1`. In the SW's `activate` event, delete any caches whose names are not in the current version list. This ensures stale caches from previous deploys are cleaned up automatically.
- **SW registration**: register in a `"use client"` component (`src/components/ServiceWorkerRegistration.tsx`) that calls `navigator.serviceWorker.register('/sw.js')` inside a `useEffect`. Mount this component once in `src/app/layout.tsx`. Guard with `if ('serviceWorker' in navigator)`.
- **OfflineBanner**: listen to `window` events `online` and `offline` in a `useEffect`. Initialize state from `navigator.onLine`. Render a `<div>` with `role="status"` when offline, `null` when online. Keep the component in `src/components/OfflineBanner.tsx` and mount it inside the layout's page wrapper `<div>`, above `{children}`.
- **SongForm offline guard**: add a `useEffect` in `SongForm.tsx` that tracks `navigator.onLine`. If offline, replace the form with a `<p>` message. The guard only needs to appear in `SongForm` — the server component pages (`/add`, `/edit/*`) do not need changes.
- **Testing the SW offline**: Chrome DevTools → Network → tick "Offline" checkbox. Reload a previously visited page — it should load from the service worker cache. Check DevTools → Application → Cache Storage to inspect cached entries.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
