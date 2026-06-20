# Folio — design system for HTML artifacts

Every HTML artifact this workflow produces (learning decks, work summaries,
architecture sketches) follows one design system: **Folio**. Calm, editorial,
print-influenced. White page, warm near-black ink, a single muted terracotta
accent. Sharp corners and hairline rules instead of rounded cards and pills.
Dark code terminals. Hand-drawn diagrams.

Reference implementations (treat the pixels as final):
- `learnings/_deck-template.html` — slide deck (uses `learnings/deck-stage.js`)
- `learnings/_longform-template.html` — same content as a scrolling page
- `summaries/_slide-template.html` — 1024×576 work-summary slide
- `architecture/_sketch-template.html` — layered hand-drawn component map

All artifacts are self-contained: CSS inline in `<head>`, logic in a small
inline `<script>`, no build step, no packages. The only external resources are
Google Fonts. If the project must render offline, self-host the three fonts
and swap the `<link>` for `@font-face`.

## Color tokens (exact)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#ffffff` | page background |
| `--ink` | `#16130f` | headings, primary text |
| `--body` | `#403a33` | body copy |
| `--muted` | `#7b7268` | secondary / labels |
| `--faint` | `#a79d90` | tertiary / axis / meta |
| `--line` | `#ece7df` | hairline separators |
| `--line2` | `#dcd5ca` | stronger hairlines / meta cell borders |
| `--rule` | `#1d1a16` | emphasis rule under section heads |
| `--accent` | `#b0512f` | the one accent (terracotta) |
| `--accent-tint` | `#fbf3ef` | inline-code background |
| `--done` | `#3d7a50` | status: done / healthy / chosen |
| `--prog` | `#b0512f` | status: in progress |
| `--review` | `#9a7322` | status: in review / degraded |
| `--block` | `#bb4030` | status: blocked / down |
| `--todo` | `#9a9388` | status: to do / unknown |

Accent usage is deliberate and sparse. Status colors are the only additional
hues, and always as small dots/tags — never large fills.

## Typography

- **Public Sans** — prose, headings (weights 400/500/600/700)
- **JetBrains Mono** — code, IDs, status labels, metadata, numbers
- **Kalam** — hand-drawn diagram labels only
- Inline code: JetBrains Mono on `--accent-tint`, color `#9a4226`, 3px radius

## Layout rules

- Reading column ~780–1040px, centered, generous padding.
- Section heads: mono, uppercase, `.1em` letter-spacing, `--muted`, with a
  `--rule` or `--line` border. Numbered (`01`, `02`, …) in narrative artifacts.
- **No rounded cards, no pills, no left-accent-border callout boxes.**
  Separation is hairlines (`--line`) and whitespace. Corners are sharp — dark
  code terminals are the only exception (~7px radius).
- Meta strips: a row of cells divided by `--line`, each a mono uppercase label
  over a value.

## Components

- **Status tag** — mono text + colored dot, thin `--line2` border, sharp corners.
- **Trade-off table** — full width, hairline rows, mono first column, `thead`
  underlined with `--rule`. Verdicts colored (`--done` = chosen).
- **Dark code terminal** — `#1a1814` background, ~7px radius, header bar with
  filename + language in mono. Syntax tints: keyword `#e6a06a`, string
  `#a9c08a`, comment `#7c7363`, function `#e0855f`.

## Hand-drawn diagrams (the signature element)

Pure SVG, no library. The sketch look comes from an SVG filter applied to the
**strokes only** — text stays crisp:

```html
<filter id="rough" x="-3%" y="-3%" width="106%" height="106%">
  <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="9" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

- Boxes and arrows live in one `<g filter="url(#rough)">`; labels live in a
  separate un-filtered `<g>` in **Kalam**.
- Arrowheads are an open-V `<marker orient="auto" markerUnits="userSpaceOnUse">`;
  define one ink marker and one accent marker.
- `baseFrequency` ~0.011–0.015 with `scale` ~3 gives a gentle wobble. Higher
  values look jagged — don't.
- Keep diagrams **simple** (5–8 boxes). Use labeled layers/lanes
  (Client / Edge / Backend / Data) only when it aids reading — see
  `architecture/_sketch-template.html`.
- Color a node's stroke + a small status dot to encode state.

## Status vocabulary

When an artifact encodes status, use these exact keys:

- Work items: `todo`, `in_progress`, `in_review`, `blocked`, `done`
- Decisions: `proposed`, `accepted`, `superseded`
- Health: `healthy`, `degraded`, `down`, `unknown`
- Priority: `high`, `medium`, `low`

## Writing voice

All artifact copy follows the voice of Alex Xu's *System Design Interview*
books (see the Writing Style section in `CLAUDE.md`): requirements first,
survey the options, deep-dive the chosen approach, trade-off table, wrap up.
Calm, declarative, teaching. Concrete numbers over adjectives. No hype, no
emoji, no "It's not X, it's Y" reframes.
