// Renders every .abc source in this directory to a high-resolution,
// white-background PNG — the "screenshot" corpus for the sheet-ingest
// ticket 005 spike (vision-direct vs. Audiveris OMR comparison).
//
// Run: npx tsx scripts/fixtures/screenshot-corpus/generate-corpus.ts
//
// The corpus deliberately uses clean digital engraving (that is what a
// screenshot of online sheet music looks like) at OMR-friendly resolution.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
// Default import on purpose — same CJS interop rules as scripts/lib/validate-abc.ts.
import abcjs from "abcjs";
import { JSDOM } from "jsdom";

import { Resvg } from "@resvg/resvg-js";

const CORPUS_DIR = import.meta.dirname;
const RENDER_WIDTH = 2200;

const dom = new JSDOM("<!DOCTYPE html><body></body>");
const g = globalThis as Record<string, unknown>;
if (g.window === undefined) g.window = dom.window;
if (g.document === undefined) g.document = dom.window.document;

const abcFiles = readdirSync(CORPUS_DIR)
  .filter((f) => f.endsWith(".abc"))
  .sort();

for (const file of abcFiles) {
  const abcText = readFileSync(resolve(CORPUS_DIR, file), "utf-8");
  const container = dom.window.document.createElement("div");

  const [tune] = abcjs.renderAbc(container, abcText, { staffwidth: 1000 });
  if (tune?.warnings?.length) {
    console.error(`${file}: abcjs warnings — fix the source first:`);
    for (const w of tune.warnings) console.error(`  ${w.replace(/<[^>]*>/g, "")}`);
    process.exitCode = 1;
    continue;
  }

  const svg = container.querySelector("svg");
  if (!svg) {
    console.error(`${file}: no SVG produced`);
    process.exitCode = 1;
    continue;
  }

  const svgText = new (dom.window.XMLSerializer)().serializeToString(svg);
  const png = new Resvg(svgText, {
    fitTo: { mode: "width", value: RENDER_WIDTH },
    background: "white",
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();

  const outPath = resolve(CORPUS_DIR, `${basename(file, ".abc")}.png`);
  writeFileSync(outPath, png);
  console.log(`${file} -> ${basename(outPath)} (${(png.length / 1024).toFixed(0)} KB)`);
}
