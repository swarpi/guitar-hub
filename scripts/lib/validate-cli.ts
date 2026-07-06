// Thin CLI over the validate_notation logic (tickets 003/004), for driving
// the validation loop from the command line without an MCP client — used by
// the ticket 005 ingestion spike and reusable from the sheet-ingest skill.
//
// Usage: npx tsx scripts/lib/validate-cli.ts <abc|musicxml> <input-file> [output-png]
// Prints errors (exit 1) or writes the rendered PNG (exit 0).

import { readFileSync, writeFileSync } from "node:fs";

import { validateAbc } from "./validate-abc";
import { validateMusicXml } from "./validate-musicxml";

async function main(): Promise<void> {
  const [format, inputPath, outputPath] = process.argv.slice(2);
  if (!format || !inputPath || (format !== "abc" && format !== "musicxml")) {
    console.error(
      "Usage: npx tsx scripts/lib/validate-cli.ts <abc|musicxml> <input-file> [output-png]",
    );
    process.exit(2);
  }

  const content = readFileSync(inputPath, "utf-8");
  const result =
    format === "abc" ? validateAbc(content) : await validateMusicXml(content);

  if (!result.ok) {
    console.error(`INVALID (${result.errors.length} error(s)):`);
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  if (outputPath) {
    writeFileSync(outputPath, result.pngBuffer);
    console.log(`VALID — rendered to ${outputPath}`);
  } else {
    console.log(`VALID — ${result.pngBuffer.length} byte PNG (no output path given)`);
  }
}

main().catch((err) => {
  console.error("validate-cli failed:", err);
  process.exit(1);
});
