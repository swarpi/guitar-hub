# Falling-Notes Pipeline End-to-End Reference Run

Artifacts from the ticket sheet-ingest/007 spike: a 47-second public
Synthesia-style tutorial of "Twinkle Twinkle Little Star" (public-domain
melody) taken through `extractFrames` → `framesToMidi` (41pha1/MIDI-Converter,
tuned with `startSeconds: 3`, `keyboardHeight: 0.6`) → `midiToNotation` →
`validate_notation`.

- `tutorial.mid` — key-press detection output (152 note events)
- `tutorial.musicxml` — music21 conversion of that MIDI
- `tutorial-render.png` — Verovio render via `scripts/lib/validate-cli.ts`

The source video and extracted frames are not committed (copyright posture,
ADR-0007 §6 / ticket 005 Notes) — only derived note data of the
public-domain melody. The full outcome analysis, including observed failure
modes, is in `tickets/sheet-ingest/007-falling-notes-frame-to-midi.md` Notes.
