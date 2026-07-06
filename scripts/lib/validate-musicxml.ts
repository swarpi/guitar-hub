// Headless MusicXML validation for the sheet-ingest MCP server (ADR-0007 §4).
//
// MusicXML is a pipeline transit format only (ADR-0005, ADR-0007 §3) — this
// renders OMR- or MIDI-derived candidates with Verovio so Claude can catch
// misreads before normalizing to ABC or tab text. Same contract as
// validateAbc (ticket 003): structured errors or a rendered PNG, never
// throws. Async because Verovio's WASM module initializes asynchronously;
// the result union is identical.

import { JSDOM } from "jsdom";
// Default/named imports on purpose — same CJS interop rules as validate-abc.ts.
import { enableLogToBuffer, VerovioToolkit } from "verovio/esm";
import createVerovioModule from "verovio/wasm";

import { Resvg } from "@resvg/resvg-js";

export type ValidateMusicXmlResult =
  | { ok: true; pngBuffer: Buffer }
  | { ok: false; errors: string[] };

// The WASM module is ~7 MB and takes a moment to instantiate; initialize one
// toolkit lazily and reuse it across calls.
let toolkitPromise: Promise<VerovioToolkit> | undefined;

function getToolkit(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = createVerovioModule().then((module) => {
      // Buffer log output so getLog() returns per-loadData diagnostics
      // instead of Verovio printing them to the console.
      enableLogToBuffer(1, module);
      const toolkit = new VerovioToolkit(module);
      // Crop the page to the music instead of a mostly-blank A4 page.
      toolkit.setOptions({ adjustPageHeight: true });
      return toolkit;
    });
  }
  return toolkitPromise;
}

let dom: JSDOM | undefined;

// Verovio's XML parser silently auto-recovers from malformed XML — an
// unclosed tag "loads" as an empty score — so check well-formedness first
// with a real XML parser.
function findXmlError(xml: string): string | null {
  if (!dom) dom = new JSDOM("<!DOCTYPE html><body></body>");
  const doc = new (dom.window.DOMParser)().parseFromString(
    xml,
    "application/xml",
  );
  const parserError = doc.querySelector("parsererror");
  if (!parserError) return null;
  const detail = parserError.textContent?.trim().split("\n")[0] ?? "";
  return `Invalid XML: ${detail || "the document is not well-formed"}`;
}

export async function validateMusicXml(
  xml: string,
): Promise<ValidateMusicXmlResult> {
  if (!xml.trim()) {
    return {
      ok: false,
      errors: ["Input is empty — expected a MusicXML document."],
    };
  }

  const xmlError = findXmlError(xml);
  if (xmlError) {
    return { ok: false, errors: [xmlError] };
  }

  const toolkit = await getToolkit();

  let loaded: boolean;
  try {
    loaded = toolkit.loadData(xml);
  } catch (err) {
    return {
      ok: false,
      errors: [
        `Verovio failed to load the data: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (!loaded) {
    const logLines = toolkit
      .getLog()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      ok: false,
      errors:
        logLines.length > 0
          ? logLines
          : ["Verovio could not import the data as MusicXML."],
    };
  }

  if (toolkit.getPageCount() === 0) {
    return {
      ok: false,
      errors: ["The document loaded but contains no renderable pages."],
    };
  }

  try {
    // Verovio emits standalone SVG (xmlns included), unlike the abcjs path.
    const svg = toolkit.renderToSVG(1);
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 800 },
      font: { loadSystemFonts: true },
    })
      .render()
      .asPng();
    return { ok: true, pngBuffer: Buffer.from(png) };
  } catch (err) {
    return {
      ok: false,
      errors: [
        `Rendering failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
