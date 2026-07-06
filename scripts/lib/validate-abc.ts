// Headless ABC validation for the sheet-ingest MCP server (ADR-0007 §4).
//
// Renders candidate ABC notation with abcjs — the same library the piano
// song pages use client-side (ADR-0005) — inside a jsdom DOM, then
// rasterizes the resulting SVG to PNG with @resvg/resvg-js. Returns either
// structured parse errors (for Claude to fix and retry) or the rendered
// image (for Claude to compare against the source). Never throws.

// Default import on purpose: abcjs is a CJS module, and named imports break
// under the CJS interop tsx applies to this project's scripts.
import abcjs from "abcjs";
import { JSDOM } from "jsdom";

import { Resvg } from "@resvg/resvg-js";

export type ValidateAbcResult =
  | { ok: true; pngBuffer: Buffer }
  | { ok: false; errors: string[] };

// abcjs only needs DOM globals at render time, not load time. Set them
// lazily from a module-private JSDOM, and only if nothing else (e.g. a
// jsdom-environment test) has provided them already.
let dom: JSDOM | undefined;

function getDom(): JSDOM {
  if (!dom) {
    dom = new JSDOM("<!DOCTYPE html><body></body>");
    const g = globalThis as Record<string, unknown>;
    if (g.window === undefined) g.window = dom.window;
    if (g.document === undefined) g.document = dom.window.document;
  }
  return dom;
}

// abcjs warning strings embed HTML markup (e.g. <span> around the offending
// character) meant for its browser editor; strip it down to plain text.
function stripHtml(message: string): string {
  return message.replace(/<[^>]*>/g, "");
}

export function validateAbc(abcText: string): ValidateAbcResult {
  if (!abcText.trim()) {
    return {
      ok: false,
      errors: ["Input is empty — expected ABC notation starting with an X: header."],
    };
  }

  const errors: string[] = [];

  // abcjs silently accepts ABC without the X: reference-number header and
  // renders it anyway, so check the one required header explicitly.
  if (!/^X:\s*\d+/m.test(abcText)) {
    errors.push(
      "Missing required X: header — every ABC tune must start with a reference number line like 'X:1'.",
    );
  }

  const container = getDom().window.document.createElement("div");

  let tune: ReturnType<typeof abcjs.renderAbc>[number] | undefined;
  try {
    [tune] = abcjs.renderAbc(container, abcText, {});
  } catch (err) {
    errors.push(
      `abcjs failed to render: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, errors };
  }

  for (const warning of tune?.warnings ?? []) {
    errors.push(stripHtml(warning));
  }

  if ((tune?.lines ?? []).length === 0) {
    errors.push("No music lines found — the input contains no renderable notation.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const svg = container.querySelector("svg");
  if (!svg) {
    return { ok: false, errors: ["abcjs produced no SVG output."] };
  }

  // outerHTML drops the xmlns attribute, which resvg's XML parser requires.
  const svgText = new (getDom().window.XMLSerializer)().serializeToString(svg);

  try {
    const png = new Resvg(svgText, {
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
        `SVG rasterization failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
