# Screenshot Ingestion Corpus (sheet-ingest ticket 005)

Test images for the vision-direct vs. Audiveris OMR spike (ADR-0007 §2). All
material is public domain (traditional tunes; Bach; Petzold; Bourgeois) and
the images are self-rendered from the `.abc` sources in this directory via
`generate-corpus.ts` — clean digital engraving at OMR-friendly resolution
(2200 px wide, white background), which is what a real screenshot of online
sheet music looks like. Nothing here is copyrighted, so both sources and
images are committed.

Regenerate the images: `npx tsx scripts/fixtures/screenshot-corpus/generate-corpus.ts`

| Image | Material | Category | Complexity characteristics |
|-------|----------|----------|---------------------------|
| `01-guitar-chord-chart.png` | Amazing Grace | Simple guitar chord chart | Single melody line, chord symbols, 3/4, one accidental-free key (G), ties, one dotted figure |
| `02-piano-lead-sheet.png` | Greensleeves | Simple piano lead sheet | 6/8 compound meter, chord symbols, sharps as accidentals (G#), dotted rhythms, repeat barline |
| `03-folk-melody.png` | Air (after the Londonderry Air) | Folk melody | Pickup triplets, a natural accidental, dotted rhythms, wide range |
| `04-two-hand-piano.png` | Minuet in G (attr. Petzold) | Two-hand piano arrangement | Grand staff, independent bass line, an opening chord, slurs |
| `05-dense-counterpoint.png` | Invention No. 1 opening (Bach) | Dense two-voice counterpoint | Continuous 16th-note runs in both hands, voice imitation across staves, 16th rests |
| `06-satb-chorale.png` | Chorale (after Bourgeois' Old 100th) | Dense/classical four-voice score | SATB with two voices per staff, stem directions distinguishing voices, chords throughout |

## Results

`results/` holds the spike outputs per image and path:

- `pathA-<nn>.abc` / `pathA-<nn>.png` — vision-direct transcription and its validated render
- `pathB-<nn>.musicxml` / `pathB-<nn>.abc` / `pathB-<nn>.png` — Audiveris OMR output (unzipped MusicXML), the normalized ABC, and its validated render

The comparison table and recommendation live in
`tickets/sheet-ingest/005-screenshot-ingestion-prototype.md` (Notes section).

## Known bias

The spike driver (Claude) authored the `.abc` sources, then transcribed the
rendered images without consulting them — but this is still a self-rendered
corpus: no photo skew, shadows, or scan noise, and abcjs's own engraving
style. Results should be read as "screenshot of digital sheet music," the
common case for this app, not as phone-photo OMR performance.
