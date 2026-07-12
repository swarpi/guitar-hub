"""Convert a MIDI file to MusicXML on stdout (sheet-ingest ticket 006).

Invoked as a subprocess by scripts/lib/audio-pipeline.ts:

    .venv-audio/bin/python scripts/lib/midi_to_musicxml.py <input.mid>

Writes MusicXML text to stdout; diagnostics go to stderr with a non-zero
exit so the Node caller can surface them (ADR-0007 §3: MIDI -> music21 ->
MusicXML is the normalization step; quantization cleanup is deliberately
left to the Claude review pass, not automated here).
"""

from __future__ import annotations

import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python midi_to_musicxml.py <input.mid>", file=sys.stderr)
        return 2

    midi_path = Path(argv[1])
    if not midi_path.is_file():
        print(f"MIDI file not found: {midi_path}", file=sys.stderr)
        return 1

    # Import inside main so a broken install produces a clean stderr message
    # instead of a bare traceback at module load.
    try:
        from music21 import converter
    except ImportError as exc:
        print(f"music21 is not installed in this environment: {exc}", file=sys.stderr)
        return 1

    try:
        score = converter.parse(midi_path, format="midi")
    except Exception as exc:  # music21 raises a zoo of exception types here
        print(f"music21 could not parse the MIDI file: {exc}", file=sys.stderr)
        return 1

    try:
        from music21.musicxml.m21ToXml import GeneralObjectExporter

        xml_bytes = GeneralObjectExporter(score).parse()
    except Exception as exc:
        print(f"music21 could not export MusicXML: {exc}", file=sys.stderr)
        return 1

    sys.stdout.write(xml_bytes.decode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
