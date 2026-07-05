# abcjs and ABC Notation Rendering

## What it is
ABC notation is a compact, plain-text format for writing music — originally built for the folk/traditional-music community, where people needed something they could type in an email, not a proprietary file format. A tune is a handful of header lines (`X:` tune number, `T:` title, `M:` meter, `K:` key) followed by note letters, bar lines, and duration modifiers: `CDEF|GABc|` is a full bar of notes. `abcjs` is a JavaScript library that parses that text and renders it as actual SVG staff notation (noteheads, stems, bar lines, clefs) directly in the browser — no server-side engraving engine, no PDF conversion step. You reach for ABC + abcjs when you want music content that's as easy to store, diff, and hand-edit as guitar tab text, but that still needs to look like real sheet music for instruments like piano where fret-diagram-style tab doesn't apply.

## How I used it
**Storage (unchanged):** ADR-0005 (`architecture/decisions/0005-multi-instrument-support.md`) chose ABC over MusicXML (verbose XML, not hand-writable) and LilyPond (no browser renderer, needs a server binary incompatible with Cloudflare's edge runtime). The `songs.content` TEXT column already held guitar tab text; piano rows just store ABC text in that same column. The DB layer never has to know the difference — `src/app/piano/[artistSlug]/[songSlug]/page.tsx:53` just reads `song.content` and hands it to a component; there's no ABC-specific schema.

**Rendering component — `src/components/AbcNotationRenderer.tsx`:**
```tsx
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (containerRef.current && content) {
    renderAbc(containerRef.current, content, { responsive: "resize" });
  }
}, [content]);

return <div ...><div ref={containerRef} /></div>;
```
`renderAbc` doesn't return JSX or a virtual DOM diff — it directly replaces `containerRef.current.innerHTML` with the SVG it builds. That's why it can't run during render: React would have no idea abcjs just clobbered a node it thinks it owns, and you'd get a hydration/reconciliation mismatch. Putting it in `useEffect` means it runs after React has committed the empty `<div ref={containerRef}>` to the real DOM, so abcjs is mutating a node React is done touching for that pass. The `content` dependency means a new ABC string (e.g. after editing a song) re-triggers the render call — verified by the "re-renders when content changes" test in `src/components/AbcNotationRenderer.test.tsx:33`. The `{ responsive: "resize" }` option tells abcjs to redraw the SVG when its container resizes, instead of leaving a fixed-width score that overflows on mobile.

**Code-splitting wrapper — `src/components/AbcNotation.tsx`:**
```tsx
"use client";
const AbcNotationRenderer = dynamic(() => import("./AbcNotationRenderer"), {
  ssr: false,
  loading: () => <p>Loading notation…</p>,
});
```
Two problems, one wrapper. First, Next.js 16 throws if you call `dynamic(..., { ssr: false })` from a server component — dynamic's `ssr` option only makes sense in client code, since server components have no client-side hydration step to skip. So `AbcNotation.tsx` is itself marked `"use client"` purely to be a legal place to call `dynamic` with `ssr: false`. Second, and the actual payoff: abcjs is ~180 KB gzipped, and guitar pages never touch it. `dynamic()` puts `AbcNotationRenderer` (and abcjs) in its own chunk that's only fetched when a piano song page actually renders `<AbcNotation>`. Checked in the build manifests — the abcjs chunk only shows up under the `/piano/[artistSlug]/[songSlug]` route, not on any `/guitar/...` route.

**Call chain:** `src/app/piano/[artistSlug]/[songSlug]/page.tsx` (server component, `runtime = "edge"`) fetches `song` from D1 via `getSongBySlugs`, then renders `<AbcNotation content={song.content} />`. That's the only place ABC content and abcjs meet the DOM.

## Interview answer
> Piano songs in my app are stored as ABC notation — a plain-text music format — in the same `content` column that guitar tabs use, so the database layer doesn't need to know or care about the notation format. On the piano song page, a client component calls `abcjs`'s `renderAbc` inside a `useEffect`, because it directly mutates a DOM node's innerHTML rather than returning something React can reconcile, so it has to run after commit, not during render. Since abcjs is about 180 KB gzipped and only piano pages need it, I wrapped it in `next/dynamic` with `ssr: false` behind its own client-component wrapper — Next.js 16 won't let you set `ssr: false` inside a server component — so the bundle only loads on `/piano/[artistSlug]/[songSlug]`, and guitar routes never pay for it.

## Related concepts to explore
- Code-splitting and dynamic imports in Next.js (`next/dynamic`, route-level bundle analysis)
- The `useRef` + `useEffect` pattern for wrapping imperative, DOM-mutating third-party libraries in React
- ADR-0005's broader decision: single-table-with-discriminator schema design vs. per-type tables
