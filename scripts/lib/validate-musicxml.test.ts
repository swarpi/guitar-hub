import { describe, expect, it } from "vitest";

import { validateMusicXml } from "./validate-musicxml";

// Minimal valid MusicXML: a single 4/4 measure with one whole note.
const ONE_MEASURE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>
`;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("validateMusicXml", () => {
  it("returns a non-empty PNG buffer for well-formed MusicXML", async () => {
    const result = await validateMusicXml(ONE_MEASURE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pngBuffer.length).toBeGreaterThan(0);
    expect(result.pngBuffer.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("returns errors for malformed XML instead of throwing", async () => {
    // Verovio itself silently auto-recovers from unclosed tags, so this
    // must be caught by the well-formedness check.
    const result = await validateMusicXml("<score-partwise><unclosed>");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Invalid XML");
  });

  it("returns errors for well-formed XML that is not MusicXML", async () => {
    const result = await validateMusicXml(
      '<?xml version="1.0"?><notes><note>C</note></notes>',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns errors for empty input instead of crashing", async () => {
    for (const input of ["", "   \n\t "]) {
      const result = await validateMusicXml(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
