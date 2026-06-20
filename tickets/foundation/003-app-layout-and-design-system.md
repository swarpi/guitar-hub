# Ticket: App Layout and Design System Shell

**Feature:** foundation
**Status:** Done
**Priority:** P0
**Estimate:** M
**Related:** ADR-0002, ADR-0003

## Context

The current `src/app/layout.tsx` establishes fonts and the canvas background, and `src/app/globals.css` defines all 11 color tokens, the three font stacks, the `ghFade` keyframe animation, and custom scrollbar styles. The design system tokens are correct per ADR-0003. However, the app does not yet have a proper shared layout shell: a sticky header component, the 720px centered page card, or the breadcrumb component extracted into a reusable location. The entire app currently lives in one 677-line `page.tsx` SPA. This ticket establishes the Next.js App Router layout structure that all subsequent page tickets will slot into.

## Goal

Create the shared layout shell — sticky header with wordmark and search — that wraps all pages, and extract shared UI components (`Header`, `Breadcrumb`, `CapoBadge`, `SongListItem`, `FAB`) into `src/components/` so individual page files stay small.

## Acceptance Criteria

- [x] `src/app/layout.tsx` renders a `<div>` with the canvas background and centers a `max-w-[720px]` page card with the correct shadow treatment per ADR-0003; fonts (Spectral, JetBrains Mono, Bevan) are loaded via `next/font/google`
- [x] `src/components/Header.tsx` renders the sticky forest-green header band (`bg-header`, `sticky top-0 z-20`) containing: the "Guitar Hub" two-weight wordmark (Spectral, 600/300 italic, cream/sage) that links to `/`, the `+ Add` ghost button linking to `/add`, and a search `<input>` for client-side filtering
- [x] The search input in the header is a controlled client component; the header exports a way to propagate the search query (via URL search params `?q=` on the home page, not via a global React context)
- [x] `src/components/Breadcrumb.tsx` renders the serif italic breadcrumb trail with `›` separators; clickable segments are accent-green, the current segment is ink-colored
- [x] `src/components/CapoBadge.tsx` renders the outlined pill badge in two sizes (`sm` default, `lg`) per ADR-0003 component patterns
- [x] `src/components/SongListItem.tsx` renders a full-width row (62px min-height) with song title, optional italic artist subtitle, optional capo badge, and chevron `›`; hover applies `bg-accent/[.06]` and `px-3` indent transition
- [x] `src/components/FAB.tsx` renders the 58px fixed bottom-right circular button (`bg-leather`) that links to `/add`
- [x] The `ghFade` animation class (`animate-[ghFade_.28s_ease_both]`) is applied to a page content wrapper div so every page gets the entry animation
- [x] All components pass TypeScript strict-mode type-checking (`pnpm build` or `tsc --noEmit`)
- [x] Snapshot or render tests exist for `CapoBadge` (both sizes) and `Breadcrumb` (single item, multi-item with click handler)
- [x] `pnpm test` passes
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- The home page content (song list, letter dividers) — ticket 004
- Search filtering logic — implemented in ticket 004 where the song data is available
- The delete confirmation modal — ticket 006 (edit form)
- Any server-side data fetching — all components in this ticket are structural/presentational

## Notes

- The search input needs to be a `"use client"` component because it manages input state. The header itself can be a Server Component that imports the search input as a child client component.
- For search, using URL params (`/?q=sungha`) is preferable to React state at layout level — it keeps the home page filterable via direct link and avoids prop-drilling `query` through the layout.
- The `SongListItem` `onClick` prop should accept `href: string` for Next.js `<Link>` wrapping, not a raw `onClick`. This is more semantically correct for navigation.
- `Breadcrumb` items that have an `href` are rendered as `<Link>`; items without `href` are rendered as `<span>`.
- The existing `src/app/globals.css` already has all the correct token and animation definitions — do not modify it.
- The `"use client"` directive is needed only for components with event handlers or state; prefer Server Components by default.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
