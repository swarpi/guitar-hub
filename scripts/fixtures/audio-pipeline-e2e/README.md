# Audio-Pipeline End-to-End Reference Run

Artifacts from the ticket sheet-ingest/006 manual walkthrough: a synthesized,
user-owned 8-second clip (first phrase of "Twinkle Twinkle Little Star",
public domain — C C G G A A G / F F E E D D C as enveloped sine tones) taken
through `audioToMidi` → `midiToNotation` → `validate_notation`.

- `twinkle.mid` — basic-pitch transcription of the clip
- `twinkle.musicxml` — music21 conversion of that MIDI
- `twinkle-render.png` — Verovio render via `scripts/lib/validate-cli.ts`

The source WAV is not committed (regenerable, ~345 KB). Regenerate with
ffmpeg sine sources — one `sine=frequency=<hz>:duration=<s>` input per note,
each shaped with `afade` in/out (~10 ms attack, ~100 ms release) so
basic-pitch detects note onsets, then `concat`. The exact command and the
outcome analysis are recorded in
`tickets/sheet-ingest/006-local-media-tooling-audio-pipeline.md` Notes.
