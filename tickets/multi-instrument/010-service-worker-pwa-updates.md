# Ticket: Service Worker and PWA Updates — Cache Bust and Manifest Sync

**Feature:** multi-instrument
**Status:** Todo
**Priority:** P2
**Estimate:** XS
**Related:** ADR-0005
**Depends on:** multi-instrument/007, multi-instrument/009

## Context

The current service worker (`public/sw.js`) uses `CACHE_VERSION = "v1"`. After the multi-instrument work, three things have changed that make a cache version bump necessary:

1. **Old route caches are stale.** Any PWA install that previously cached `/`, `/artists/...`, `/add`, or `/edit/...` pages holds HTML pointing at routes that no longer exist (replaced by `/guitar/...` and the new landing page). The NetworkFirst strategy will eventually refresh these, but bumping the cache version forces immediate eviction of all v1 caches on the next service worker activation cycle.

2. **The app name changed.** `manifest.json` now says "Music Hub" (ticket 009). The service worker does not reference the app name directly, but the offline fallback page (`/offline.html`) now also says "Music Hub". A cache version bump ensures the updated `offline.html` is precached fresh.

3. **abcjs is a new static asset.** Piano song detail pages dynamically import the abcjs JS chunk. The existing CacheFirst strategy for `request.destination === "script"` handles it automatically — no routing change is needed — but a cache version bump starts the abcjs chunk in a clean cache rather than potentially conflicting with a stale v1 assets cache.

This ticket is intentionally small. The service worker's routing logic (NetworkFirst for navigation, CacheFirst for assets) is correct for the new URL structure without modification.

## Goal

Bump `CACHE_VERSION` in `public/sw.js` from `"v1"` to `"v2"` so all stale caches from the old routing structure are evicted on the next service worker activation.

## Acceptance Criteria

- [ ] `public/sw.js`: `CACHE_VERSION` changed from `"v1"` to `"v2"`
- [ ] The three derived cache names update automatically: `pages-v2`, `assets-v2`, `offline-v2`
- [ ] The `VALID_CACHES` array includes the three new names (`pages-v2`, `assets-v2`, `offline-v2`); old v1 caches are deleted on activation because they are not in `VALID_CACHES`
- [ ] Manually verify in Chrome DevTools (Application → Cache Storage) that after a hard reload the v1 caches are absent and v2 caches are present (document this as a manual check — no automated test needed)
- [ ] `pnpm lint` passes on `public/sw.js`
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Changing the service worker routing strategies — NetworkFirst for navigation and CacheFirst for assets are correct for the new URL structure; no logic changes needed
- Precaching specific `/guitar/...` or `/piano/...` routes explicitly — the NetworkFirst navigation strategy caches them on first visit automatically
- Adding a `scope` or `fetch` override in `manifest.json` — the current `start_url: "/"` correctly points to the new landing page
- Implementing background sync or push notifications
- The pwa/003-offline-fallback-page ticket is a separate concern (improving the offline.html UI); this ticket only bumps the version

## Notes

- The `CACHE_VERSION` string is the only line that needs to change. The three derived cache names and the `VALID_CACHES` array are all computed from it, so they update automatically — no secondary edits needed.
- The existing activate handler already deletes any cache key not in `VALID_CACHES`. This is what purges the old v1 caches. The logic is correct; the version bump is the only required change.
- After deploying the updated `sw.js`, existing PWA installs receive the new service worker on the next page load. The browser activates it (evicting v1 caches) either immediately (if no other tabs have the old SW) or on the next browser restart. This is standard service worker lifecycle behavior.
- abcjs is loaded as a JS module via Next.js dynamic import. Its chunks are served from `/_next/static/chunks/`. The CacheFirst strategy matches `request.destination === "script"`, so abcjs chunks cache on first load — no explicit precache entry needed.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
