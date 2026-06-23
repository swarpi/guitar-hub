# Ticket: Offline Fallback Page

**Feature:** pwa
**Status:** Todo
**Priority:** P1
**Estimate:** XS
**Related:** ADR-0004

## Context

Ticket 002 adds a service worker that caches pages the user has visited. When the user is offline and navigates to a URL that was never cached — a song page they haven't viewed before, or any URL that fell outside the 50-entry LRU — the service worker has nothing to serve. Without a registered fallback, the browser displays its own generic "No internet connection" error page, breaking the app's visual identity and providing no guidance.

A precached offline fallback — served by the service worker whenever a navigation request fails with no cache hit — gives the user a branded explanation and two actionable options.

## Goal

When the user navigates to an un-cached page while offline, they see a Guitar Hub-branded fallback page instead of the browser's default error screen.

## Acceptance Criteria

- [ ] `public/offline.html` exists as a standalone, self-contained HTML file (no external stylesheet, font, or script dependencies)
- [ ] The page's visual design matches the app: ivory background (`#faf9f3`), a forest green (`#1f3a2e`) header bar with the text "Guitar Hub", Spectral-style serif body font declared inline via `font-family: Georgia, serif` (Google Fonts cannot be loaded offline), centered single-column layout
- [ ] The page body displays a clear message: the user is offline and the requested page has not been cached yet
- [ ] A "Go Back" button calls `window.history.back()` — returns the user to the previous (likely cached) page
- [ ] A "Try Again" button calls `window.location.reload()` — re-attempts the navigation when connectivity returns
- [ ] The service worker from ticket 002 is updated to precache `/offline.html` on install
- [ ] The service worker's catch handler is extended with `setCatchHandler` (or equivalent) to serve `/offline.html` when a navigation request fails and no cache entry exists
- [ ] Navigating offline to a URL not in the page cache shows `offline.html` — verified in Chrome DevTools with Network set to "Offline"
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Listing available cached pages on the fallback (requires reading cache keys from inside the SW — adds complexity for minimal value)
- Automatic retry when connectivity returns (the "Try Again" button is sufficient)
- Custom offline fallback for non-navigation failures (images, font files) — these fail silently; only document navigations get the fallback page
- Any JavaScript framework or bundled JS in `offline.html` — keep it pure HTML + inline `<style>` + minimal inline `<script>`

## Notes

- **Why `public/offline.html` and not a Next.js route**: a Next.js `app/offline/page.tsx` requires the app shell JS to load, which may itself not be available if the static asset cache is cold. A static HTML file precached by the SW at install time is unconditionally available — no dependency on the Next.js runtime.
- **Self-contained CSS**: inline all styles in a `<style>` block. Do not link to `globals.css` or Tailwind — those files are served from the Next.js static output and may not be in cache if this is the user's first visit with the app offline. Use plain CSS with hex colors from the design system: `#faf9f3` (canvas), `#1f3a2e` (header), `#33271c` (body text ink).
- **Precaching in the SW**: in the SW's `install` event (or Workbox's `precacheAndRoute`), add `/offline.html` to the precache list so it is fetched and stored the first time the SW is installed — before the user has visited any page.
- **Catch handler pattern** (for the hand-written Workbox SW from ticket 002):
  ```js
  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return caches.match('/offline.html');
    }
    return Response.error();
  });
  ```
  If `next-pwa` is used, consult its docs for the equivalent `fallbacks` configuration.
- **Dependency on ticket 002**: this ticket modifies the service worker from ticket 002. It can be implemented in the same session if 002 is in progress, or as a follow-up commit once 002 is merged.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
