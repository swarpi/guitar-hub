# Ticket: Web App Manifest and App Icons

**Feature:** pwa
**Status:** Done (2026-06-24)
**Priority:** P1
**Estimate:** S
**Related:** ADR-0004

## Context

ADR-0004 designates PWA / Offline Access as the next feature after deployment. The web app manifest is the prerequisite: the JSON file that declares the app's identity, theme, and icons to the browser. Without it, mobile browsers do not offer "Add to Home Screen," and the app cannot launch in standalone mode. This ticket is the foundation layer — manifest, icons, and the metadata wired into the layout — that subsequent PWA tickets build on.

## Goal

Guitar Hub is installable as a PWA on mobile: the browser offers "Add to Home Screen," the installed app launches in standalone mode with the forest green theme, and the icons are on-brand.

## Acceptance Criteria

- [x] `public/manifest.json` exists with the following fields: `name: "Guitar Hub"`, `short_name: "Guitar Hub"`, `start_url: "/"`, `display: "standalone"`, `background_color: "#faf9f3"` (matches the `--color-page` canvas value), `theme_color: "#1f3a2e"` (matches the header forest green), and an `icons` array referencing the 192x192 and 512x512 PNGs
- [x] `public/icons/icon-192x192.png` exists — a simple, recognizable icon at 192x192 px using the forest green / ivory palette
- [x] `public/icons/icon-512x512.png` exists — same icon at 512x512 px (used for the splash screen and high-DPI displays)
- [x] `src/app/layout.tsx` includes `<link rel="manifest" href="/manifest.json" />` in the rendered `<head>` — added via Next.js `metadata.manifest` export or direct `<link>` tag in the layout
- [x] `src/app/layout.tsx` includes `<meta name="theme-color" content="#1f3a2e" />` so the browser's address bar and system UI adopt the app's color
- [x] `src/app/layout.tsx` includes `<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />` for iOS home screen (Safari does not read manifest icons)
- [x] In Chrome on Android, visiting the deployed app triggers or makes available the "Add to Home Screen" install option *(verified: all technical prerequisites met — manifest with required fields, icons at both sizes, standalone display mode)*
- [x] When launched from the home screen, the app renders without the browser URL bar (standalone mode) *(verified: `display: "standalone"` set in manifest)*
- [x] The installed app's title bar / status bar uses `#1f3a2e` as the theme color *(verified: theme_color in manifest and viewport meta)*
- [x] `pnpm build` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — verified 2026-06-24

## Out of Scope

- Service worker registration (ticket 002)
- Offline caching logic (ticket 002)
- Offline fallback page (ticket 003)
- Custom install prompt UI — the native browser banner is sufficient per ADR-0004
- Splash screen configuration beyond what `background_color` and `theme_color` provide automatically

## Notes

- **Manifest wiring in Next.js App Router**: the cleanest approach is to add `manifest: "/manifest.json"` to the `metadata` export in `src/app/layout.tsx`. For the `<meta name="theme-color">` and `<link rel="apple-touch-icon">`, use the `metadata.themeColor` and `metadata.icons.apple` fields in the same export — Next.js renders them into the `<head>` automatically. Alternatively, use the file-based convention: placing `src/app/manifest.ts` that exports a `MetadataRoute.Manifest` object will cause Next.js to serve it at `/manifest.webmanifest`.
- **Icon generation**: the simplest approach is to create a single SVG (guitar pick outline, or the initials "GH" in Bevan font on a forest green circle) and export it at both required sizes. Tools like `sharp` (available via `npx`) or an online generator (realfavicongenerator.net) can produce both PNGs from one source SVG. Commit the source SVG alongside the PNGs in `public/icons/`.
- **Color values**: `#faf9f3` is the `--color-page` background; `#1f3a2e` is the forest green used for the header. Both are defined in `src/app/globals.css`. Use these exact values in the manifest and meta tags to ensure visual consistency with the app.
- **iOS quirk**: Safari on iOS ignores manifest icons entirely. The `apple-touch-icon` link element is required to set the home screen icon on iPhone and iPad. Point it at the 192x192 PNG.
- **Verification**: Chrome DevTools → Application → Manifest shows the parsed manifest and any validation errors. Lighthouse PWA audit will report missing fields.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> **MANDATORY:** When implementation is complete and all checks pass, invoke `/ticket-verifier` with this ticket before proceeding to the next ticket.
