# Ticket: ABC Notation Rendering — Install abcjs and Piano Song Detail Renderer

**Feature:** multi-instrument
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0005
**Depends on:** multi-instrument/007

## Context

After ticket 007, the piano song detail page renders ABC notation text inside a `<pre>` block — human-readable but not staff notation. ADR-0005 specifies that piano content is rendered as staff notation using `abcjs`, a browser library that parses ABC text and produces SVG output.

`abcjs` is approximately 180 KB gzipped. ADR-0005 explicitly calls out that it must be code-split so it does not load on guitar pages. Next.js `dynamic()` with `{ ssr: false }` achieves this: the abcjs bundle only downloads when a piano song detail page renders in the browser.

The storage model is unchanged: ABC text lives in the `content` column. Only the rendering layer changes.

## Goal

Piano song detail pages render ABC notation as SVG staff notation via abcjs; the abcjs bundle does not appear in the guitar page bundle.

## Acceptance Criteria

- [x] `abcjs` is added to `package.json` dependencies (`pnpm add abcjs`)
- [x] `@types/abcjs` is added to `devDependencies` if type definitions are not bundled with abcjs (check the abcjs package — as of v6 types are included) — confirmed bundled at `node_modules/abcjs/types/index.d.ts`; no `@types/abcjs` needed
- [x] `src/components/AbcNotationRenderer.tsx` is a client component (`"use client"`) that:
  - Accepts a `content: string` prop (the raw ABC notation text)
  - Uses `useRef` to hold a container `div`
  - On mount (and when `content` changes), calls `ABCJS.renderAbc(containerRef.current, content, { responsive: 'resize' })` to render SVG into the container
  - Renders a `<div ref={containerRef} />` wrapper; applies existing design-system classes for background (`bg-page` or similar) so the SVG sits on the warm paper background
- [x] `src/app/piano/[artistSlug]/[songSlug]/page.tsx` replaces the `<pre>` block with a dynamically imported `AbcNotationRenderer`:
  - `const AbcNotationRenderer = dynamic(() => import('@/components/AbcNotationRenderer'), { ssr: false, loading: () => <p>Loading notation...</p> })`
  - Passes `content={song.content}` to the component
  - Note: the dynamic import lives in `src/components/AbcNotation.tsx` (a client wrapper) rather than directly in `page.tsx`, because the piano detail page is a server component and Next.js 16 rejects `ssr: false` inside server components. The ticket's own Implementation Plan (step 3) anticipated this exact constraint. Same code-splitting outcome; accepted as satisfying this criterion.
- [x] Guitar pages (`src/app/guitar/[artistSlug]/[songSlug]/page.tsx`) are unchanged and do not import `AbcNotationRenderer` — confirm by checking the built bundle does not include abcjs on a guitar route
- [x] The rendered staff notation is visible and correct for a sample ABC string (e.g., `X:1\nT:Test\nM:4/4\nK:C\nCDEF|GABc|`) — manually verify in the browser
- [x] `pnpm build` passes with no TypeScript errors
- [x] `pnpm lint` passes
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- MIDI playback via abcjs — ADR-0005 explicitly defers interactive playback as a future enhancement
- A visual ABC editor or syntax highlighting in the textarea — the user pastes text; the detail page renders it
- Transposition, key changes, or export tools
- Rendering ABC in the edit form preview — the edit form (`SongForm`) continues to show raw text in the preview area; only the read-only detail page renders staff notation

## Notes

- `abcjs` API: `ABCJS.renderAbc(outputElement, abcString, params)`. The `outputElement` can be a DOM element reference or a string ID. Using a `ref` is idiomatic in React.
- `{ responsive: 'resize' }` makes the SVG scale to fit its container width, which is important for mobile.
- The `renderAbc` call must happen in a `useEffect` (not during render) because it directly mutates the DOM. Pattern:
  ```ts
  useEffect(() => {
    if (containerRef.current && content) {
      ABCJS.renderAbc(containerRef.current, content, { responsive: 'resize' });
    }
  }, [content]);
  ```
- abcjs renders into the container by replacing its `innerHTML`. If `content` changes (unlikely on a detail page, but possible), the effect re-runs and re-renders cleanly.
- The `loading` fallback in `dynamic()` shows while the abcjs chunk downloads. Keep it brief — a single line of text or a subtle skeleton is sufficient.
- To confirm bundle isolation, run `pnpm pages:build` and inspect `.vercel/output/static/_worker.js/chunks/` — the abcjs chunk should not appear in the guitar route's chunk list. Alternatively, open the guitar song detail in the browser and verify no abcjs request appears in the Network tab.
- abcjs renders SVG with its own internal styles. If the SVG background conflicts with the warm paper aesthetic, wrap the container in a `div` with `className="bg-page rounded-md p-4"` and set `ABCJS.renderAbc(..., { ..., staffwidth: null })` to let responsive sizing take over.

## Implementation Plan

1. `pnpm add abcjs` (v6 bundles its own TypeScript types — no `@types/abcjs` needed)
2. Create `src/components/AbcNotationRenderer.tsx` — `"use client"`, default export, `useRef` container div, `useEffect` calling `ABCJS.renderAbc(containerRef.current, content, { responsive: "resize" })` on mount and when `content` changes; wrapper div styled with the paper-background design classes used by the guitar `<pre>` block
3. Create `src/components/AbcNotation.tsx` — thin `"use client"` wrapper holding `dynamic(() => import("./AbcNotationRenderer"), { ssr: false, loading: ... })`. Next.js 15+ rejects `ssr: false` in server components, and the piano detail page is a server component, so the dynamic import must live in a client file
4. Replace the `<pre>` block in `src/app/piano/[artistSlug]/[songSlug]/page.tsx` with `<AbcNotation content={song.content} />`; guitar pages untouched
5. Component test for `AbcNotationRenderer` with abcjs mocked — assert `renderAbc` is called with the container, the content, and `{ responsive: "resize" }`, and re-called when `content` changes
6. Verify bundle isolation: build and confirm the abcjs chunk is a separate async client chunk not referenced by guitar routes
7. Manually verify staff notation renders in the browser with a sample ABC string
8. `pnpm test`, `pnpm lint`, `pnpm build`; then `/ticket-verifier`

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
