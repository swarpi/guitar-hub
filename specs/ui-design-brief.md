# Guitar Hub — UI Design Brief

## What it is

A personal web app for one guitarist to store and browse their fingerstyle guitar tablature collection. Think of it as a digital version of a well-loved leather-bound songbook that lives in your browser. Dozens of songs, not hundreds.

## Aesthetic direction: "Worn leather-bound songbook"

The app should feel like opening an old, treasured guitar songbook — the kind you'd find on a musician's shelf with dog-eared pages and coffee stains. Warm, analog, textured, lived-in.

- **Colors:** Rich leather browns, aged cream/parchment for the page background, warm amber accents. No pure white, no pure black — everything has warmth. Ink-dark browns for text.
- **Textures:** Subtle leather grain on the outer "binding" areas (header, sidebar edges). Aged paper texture on the content area where tabs are displayed. Nothing glossy or digital-feeling.
- **Typography:** A distinctive serif or hand-lettered display font for headings (song titles, artist names) — something that feels like it was stamped on a book cover. A clean, readable monospace font (JetBrains Mono) for the actual tab content. A warm serif body font for notes and metadata.
- **Details:** Stitching lines along edges. Slight page curl or shadow effects. Gold or burnt-orange foil-like accents for interactive elements. Bookmark ribbons as visual motifs. The overall feeling should be premium and personal, not rustic or kitschy.

## Pages to design (5 total)

### 1. Home — Artist Index (`/`)

A list of all artists, sorted A-Z. This is the entry point.

- Each artist shows their name and a song count (e.g., "Sungha Jung — 4 songs")
- Alphabetical section dividers (A, B, C...) if there are enough artists
- A search/filter input at the top that narrows the list as you type
- Feels like the table of contents of a songbook

### 2. Artist Page (`/artists/[slug]`)

All songs by one artist, sorted A-Z.

- Artist name as the page heading
- List of song titles — each is a link to the tab
- Each song shows the title, and optionally the capo info (e.g., "Capo 5") as a small badge
- Breadcrumb: Home > Artist Name

### 3. Song/Tab Page (`/artists/[slug]/[song-slug]`)

The main event — displaying a guitar tab. This is the page the user spends the most time on.

- Song title and artist name at the top
- Capo badge if applicable (e.g., "Capo 5" in a prominent but tasteful badge)
- The tab itself in a `<pre>` block: monospace font (JetBrains Mono), displayed exactly as stored. The tab content looks like this:

```
e|-------0---------------------------------0------1p0-1---5---
B|--1p0--1------0--------------------------1--1-----------3---
G|----------2-0----0-2p0-2----2-0----0---------2-----------
D|------2---------0-----------3---------2------0-----------
A|------0---------------------------------------------------
E|----------3------1--------------------------------------------
```

- The tab block should feel like a page from the songbook — aged paper background, warm text color
- On mobile, the tab scrolls horizontally (do NOT wrap lines — it breaks alignment)
- Optional notes section below the tab (regular text, not monospace)
- Edit button somewhere accessible but not dominant
- Breadcrumb: Home > Artist > Song Title

### 4. Add Song (`/add`)

A form for pasting in a new tab.

- Fields: Song title, Artist (autocomplete from existing artists or type new), Capo (optional number), Tab content (large textarea), Notes (optional textarea)
- The textarea for tab content should be monospace and large — this is where you paste multi-line tablature
- Preview of how the tab will look before saving would be a nice touch
- Should feel like writing on a fresh page of the songbook

### 5. Edit Song (`/edit/[id]`)

Same form as Add, pre-filled with existing data. Delete option with confirmation.

## Persistent elements

- **Header:** App title "Guitar Hub" in the display font. Compact on mobile. Contains the search input and an "Add" button.
- **Breadcrumbs:** Home > Artist > Song. Always visible for orientation.
- **No sidebar, no footer.** Single-column layout. Simple.

## Mobile behavior

This app is used at a music stand with a phone. Mobile is the primary context.

- Single-column layout at all breakpoints
- Large tap targets for artist/song list items
- Tab content is the only thing that scrolls horizontally
- Header collapses to a compact bar on mobile
- The "Add" button should be easy to reach (bottom-right FAB or in the header)

## What NOT to include

- No login/auth screens
- No practice features (metronome, progress tracking)
- No dark mode (the leather/parchment aesthetic IS the theme)
- No sidebar navigation
- No pagination (the collection is small enough to show everything)
- No social features
