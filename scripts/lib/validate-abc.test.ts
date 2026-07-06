import { describe, expect, it } from "vitest";

import { validateAbc } from "./validate-abc";

// The "Twinkle Twinkle" example from ADR-0005 §2.
const TWINKLE =
  "X:1\nT:Twinkle Twinkle\nM:4/4\nK:C\nCC GG|AA G2|FF EE|DD C2|\n";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("validateAbc", () => {
  it("returns a non-empty PNG buffer for well-formed ABC", () => {
    const result = validateAbc(TWINKLE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pngBuffer.length).toBeGreaterThan(0);
    expect(result.pngBuffer.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("returns errors for ABC missing the required X: header", () => {
    const result = validateAbc("T:No Reference Number\nK:C\nCC GG|AA G2|\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("X:");
  });

  it("returns one stripped, human-readable error per invalid pitch character", () => {
    const result = validateAbc("X:1\nT:Bad Pitch\nM:4/4\nK:C\nCC qq|AA G2|\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // abcjs flags each bad character; the messages must not leak its HTML markup.
    expect(result.errors).toHaveLength(2);
    for (const error of result.errors) {
      expect(error).toContain("Unknown character");
      expect(error).not.toMatch(/<[^>]*>/);
    }
  });

  it("returns errors for empty input instead of crashing", () => {
    for (const input of ["", "   \n\t "]) {
      const result = validateAbc(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
