# ADR-0008: Consolidate Instrument Route Groups Into a Single Dynamic `[instrument]` Group

**Status:** Accepted
**Date:** 2026-07-05
**Author:** Architect Agent

## Context

The Cloudflare Pages deployment fails to publish. The Workers free plan caps a
worker bundle at **3 MiB gzipped**, and our current bundle is **4.57 MiB
gzipped** — over the cap by roughly 50%.

The cause is structural, not a leak. We verified that nothing unexpected is
being pulled into the server bundle: `abcjs` is client-only (code-split,
`ssr:false`), Workbox lives in the service worker, and seed data never reaches
server code. What inflates the bundle is the adapter's emission model.

`@cloudflare/next-on-pages` compiles each App Router route into its **own edge
function**, and every function statically bundles the Next.js 16 App Router edge
runtime — roughly **1.4 MiB per function**. The bundle size therefore scales
with the number of routes, not with the amount of application code we write.

ADR-0005 (multi-instrument support) introduced parallel `/guitar/...` and
`/piano/...` file-system route groups. Each group is a near-identical copy of
five pages:

```
guitar/page.tsx                       piano/page.tsx
guitar/add/page.tsx                   piano/add/page.tsx
guitar/edit/[songId]/page.tsx         piano/edit/[songId]/page.tsx
guitar/[artistSlug]/page.tsx          piano/[artistSlug]/page.tsx
guitar/[artistSlug]/[songSlug]/page.tsx   piano/[artistSlug]/[songSlug]/page.tsx
```

This doubled the emitted function count from **7 to 14** (~16 MB raw across all
functions). The pre-multi-instrument app, at 7 functions, deployed within the
free-plan cap. Duplicating the route tree is what pushed us over.

The functional differences between the two groups are small and localized:

- **Capo:** guitar list items and song detail render a capo field/badge; piano
  omits it entirely.
- **Add page:** `guitar/add` uses `AddPageClient` (AI-import toggle, duplicate
  banner, `getAllSongsFlat(db, "guitar")`); `piano/add` uses a plain `SongForm`.
- **Song detail rendering:** piano renders `AbcNotation` (code-split `abcjs`,
  `ssr:false`); guitar renders a monospace `<pre>` block.
- **Edit guard:** the edit page calls `notFound()` when the loaded song's
  `instrument` does not match the URL segment.

Everything else — headers, breadcrumbs, layout, queries, server actions — is
already parameterized by an `instrument` string. The duplication is almost
entirely mechanical.

The question this ADR answers: **how do we get the bundle back under 3 MiB
gzipped without changing public URLs, losing per-instrument behavior, or
upgrading to a paid plan?**

### Requirements

1. **Fit the free-plan cap.** Bundle must be under 3 MiB gzipped.
2. **URL contract is frozen.** Every current path keeps working byte-for-byte:
   `/guitar`, `/piano`, `/guitar/add`, `/guitar/edit/{id}`,
   `/guitar/{artistSlug}`, `/piano/{artistSlug}/{songSlug}`, and so on.
3. **Invalid instruments 404.** `/banjo`, junk paths, and stray asset-ish
   requests must return `notFound()` after validating against the known list
   `["guitar", "piano"]`.
4. **Preserve ADR-0005 behavior exactly** — capo, the guitar AI-import add flow,
   ABC rendering on piano, and the edit instrument guard.
5. **Keep `abcjs` code-split.** The client chunk stays lazy; the server bundle
   must not grow.
6. **Preserve existing redirects** in `next.config.mjs`
   (`/artists/... → /guitar/...`, `/add → /guitar/add`, `/edit/{id} → ...`).
7. **No paid plan.** Cost is off the table by user decision.

## Decision

Collapse the two duplicated file-system route groups into **one dynamic route
group** parameterized by the instrument segment, under
`src/app/[instrument]/`:

```
[instrument]/page.tsx                          -> song list
[instrument]/add/page.tsx                       -> add form
[instrument]/edit/[songId]/page.tsx             -> edit form
[instrument]/[artistSlug]/page.tsx              -> artist's songs
[instrument]/[artistSlug]/[songSlug]/page.tsx   -> song detail
```

`[instrument]` is a normal dynamic segment. `/guitar` and `/piano` resolve to
the same files with `params.instrument` set to `"guitar"` or `"piano"`. Because
the path shapes are identical, **every public URL from ADR-0005 continues to
match with zero changes.** This ADR amends ADR-0005's *file-structure* decision
while preserving its *URL contract* verbatim.

### Expected outcome

| | Before (ADR-0005) | After (this ADR) |
|---|---|---|
| Emitted edge functions | 14 | ~6 |
| Raw total across functions | ~16 MB | ~8.4 MB |
| Gzipped bundle | 4.57 MiB | est. **2.4–2.5 MiB** |
| Free-plan cap | 3 MiB | 3 MiB |
| Fits? | No | Yes |

The ~6 figure is the five consolidated pages plus the existing landing route and
supporting functions. This lands us near the 7-function footprint that deployed
successfully before multi-instrument support, which is the empirical basis for
the estimate.

### Instrument validation and 404 behavior

Each page validates `params.instrument` against the allowed list before doing
any work:

```ts
const INSTRUMENTS = ["guitar", "piano"] as const;
type Instrument = (typeof INSTRUMENTS)[number];

function assertInstrument(value: string): Instrument {
  if (!INSTRUMENTS.includes(value as Instrument)) notFound();
  return value as Instrument;
}
```

- `/banjo` and unknown segments hit the `[instrument]` route, fail validation,
  and return a 404 via `notFound()`.
- **Static routes still win.** Next.js resolves static segments before dynamic
  ones, so `/` (landing) and any concrete top-level routes take precedence over
  `[instrument]`. The redirects in `next.config.mjs` run before routing, so
  `/artists/...`, `/add`, and `/edit/{id}` redirect as they do today and never
  reach the dynamic group.

### Preserving per-instrument behavior

The differences become conditionals inside the shared pages, keyed on the
validated instrument:

- **List page:** pass `capo` to `SongListItem` only for guitar; the section
  label reads "The Songbook · Guitar" or "· Piano" from the instrument.
- **Add page:** branch on instrument — guitar renders `AddPageClient` with
  `getAllSongsFlat(db, "guitar")` for the duplicate banner and AI-import toggle;
  piano renders the plain `SongForm`. The extra `getAllSongsFlat` query runs
  only on the guitar branch.
- **Song detail:** render `AbcNotation` for piano, `<pre>` for guitar, and the
  capo badge only for guitar. The server function for the combined route
  references the `AbcNotation` wrapper for both instruments, but `abcjs` itself
  stays behind a `dynamic(..., { ssr:false })` client boundary — so the **server
  bundle size is unaffected** (verified: `abcjs` is not in the current server
  bundle). The client chunk stays lazy and loads only on piano detail pages.
- **Edit page:** keep the existing guard — after loading the song by id,
  `notFound()` when `song.instrument` does not equal the validated URL segment.
- **Metadata:** `generateMetadata` continues to return the song/page title; the
  root layout's `"%s — Music Hub"` template supplies the suffix. Unchanged.

### What does not change

- Public URLs, redirects, and the landing page (`/`).
- The database schema, queries (`getSongsByInstrument`, `getSongBySlugs`,
  `getSongById`, `getAllSongsFlat`), and server actions — all already take an
  instrument argument.
- The service worker, offline fallback, and PWA manifest.
- ADR-0005's URL contract, rendering choices, and data model.

## Consequences

### Positive

- **Deploys on the free plan.** Halving the function count is the direct fix for
  the 4.57 MiB → ~2.4–2.5 MiB reduction, with headroom under the 3 MiB cap.
- **Single source of truth per page.** Five files instead of ten. A change to the
  song list, add flow, or detail view is made once and applies to every
  instrument.
- **Cheaper extensibility than ADR-0005 promised.** Adding ukulele no longer
  means copying a five-page route group (and adding five more functions). It
  becomes one entry in the `INSTRUMENTS` array plus any instrument-specific
  render branch — and it adds **zero** new edge functions.
- **Bundle cost is now decoupled from instrument count.** Because instruments are
  data, not routes, the free-plan headroom no longer erodes as instruments grow.

### Negative

- **Pages carry conditional branches.** The shared pages hold `if instrument ===
  "guitar"` logic (capo, `AddPageClient` vs `SongForm`, `<pre>` vs
  `AbcNotation`). This is more branching per file than the duplicated version,
  where each file was single-purpose. The trade is fewer files for slightly
  busier files.
- **Validation is now load-bearing.** Every page must validate `[instrument]`
  before use; a missed check would let an unknown instrument reach a query.
  Centralizing the guard in one helper mitigates this, and tests must cover the
  invalid-instrument 404 path.
- **One combined detail function references both renderers.** The server function
  for `[artistSlug]/[songSlug]` now imports the `AbcNotation` wrapper even for
  guitar requests. This is intentional and verified safe — `abcjs` stays
  client-only, so server bundle size is unaffected — but it is a coupling worth
  noting.

### Neutral

- **The estimate is empirical, not guaranteed.** ~2.4–2.5 MiB is projected from
  the pre-multi-instrument 7-function deploy that fit. The real number must be
  confirmed against `wrangler`/`next-on-pages` output after the refactor. If it
  lands close to the cap, the fallback options in "Alternatives" (paid plan,
  OpenNext) remain open.
- **This does not migrate adapters.** We stay on `@cloudflare/next-on-pages` and
  accept its per-route runtime duplication; we simply stop paying it twice for
  the same pages.

## Rollout

1. **Schema/deploy sequencing.** Production D1 is already migrated to the
   ADR-0005 schema, but the `tab_content → content` column rename is being
   **temporarily reverted** so the currently deployed (old) worker keeps
   serving. After this refactor deploys successfully, the rename is
   **re-applied** so code and schema converge on `content`. Order: (a) land the
   route consolidation and confirm the bundle is under cap, (b) deploy, (c)
   re-apply the column rename.
2. **Verify the number.** Build with `pnpm pages:build` and confirm the emitted
   function count (~6) and gzipped size (< 3 MiB) before promoting.
3. **Regression checks.** Exercise every frozen URL, the invalid-instrument 404,
   the guitar AI-import add flow, piano ABC rendering, the capo badge, and the
   edit instrument guard.

## Alternatives Considered

### Alternative 1: Upgrade to the Workers Paid plan

The paid plan ($5/mo) raises the bundle cap to 10 MiB, which the current 4.57
MiB bundle clears with no code change at all.

**Why rejected:** The user explicitly declined the recurring cost for a personal,
single-user app. It also treats a structural inefficiency (paying for the edge
runtime 14 times) as a billing problem. Consolidation removes the waste rather
than paying to tolerate it. The paid plan remains an available fallback if the
post-refactor bundle unexpectedly lands near the cap.

### Alternative 2: Migrate to the `@opennextjs/cloudflare` adapter

`@opennextjs/cloudflare` is Cloudflare's currently recommended adapter and
compiles the app into a **single** Worker rather than one function per route,
which structurally sidesteps per-route runtime duplication.

**Why rejected (deferred):** This is a larger, riskier migration touching build
config, runtime assumptions, and the D1/`getRequestContext` access pattern. It
does not *inherently* guarantee a smaller bundle, and it would need its own
validation and testing pass. Route consolidation is a smaller, well-understood
change that solves today's blocker within the existing adapter. Migrating to
OpenNext is worth revisiting as a separate ADR if we later outgrow
`next-on-pages` or hit the cap again — but it is not the right first move for an
urgent deploy fix.

### Alternative 3: Trim per-route bundles

Reduce the size of each emitted function by removing dependencies or shrinking
imported code.

**Why rejected:** There is nothing meaningful to trim. We verified the bundle
contains no stray dependencies (`abcjs`, Workbox, and seed data are all absent
from server code). The ~1.4 MiB per function is the Next.js 16 App Router edge
runtime, which `next-on-pages` bundles into every function **by design**. It is
not application code and cannot be pruned without changing the framework or the
adapter. The only lever that moves this bundle is the **number of functions** —
which is exactly what consolidation reduces.
