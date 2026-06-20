# ADR-0002: Guitar Hub Foundation — Stack, Data Model, and App Structure

**Status:** Proposed  
**Date:** 2026-06-13  
**Author:** Architect Agent

## Context

Guitar Hub is a personal web app for storing and browsing a fingerstyle guitar tablature collection. The user is a single guitarist who wants one place to find any tab in their library. The collection is small (dozens of songs, not hundreds), organized by artist with alphabetical sorting, and accessed from both desktop and phone.

Key constraints that shape this decision:

1. **Personal scale.** One user, dozens of records, no concurrent writes. This eliminates the need for multi-tenant infrastructure, caching layers, or horizontal scaling.
2. **Multi-device access.** The user wants to pull up tabs on their phone at a music stand. Browser-only storage (IndexedDB, localStorage) is ruled out — data must live on a server.
3. **Write path exists.** Tabs are pasted into the app through a form. The app needs a writable data store, not just static files.
4. **Future AI integration.** An AI feature will inject or convert tabs later. The architecture should expose a clean write interface that AI can call, but should not pre-build AI infrastructure.
5. **"Worn leather-bound songbook" aesthetic.** The UI has a specific visual direction: aged paper, leather textures, vintage typography, warm analog feel. This is the app's design language, distinct from the Folio system (which governs workflow artifacts like decks and summaries, not the application itself).

The existing project conventions establish TypeScript (strict mode, ES2022+), Biome for linting/formatting, Vitest for testing, and pnpm as the package manager. The tech stack should align with these.

## Decision

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | File-based routing, server components, server actions provide a clean write path without building a separate API. |
| **Language** | TypeScript (strict) | Per project conventions. |
| **Database** | Cloudflare D1 (SQLite) | Edge-hosted SQLite on Cloudflare's network. Free tier: 5 GB storage, 5M reads/day, 100K writes/day — orders of magnitude beyond what dozens of songs require. No separate database service to manage. |
| **ORM** | Drizzle ORM | Lightweight, type-safe, first-class D1 support. ~50 KB bundle impact. No code generation step (unlike Prisma). Schema is plain TypeScript. |
| **Styling** | Tailwind CSS 4 | Utility-first CSS for implementing the custom "worn leather" aesthetic. No component library — the visual direction is too specific for off-the-shelf UI kits. |
| **Hosting** | Cloudflare Pages (free tier) | Next.js on Cloudflare via `@cloudflare/next-on-pages`. Free tier: unlimited bandwidth, 500 builds/month. Database (D1) and hosting on the same platform — one account, one dashboard, one deploy command. |
| **Package manager** | pnpm | Per project conventions. |
| **Linter/Formatter** | Biome | Per project conventions. |
| **Test runner** | Vitest | Per project conventions. |

### Data Model

Two tables. No tags, no genres, no difficulty — just artists and songs.

```
artists
├── id          TEXT PRIMARY KEY (nanoid, 12 chars)
├── name        TEXT NOT NULL UNIQUE
├── slug        TEXT NOT NULL UNIQUE
├── created_at  TEXT NOT NULL (ISO 8601)
└── updated_at  TEXT NOT NULL (ISO 8601)

songs
├── id          TEXT PRIMARY KEY (nanoid, 12 chars)
├── artist_id   TEXT NOT NULL → artists.id
├── title       TEXT NOT NULL
├── slug        TEXT NOT NULL (unique per artist)
├── tab_content TEXT NOT NULL (the raw tab text, pasted as-is)
├── capo        INTEGER (nullable — null means no capo)
├── notes       TEXT (nullable — free-text field for tuning info, context, etc.)
├── created_at  TEXT NOT NULL (ISO 8601)
└── updated_at  TEXT NOT NULL (ISO 8601)

UNIQUE(artist_id, slug)
```

Design notes:

- **`tab_content` is plain text.** The user pastes pre-formatted tab (6-string lines with fret numbers, technique notation like `h`, `p`, `/`, `<>`, `X`). The app stores it verbatim and renders it in a monospace block. No parsing, no AST, no custom tab format.
- **`capo` is a separate field** rather than embedded in the tab text, so the UI can display it prominently (e.g., "Capo 2" badge at the top of the tab).
- **`notes` accommodates metadata** that doesn't fit the schema: alternate tunings, source credits, arrangement notes. It's optional and unstructured.
- **`slug` fields enable clean URLs** like `/artists/sungha-jung/dust-in-the-wind`.
- **Nanoid for IDs** instead of auto-increment integers. Short, URL-safe, no sequential information leakage. The `nanoid` package is ~130 bytes.
- **Timestamps as ISO 8601 text.** SQLite has no native datetime type. Text is readable and sortable.

### App Structure (Pages)

```
/                           → Home: list of artists (A-Z)
/artists/[artist-slug]      → Artist page: list of songs by this artist (A-Z)
/artists/[artist-slug]/[song-slug]  → Song page: the tab
/add                        → Add a new song (paste tab, enter metadata)
/edit/[song-id]             → Edit an existing song
```

Five pages total. No dashboard, no settings, no auth (personal app — see "Authentication" in Consequences).

**Navigation:** A persistent header with the app title ("Guitar Hub" in vintage typography) and a simple breadcrumb trail: Home > Artist > Song. On mobile, the header collapses to a compact bar. A search input in the header filters artists/songs as the user types (client-side filter over the small dataset — no search backend needed).

### Tab Rendering

Tabs are rendered in a styled `<pre>` block using a monospace font. The rendering approach:

1. **No parsing.** The tab text is displayed exactly as pasted. The user controls formatting.
2. **Monospace font.** JetBrains Mono (already in the project's font stack per Folio conventions, though used here in the app context for tab display).
3. **"Aged paper" treatment.** The `<pre>` block is styled to look like a page from an old songbook: warm off-white background, subtle paper texture (CSS background pattern or a light texture image), slightly darkened edges. The font color is a warm near-black, not pure black.
4. **Horizontal scroll on mobile.** Tab lines can be 40-80+ characters wide. On narrow screens, the `<pre>` block scrolls horizontally rather than wrapping (wrapping would destroy the tab alignment). A subtle scroll indicator hints that more content is available.
5. **Capo badge.** If `capo` is set, a small badge appears above the tab: "Capo 2" in a muted style.
6. **Notes section.** If `notes` is set, it appears below the tab in regular (non-monospace) text.

### Mobile Responsiveness

The app is phone-first in practice (tabs are read at a music stand). The approach:

- **Single-column layout** at all breakpoints. No sidebars, no multi-panel views.
- **Generous tap targets.** Artist and song list items are large, easy to tap.
- **Tab horizontal scroll.** The only element that may exceed viewport width. Everything else reflows naturally.
- **Viewport-aware header.** Compact on mobile, standard on desktop.
- Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) handle breakpoint-specific adjustments without custom media queries.

### AI Integration Accommodation

The architecture accommodates future AI integration through two mechanisms, neither of which requires building anything today:

1. **Server actions as the write interface.** The same server actions that the Add/Edit forms call (create song, update song) can be called by an API route. When AI integration arrives, a new API route (e.g., `/api/songs`) can wrap these actions, accepting AI-generated tab content and writing it to the database through the existing path.
2. **Plain text `tab_content`.** Because the tab is stored as unstructured text, the AI can produce any valid tab format and the app will display it. No schema migration needed for AI-generated content — it's the same field, same rendering.

What is explicitly deferred:
- No API routes are built until AI integration is designed
- No webhook endpoints, no queue, no background processing
- No tab parsing/validation layer (AI output is trusted at paste-time, same as manual paste)

## Consequences

### Positive

- **Minimal moving parts.** Next.js + SQLite + Vercel is a three-component stack. No Redis, no message queue, no container orchestration. A single developer can understand and maintain the entire system.
- **Fast time to usable.** Five pages, two tables, no auth. The core feature (paste a tab, find it later) can be built in a handful of tickets.
- **Free to operate.** Cloudflare Pages + D1 free tier. Zero monthly cost for a personal app with negligible traffic. Single platform for both hosting and database.
- **Type-safe from database to UI.** Drizzle generates TypeScript types from the schema. No runtime type mismatches between the database and the rendering layer.
- **AI-ready without AI overhead.** Server actions provide a clean programmatic write path. Adding an API route later is a one-file change, not an architectural shift.

### Negative

- **No offline access.** Tabs require a network connection. If the user is in a location without connectivity, they cannot access their tabs. Mitigation: a service worker could cache recently viewed tabs, but this is not in scope for the initial build.
- **No authentication.** The app is publicly accessible to anyone with the URL. For a personal collection, this is acceptable — there's no sensitive data in guitar tabs. If the user later wants privacy, adding auth (e.g., Vercel's built-in auth, or a simple password gate) is straightforward but not free.
- **Cloudflare dependency.** The database and hosting are on the same third-party platform. If Cloudflare changes D1's free tier, the SQLite database can be exported and moved (this is a strength of SQLite — it's a single file). The risk is low but nonzero.
- **Horizontal scroll on mobile is a compromise.** Tab alignment requires monospace rendering without wrapping. Horizontal scrolling is the least-bad option, but it's not a native-feeling interaction on phones. Users must know to scroll right to see full tab lines.

### Neutral

- **The "worn leather" aesthetic is entirely CSS work.** The tech stack neither helps nor hinders it. The visual direction will be implemented through Tailwind utilities, CSS custom properties, and possibly a background texture image. No special tooling is needed.
- **Drizzle vs. Prisma is a low-stakes choice at this scale.** Either would work. Drizzle is chosen for its lighter footprint and lack of a code generation step, but switching to Prisma later would be a modest refactor, not a rewrite.

## Alternatives Considered

### Alternative 1: Static Site Generator (Astro) + Markdown Files

Store each tab as a markdown file in the repository. Use Astro to generate static pages at build time. No database, no server runtime.

**Why rejected:** The user wants to paste tabs through a web UI, which requires a write path. With static files, adding a new tab would require committing a file to the repo and triggering a rebuild — friction that discourages use. Astro also lacks built-in API routes for future AI integration (it can do them via adapters, but it's not its strength). The read-only, content-site model doesn't match the requirement of "paste a tab and see it immediately."

### Alternative 2: Vite + React SPA + Supabase

A client-side single-page app with Supabase (hosted Postgres) as the backend. No server-side rendering.

**Why rejected:** Supabase is a powerful backend-as-a-service, but it introduces more infrastructure than this project needs. Postgres is overkill for two tables and dozens of rows. Supabase's auth, row-level security, and real-time features are irrelevant for a single-user app. The SPA model also means no server-side rendering, which worsens initial load time and SEO (though SEO is irrelevant for a personal app). The main issue is complexity — Supabase adds a dashboard, API keys, connection pooling, and migration tooling that a SQLite file doesn't need.

### Alternative 3: Next.js + JSON File in Repo (No Database)

Store all data in a single `tabs.json` file committed to the repository. The app reads from this file at build time (static generation). New tabs are added by editing the JSON file locally and pushing.

**Why rejected:** This eliminates the need for a database entirely, which is appealing for simplicity. However, it creates the same friction as Alternative 1: adding a tab requires a local development environment, a text editor, and a git push. The user wants to paste a tab from their phone while sitting with their guitar — they should not need to open a terminal. Additionally, Vercel's serverless functions cannot write to the filesystem, so a "save" button in the UI would not work without a database.

### Alternative 4: Browser-Only Storage (IndexedDB)

Store everything in the browser using IndexedDB. No server, no database, no hosting cost beyond static file serving.

**Why rejected:** The user accesses tabs from their phone and presumably their computer. Browser-only storage doesn't sync across devices. Clearing browser data or switching browsers would lose the entire collection. For a personal library that the user builds over time, data durability matters. A server-side store is necessary.
