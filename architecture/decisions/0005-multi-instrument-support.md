# ADR-0005: Multi-Instrument Support — Piano Sheets, Schema Generalization, and App Renaming

**Status:** Proposed  
**Date:** 2026-06-27  
**Author:** Architect Agent

## Context

Guitar Hub is a personal web app for storing fingerstyle guitar tablature. It has two tables (`artists` and `songs`), five pages, and a "worn leather songbook" UI. The app runs on Next.js 16 with Cloudflare Pages and D1 (SQLite via Drizzle ORM). It currently holds 21 seeded guitar tabs and supports full CRUD.

The user wants to extend the app to also store piano sheets. The requirements, gathered through clarifying questions:

1. **Content format:** Piano content will be stored as text in a notation language (not images, not PDFs, not raw text).
2. **Repertoire type:** Pop songs, not classical staff notation. The notation system should be optimized for lead sheets and chord-based arrangements, not dense Chopin scores.
3. **Song separation:** Guitar songs and piano songs are distinct entries. There is no concept of "the same song with multiple instrument arrangements." A piano entry for "River Flows in You" and a guitar entry for "River Flows in You" are two independent records.
4. **Piano metadata:** Keep it simple. No key signature fields, no tempo markings, no difficulty ratings.
5. **Navigation:** Separate sections. Guitar content lives under `/guitar/...`, piano content under `/piano/...`. The user picks an instrument context and browses within it.
6. **App identity:** Rename from "Guitar Hub" to "Music Hub."
7. **Future instruments:** Ukulele is possible later. The schema should not make adding a third instrument painful.

The core architectural question is how to extend a guitar-specific data model, routing structure, and UI to support multiple instruments without overengineering for a personal app with dozens of entries.

## Decision

### 1. Schema: Single `songs` Table with an `instrument` Discriminator

Add an `instrument` TEXT column to the existing `songs` table. Rename the `tab_content` column to `content` for instrument-neutral semantics.

```
songs (updated)
 id          TEXT PRIMARY KEY (nanoid)
 artist_id   TEXT NOT NULL -> artists.id
 instrument  TEXT NOT NULL DEFAULT 'guitar'   -- NEW
 title       TEXT NOT NULL
 slug        TEXT NOT NULL
 content     TEXT NOT NULL                    -- RENAMED from tab_content
 capo        INTEGER (nullable)
 notes       TEXT (nullable)
 created_at  TEXT NOT NULL (ISO 8601)
 updated_at  TEXT NOT NULL (ISO 8601)

 UNIQUE(artist_id, slug, instrument)          -- CHANGED from (artist_id, slug)
```

The `artists` table is unchanged. Artists are shared across instruments.

Design notes:

- **`instrument` is a plain TEXT column**, not an enum table or a separate instruments table. At two values (`guitar`, `piano`) growing to maybe three (`ukulele`), a lookup table adds a join for zero benefit. The application validates allowed values; the database stores them as strings.
- **`capo` stays as a column.** It applies to guitar and ukulele but not piano. Piano rows store `capo = NULL`. This is cleaner than moving it to a JSON metadata blob. At this scale, a nullable column that some instruments ignore is simpler than polymorphic metadata.
- **No new piano-specific columns.** The user requested minimal metadata. The existing `notes` field (free text) handles anything instrument-specific: key, tempo, arrangement notes. If piano later needs a structured field (e.g., `key_signature`), it can be added as another nullable column.
- **The unique constraint expands to `(artist_id, slug, instrument)`.** This allows the same artist to have "River Flows in You" as both a guitar tab and a piano sheet without conflict.
- **Column rename: `tab_content` to `content`.** The term "tab" is guitar jargon. The field stores the primary musical content regardless of instrument. SQLite 3.25.0+ supports `ALTER TABLE RENAME COLUMN`, and Cloudflare D1 uses a modern SQLite engine.

**Why a single table, not separate tables per instrument:**

At this scale (dozens of entries, one user), schema simplicity wins. One table means one set of queries, one set of server actions, one set of types. The `instrument` column adds a `WHERE` clause to queries; it does not add tables, joins, or ORM complexity. When the user adds ukulele later, it is a new string value and a new route group — not a new table, new queries, and new actions.

Separate tables would be appropriate if instruments had wildly different schemas (a classical score with movements, tempos, and key changes per section vs. a guitar tab with capo). For pop songs on guitar, piano, and ukulele, the schemas are nearly identical: artist, title, content, optional metadata, notes.

### 2. Piano Content Format: ABC Notation

Piano content will be stored as ABC notation text.

**What is ABC notation:** A text-based music notation language originally designed for folk and traditional music. A simple melody looks like:

```
X:1
T:Twinkle Twinkle
M:4/4
K:C
CC GG|AA G2|FF EE|DD C2|
```

It is human-readable, human-writable, and compact. The text stores in a `TEXT` column identically to guitar tabs.

**Why ABC notation over alternatives:**

| Criterion | ABC Notation | LilyPond | MusicXML |
|-----------|-------------|----------|----------|
| **Human-writable** | Yes, by design | Requires learning a markup language | XML; not hand-authored |
| **Pop song fit** | Designed for folk/pop lead sheets | Designed for classical engraving | Interchange format, not a source format |
| **Storage** | Compact text | Compact text | Verbose XML (10-50x larger) |
| **Browser rendering** | `abcjs` library (~180 KB gzipped) renders to SVG | No mature browser renderer | Needs XSLT or a heavy renderer |
| **Ecosystem** | Widely used in folk/traditional communities, large corpus of existing ABC online | Academic/professional engraving | Notation software interchange |
| **Learning curve** | Low for simple melodies, moderate for complex arrangements | High | Not applicable (generated, not written) |

`abcjs` is the rendering library. It parses ABC text and produces SVG staff notation in the browser. It supports:
- Treble and bass clefs (piano grand staff)
- Chords, lyrics, dynamics
- Multiple voices (right hand / left hand)
- Interactive playback (MIDI synthesis) — a future enhancement, not in scope now

**Storage approach:** ABC notation text is stored in the `content` column, the same column that holds guitar tab text. The application reads `instrument` to decide how to render: monospace `<pre>` for guitar, `abcjs` SVG rendering for piano.

**What is NOT in scope:** A visual ABC editor, MIDI playback, transposition tools, or PDF export. The user pastes ABC text into a textarea, the app stores it, and the song detail page renders it as staff notation via `abcjs`. This mirrors the guitar workflow: paste text, view rendered output.

### 3. URL and Routing Structure

Replace the current `/artists/...` routing with instrument-prefixed sections:

```
Current routes (removed):
/                                    -> Home (all guitar songs)
/artists/[artistSlug]                -> Artist page
/artists/[artistSlug]/[songSlug]     -> Song page
/add                                 -> Add song
/edit/[songId]                       -> Edit song

New routes:
/                                    -> Landing page (instrument picker)
/guitar                              -> Guitar section home (all guitar songs, A-Z)
/guitar/add                          -> Add guitar song
/guitar/edit/[songId]                -> Edit guitar song
/guitar/[artistSlug]                 -> Guitar songs by this artist
/guitar/[artistSlug]/[songSlug]      -> Guitar song detail (tab view)
/piano                               -> Piano section home (all piano songs, A-Z)
/piano/add                           -> Add piano song
/piano/edit/[songId]                 -> Edit piano song
/piano/[artistSlug]                  -> Piano songs by this artist
/piano/[artistSlug]/[songSlug]       -> Piano song detail (ABC -> staff notation)
```

**File system layout in `src/app/`:**

```
page.tsx                              -> Landing page
guitar/
  page.tsx                            -> Guitar song list
  add/page.tsx                        -> Add guitar song form
  edit/[songId]/page.tsx              -> Edit guitar song form
  [artistSlug]/page.tsx               -> Artist's guitar songs
  [artistSlug]/[songSlug]/page.tsx    -> Guitar song detail
piano/
  page.tsx                            -> Piano song list
  add/page.tsx                        -> Add piano song form
  edit/[songId]/page.tsx              -> Edit piano song form
  [artistSlug]/page.tsx               -> Artist's piano songs
  [artistSlug]/[songSlug]/page.tsx    -> Piano song detail
```

**Route conflict resolution:** Next.js matches static segments before dynamic segments. `/guitar/add` (static) takes priority over `/guitar/[artistSlug]` (dynamic). No conflict.

**Landing page (`/`):** A simple page showing "Music Hub" branding with two entry points — Guitar and Piano — each showing the count of songs in that section. This replaces the current home page, which lists all songs. The per-instrument home pages (`/guitar`, `/piano`) take over the song listing role.

**Shared layout:** The `guitar/` and `piano/` route groups can share a layout that provides instrument-aware navigation (breadcrumbs, header context). The root layout stays global (fonts, body styling, service worker).

**Redirect for old URLs:** The old `/artists/...` paths should 301-redirect to `/guitar/...` to avoid breaking any bookmarks or cached PWA pages. This is a one-time migration concern since the app is personal with one user.

### 4. App Renaming: Guitar Hub to Music Hub

All references to "Guitar Hub" change to "Music Hub":

| Location | Current | New |
|----------|---------|-----|
| `src/app/layout.tsx` metadata title | `"Guitar Hub"` | `"Music Hub"` |
| `src/app/layout.tsx` metadata description | `"A personal fingerstyle guitar tablature collection"` | `"A personal music sheet and tablature collection"` |
| `public/manifest.json` name and short_name | `"Guitar Hub"` | `"Music Hub"` |
| Header component display text | `"Guitar Hub"` | `"Music Hub"` |
| `wrangler.toml` project name | `"guitar-hub"` | `"music-hub"` |
| `wrangler.toml` D1 database_name | `"guitar-hub-db"` | No change (renaming a live D1 database is not supported; the binding name `DB` stays the same) |
| `package.json` name field | `"guitar-hub"` | `"music-hub"` |
| Page titles (e.g., "Add a Song -- Guitar Hub") | `"Guitar Hub"` suffix | `"Music Hub"` suffix |

**What does NOT change:**
- The repository directory name (`guitar_hub`). Renaming a git repo's directory is a local filesystem concern, not a code change. The user can rename it if they want.
- The D1 database name. Cloudflare D1 does not support renaming databases. The existing `guitar-hub-db` continues to work; the binding name `DB` is what the code references.
- The Cloudflare Pages project name. This can be updated in the Cloudflare dashboard if desired, but the deployment target is configured by `wrangler.toml`, not the project name.

### 5. Migration Path

The migration is a single SQL file applied to the live D1 database:

```sql
-- Step 1: Add instrument column with default for existing rows
ALTER TABLE songs ADD COLUMN instrument TEXT NOT NULL DEFAULT 'guitar';

-- Step 2: Rename tab_content to content
ALTER TABLE songs RENAME COLUMN tab_content TO content;

-- Step 3: Drop the old unique constraint and create the new one
-- SQLite does not support DROP CONSTRAINT. The existing unique index
-- must be dropped and recreated.
DROP INDEX IF EXISTS songs_artist_slug_unique;
CREATE UNIQUE INDEX songs_artist_slug_instrument_unique
  ON songs(artist_id, slug, instrument);
```

**Risk assessment:** The migration is additive (new column, renamed column, updated index). No data is deleted or transformed. Existing guitar songs gain `instrument = 'guitar'` automatically via the DEFAULT clause. The migration can be tested locally against the dev D1 before running on production.

**Drizzle schema update:** The Drizzle schema in `src/db/schema.ts` must be updated to reflect the new column, renamed column, and updated constraint. This is a code change, not a SQL migration, but it must happen in the same ticket.

**Application code migration:** All references to `tabContent` in queries, actions, components, and tests must be updated to `content`. All queries that read songs must add `WHERE instrument = ?` to scope results to the correct instrument. Server actions must accept and validate the `instrument` field.

### 6. Future Extensibility: Ukulele and Beyond

The architecture supports adding ukulele (or any instrument) through:

1. **Schema:** No changes. Insert rows with `instrument = 'ukulele'`. The `capo` field applies to ukulele (ukuleles use capos). The `content` field stores ukulele tab (4-string format, same plain text as guitar).
2. **Routing:** Add a `src/app/ukulele/` route group mirroring the guitar and piano structure. This is a file-system operation — copy the guitar route group, change the instrument filter in queries.
3. **Validation:** Add `'ukulele'` to the allowed instrument values in the server action validation.
4. **Landing page:** Add a third card/section for ukulele.
5. **Rendering:** Ukulele tabs render identically to guitar tabs (monospace `<pre>`). No new rendering logic.

Estimated effort to add ukulele: a single ticket. No schema migration, no new libraries, no architectural changes.

## Consequences

### Positive

- **Minimal schema change.** One new column, one rename, one index update. No new tables, no foreign keys, no joins. The `artists` table is untouched.
- **Code reuse.** Queries, server actions, and form components are parameterized by instrument rather than duplicated. The `SongForm` component works for all instruments with minor conditional fields (show capo for guitar/ukulele, hide for piano).
- **ABC notation fits the existing pattern.** Piano content is pasted as text and stored in a TEXT column, exactly like guitar tabs. The storage layer does not know or care about the notation format.
- **Clean URL structure.** Instrument-prefixed routes (`/guitar/...`, `/piano/...`) make the browsing context immediately clear. URLs are short and readable.
- **Low-cost extensibility.** Adding a third instrument is a one-ticket change: a new route group, a new instrument string, and possibly a new rendering mode. No migration needed.

### Negative

- **`abcjs` adds bundle size.** The library is approximately 180 KB gzipped. It only needs to load on piano pages, so code-splitting (dynamic import) mitigates the impact on guitar pages. But it is a non-trivial addition to a currently lightweight app.
- **ABC notation has a learning curve.** The user must learn ABC syntax to enter piano sheets. Unlike guitar tabs (which are intuitive: 6 lines, fret numbers), ABC notation has its own header syntax, note durations, and key signatures. For pop songs, the subset needed is small, but it is still a new format to learn.
- **Column rename touches many files.** Renaming `tabContent` to `content` throughout the codebase (schema, queries, actions, components, tests) is a mechanical but wide-reaching change. It must be done carefully to avoid runtime errors.
- **Redirects for old URLs.** The `/artists/...` to `/guitar/...` redirect is a small maintenance burden. For a personal app with one user, this is low risk, but cached PWA pages under old URLs will break until the service worker is updated.
- **Instrument validation is application-level.** SQLite has no native enum type. Invalid instrument values (typos, empty strings) are caught by application code, not the database. A CHECK constraint could be added (`CHECK(instrument IN ('guitar', 'piano', 'ukulele'))`), but it would need updating each time an instrument is added.

### Neutral

- **The "worn leather songbook" aesthetic applies to both instruments.** The visual design is not guitar-specific. Staff notation rendered by `abcjs` can be styled with the same warm paper tones and vintage feel. The design system does not need rethinking.
- **The service worker caching strategy (ADR-0004) is unaffected.** Piano pages are HTML responses cached the same way as guitar pages. The `abcjs` JS bundle is a static asset that gets precached.
- **The AI integration plan (ADR-0004, Phase 3) is unaffected.** The server action write path (`createSongLogic`) will accept an `instrument` field. An AI route can generate guitar tabs or ABC notation and write through the same interface.

## Alternatives Considered

### Alternative 1: Separate Tables Per Instrument (`guitar_songs`, `piano_songs`)

Create a dedicated table for each instrument with only the columns relevant to that instrument. `guitar_songs` keeps `capo`; `piano_songs` omits it.

**Why rejected:** At this scale (dozens of entries, one user, two-to-three instruments with nearly identical schemas), separate tables multiply the query layer, action layer, and type definitions without providing meaningful benefits. The schemas differ by one nullable column (`capo`). Separate tables are the right choice when instruments have fundamentally different data shapes — a classical score with movements vs. a guitar tab — but for pop songs across guitar, piano, and ukulele, the shapes are 95% identical. A single table with an instrument discriminator is simpler to query, simpler to maintain, and trivial to extend.

### Alternative 2: Store Piano Content as Images or PDFs

Accept uploaded PDF or image files for piano sheets instead of a text notation language.

**Why rejected:** The user explicitly chose text-based notation over images. Beyond preference, text has concrete advantages: it renders responsively on any screen size (no pinch-to-zoom on phone), it is searchable, it is diffable, and it stores efficiently in a TEXT column without blob storage. Images and PDFs would require file storage (R2 or S3), larger payloads, and a different rendering pipeline. The entire app is built around "paste text, render it" — images would be a fundamentally different content model.

### Alternative 3: MusicXML Instead of ABC Notation

Use MusicXML as the piano content format. MusicXML is the standard interchange format for notation software (MuseScore, Finale, Sibelius).

**Why rejected:** MusicXML is XML — verbose, not human-writable, and not designed for hand-authoring. A simple melody that takes 3 lines in ABC takes 50+ lines in MusicXML. The user's workflow is "paste content into a form." Nobody writes MusicXML by hand; it is exported from notation software. If the user were importing from MuseScore, MusicXML would make sense. But for manually entering pop song sheets, ABC notation is more practical. Additionally, browser rendering of MusicXML requires heavier libraries (OpenSheetMusicDisplay is ~1 MB) compared to `abcjs` (~180 KB).

### Alternative 4: LilyPond Instead of ABC Notation

Use LilyPond markup as the notation language. LilyPond produces publication-quality engraved scores.

**Why rejected:** LilyPond is a powerful typesetting system, but it is designed for producing printed scores, not for browser rendering. There is no mature client-side LilyPond renderer — rendering requires a server-side LilyPond binary that compiles markup to PDF or SVG. This would mean either running a LilyPond process on the server (incompatible with Cloudflare's edge runtime) or pre-rendering at write time and storing the output. ABC notation with `abcjs` renders entirely in the browser with zero server involvement, which fits the existing architecture.

### Alternative 5: Keep `/artists/...` Routes, Add Instrument as Query Parameter

Keep the current URL structure and add `?instrument=guitar` or `?instrument=piano` as a query parameter. `/artists/john-mayer/gravity?instrument=guitar`.

**Why rejected:** The user explicitly requested separate sections (`/guitar/...` and `/piano/...`). Beyond that, instrument-as-query-parameter has UX problems: it is easy to forget, it does not appear in the URL path (less scannable), and it makes bookmarking and sharing less intuitive. Instrument-prefixed routes make the browsing context immediately visible in the URL bar, in breadcrumbs, and in the browser history.
