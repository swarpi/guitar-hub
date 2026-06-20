# ADR-0003: UI Design System — Color, Typography, Layout, and Aesthetic Direction

**Status:** Accepted  
**Date:** 2026-06-13  
**Author:** Architect Agent

## Context

Guitar Hub needs a visual identity that serves a specific use case: a guitarist browsing tablature on a phone at a music stand, or on a laptop at a desk. The interface is read-heavy — the user scans a list, taps a song, reads a monospace tab block, and occasionally pastes in a new one. The design must prioritize legibility of monospace tab content, fast navigation, and a warm analog feel that distinguishes it from generic tool UIs.

The brief called for a "worn leather-bound songbook" aesthetic. An initial prototype explored this literally — leather textures, embossed typography, crosshatch grain, glossy beveled badges. That direction was rejected as dated and forced ("looks just plain out bad"). The design needed to feel warm and personal without resorting to skeuomorphic costume.

A second round explored four fundamentally different color systems. The user selected **Ivory & Forest** — warm ivory page under a deep green header with forest-green accents. Separately, five wordmark treatments were evaluated; the user chose **Option E: Two-Weight Serif** ("Guitar" bold + "Hub" light italic).

This ADR records the design system that emerged from that iteration.

## Decision

### Color Palette

Seven semantic color tokens define the entire palette. No pure white, no pure black — everything carries warmth or depth.

| Token | Hex | Usage |
|-------|-----|-------|
| `--page` | `#faf9f3` | Main page background (warm ivory) |
| `--paper` | `#f3f1e6` | Tab blocks, form inputs (slightly deeper parchment) |
| `--header` | `#1f3a2e` | Header band (deep forest green) |
| `--leather` | `#244234` | Primary buttons, FAB (slightly lighter forest) |
| `--ink` | `#20281f` | Body text (warm near-black) |
| `--ink-soft` | `#5f6b5c` | Secondary text, labels, placeholders |
| `--accent` | `#2f5d45` | Links, section letters, capo badges, focus rings |

Supporting tokens: `--cream` (`#f1ede1`) for header text, `--line` (`rgba(31,58,46,0.12)`) for dividers, `--tab-text` (`#3a2c1e`) for monospace tab content (warm brown, not green), `--canvas` (`#e2e2d6`) for the outer background behind the page.

### Typography

Three fonts, each with a clear role:

| Font | Role | Sizes |
|------|------|-------|
| **Spectral** (serif) | Titles, body text, breadcrumbs, notes, artist names | 13.5–37px |
| **JetBrains Mono** (monospace) | Tab content, labels, badges, buttons | 10–14px |
| **Bevan** (display slab) | Reserved for future use; loaded but not actively displayed | — |

The wordmark uses Spectral: "Guitar" in `font-weight: 600` and "Hub" in `font-weight: 300; font-style: italic` with a muted sage color (`#a7bdab`). This is the Option E two-weight treatment — understated, editorial, no display font needed.

### Layout Structure

A centered single-column card (max 720px) on the canvas background, with a sticky header and content area below. No sidebar, no footer, no multi-panel views.

```
┌─────────────── canvas (#e2e2d6) ───────────────┐
│                                                  │
│  ┌──────── page card (720px max) ──────────┐    │
│  │  ┌─── header (sticky, #1f3a2e) ──────┐  │    │
│  │  │  Guitar Hub          ＋ ADD         │  │    │
│  │  │  [Search songs or artists…       ] │  │    │
│  │  └────────────────────────────────────┘  │    │
│  │                                          │    │
│  │  THE SONGBOOK                            │    │
│  │  21 songs · 8 artists                    │    │
│  │  ─────────────────────────               │    │
│  │  A                                       │    │
│  │  Amber Light          CAPO 2  ›          │    │
│  │    August Wren                           │    │
│  │  ─────────────────────────               │    │
│  │  ...                                     │    │
│  └──────────────────────────────────────────┘    │
│                                           [＋]   │
└──────────────────────────────────────────────────┘
```

### Home Page: Song-Ordered Index

Songs are listed A–Z **by title**, not grouped by artist. Each entry shows the song title (primary), artist name (subtitle in italic), and a capo badge if applicable. Alphabetical letter dividers (A, C, D, E…) break up the list. The artist name is shown as a subtitle on each song row.

This was a deliberate departure from the original spec (which grouped by artist). The rationale: when you're sitting with your guitar, you think "I want to play Amber Light," not "I want to play something by August Wren." Title-first matches the mental model. Artist pages are still reachable via breadcrumbs on any song page.

### Component Patterns

**Song list items:** Full-width rows with generous height (62px min), truncating title/artist with ellipsis. Capo badges are outlined pills in accent green. Subtle hover: background tint + slight indent. Chevron (›) as a navigation affordance.

**Capo badges:** `font-mono`, 10–11px, uppercase, letter-spaced, outlined with accent-green border on a tinted background. Two sizes: small (in lists) and large (on song page).

**Tab blocks:** `<pre>` with `white-space: pre` and `overflow-x: auto`. No line wrapping — horizontal scroll preserves tab alignment. Paper background, warm brown text, subtle border and shadow.

**Form inputs:** Paper background, serif font for text fields, monospace for the tab textarea. Green focus rings. Capo input constrained to `max-width: 170px`.

**Buttons:** Two styles — primary (leather background, cream text, subtle shadow) and ghost (transparent, bordered, ink-soft text). Delete button in rust (`#9a4424`). All buttons use mono font, uppercase, letter-spaced.

**FAB (Floating Action Button):** 58px circle, leather background, fixed bottom-right. Hidden on form pages (where ＋ Add is redundant).

**Breadcrumbs:** Serif italic, accent green for clickable segments, ink for current. Separator: ›.

**Delete confirmation:** Modal overlay with dimmed background, paper card, serif heading, mono buttons.

### Animation

A single entry animation (`ghFade`) applies to view transitions: 0.28s ease fade-in with a 6px upward translate. Hover effects use CSS transitions (150ms) for background color and padding shifts. No page-level transitions, no spring physics, no animation library.

## Consequences

### Positive

- **Distinctive without being gimmicky.** The Ivory & Forest palette reads as warm, editorial, and personal — not like a generic dashboard or a novelty skeuomorphic app. It stands out without trying hard.
- **Highly legible tabs.** Warm brown on parchment is easier on the eyes than black on white for long reading sessions. Horizontal scroll preserves alignment without compromising mobile usability.
- **Minimal design debt.** Seven color tokens, three fonts, one animation. The system is small enough to hold in your head and consistent enough that new components compose naturally.
- **Mobile-native feel.** Single column, generous tap targets, compact header — the app works as well at 375px as at 720px without conditional layout logic.

### Negative

- **No dark mode.** The aesthetic is the theme — there's no inverted variant. Users in low-light environments get a bright ivory page. A dark mode would require a second complete palette and careful re-testing of contrast ratios.
- **Three Google Fonts adds latency.** Spectral, JetBrains Mono, and Bevan are loaded from Google Fonts. On slow connections, there may be a flash of unstyled text. Next.js `next/font` mitigates this with preloading, but the three-font load is heavier than a single-font system.
- **Song-first index loses artist grouping at a glance.** If the user wants to see all songs by one artist, they must navigate to the artist page via breadcrumbs rather than scanning the home screen. For a collection of dozens this is minor; at hundreds it would matter more.

### Neutral

- **Bevan is loaded but unused.** It was the original display font; the wordmark shifted to Spectral during iteration. It remains in the font stack as a reserved option for future decorative use (e.g., empty states, print headers). Removing it saves ~15 KB but loses the option.
- **The FAB overlaps the last list item.** Bottom padding on the content area provides clearance, but on short lists the FAB can visually crowd the last row. This matches the prototype's behavior and is a common mobile pattern.

## Alternatives Considered

### Alternative 1: Warm Parchment & Tan (Original "Leather-Bound" Direction)

The first prototype used a dark leather header (`#3a2a1e`), parchment page, orange/amber accents, a chunky Bevan slab-serif wordmark, and skeuomorphic details (embossed text, crosshatch leather textures, beveled buttons, gradient badges).

**Why rejected:** The user rejected this outright: "I am overall not happy with this color design it looks just plain out bad." The competing warm tones (dark leather bar + parchment page + orange accents) clashed. The skeuomorphic details read as dated rather than premium. The design was iteratively simplified (lighter header, calmer palette, stripped decorations) but the fundamental warm-on-warm color conflict couldn't be resolved within the palette.

### Alternative 2: Paper & Ink (Pure Editorial Minimalism)

Crisp white surface, near-black ink, no color at all. Pure editorial minimalism.

**Why rejected:** Not selected by the user. While elegant, it lacks the warmth and personality the user wanted. A guitar songbook should feel personal, not clinical.

### Alternative 3: Slate & Sky (Cool Contemporary)

Clean white with cool slate text and a calm blue accent.

**Why rejected:** Not selected by the user. The cool tones feel more like a productivity app than a personal music collection. No warmth.

### Alternative 4: Linen & Rust (Restrained Warm)

Neutral greige base with one confident rust accent.

**Why rejected:** Not selected by the user. Closer to the right warmth, but the rust accent didn't resonate. Ivory & Forest was preferred for its distinctive green identity.

### Alternative 5: Artist-Grouped Home Page (Original Spec)

The original design brief specified a home page organized by artist, with songs nested under each artist heading.

**Why rejected during prototyping:** The prototype builder reordered to song-first A–Z, reasoning that guitarists reach for songs by title, not by artist. The user accepted this without objection. Artist pages remain accessible via breadcrumbs, preserving the artist-grouping use case without making it the default view.
