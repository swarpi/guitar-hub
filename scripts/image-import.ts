/**
 * Image-import branch for the in-app image import (ADR-0009, extended to
 * multi-image + multi-turn by ADR-0010). The proxy writes each incoming base64
 * image to a temp file, points `claude -p` at those files by embedding their
 * absolute paths in the prompt (with prior conversation turns threaded in
 * Human:/Assistant: format), and cleans every temp file up in every outcome.
 * Extracted (like url-import.ts for ticket 004) so the
 * side-effecting-but-mockable logic can be unit-tested with node:child_process
 * and node:fs/promises mocked, following the audio-pipeline.test.ts pattern.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_MODEL = "claude-sonnet-4-5";

type Instrument = "guitar" | "piano";

interface ImagePayload {
  mediaType: string;
  data: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ImageExtractionRequest {
  /** Legacy single-image field (ADR-0009). Ignored when `images` is present. */
  image?: ImagePayload;
  /** Multi-image field (ADR-0010). Takes precedence over `image`. */
  images?: ImagePayload[];
  /** Full conversation history; the last entry is the current turn. */
  messages?: ChatMessage[];
  instrument?: Instrument;
  system?: string;
  model?: string;
}

interface ProxyResult {
  status: number;
  body: unknown;
}

/**
 * Maps an image media type to the file extension used for the temp file. Known
 * types map directly; anything else falls back to "jpg" (the normalized format
 * ADR-0009 §3 produces client-side).
 */
export function mediaTypeToExtension(mediaType: string): string {
  switch (mediaType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Builds the `claude -p` image instruction for one or more images. Every
 * absolute image path is embedded verbatim so the Read (vision) tool can open
 * it. The output-format instruction is instrument-aware (ADR-0009 §5): piano
 * targets ABC notation in the collection's conventions; guitar (the default)
 * keeps producing verbatim tab/chord text. With more than one path the model
 * is told to stitch the images into a single complete piece (ADR-0010 §4.2).
 */
export function buildImagePrompt(
  imagePaths: string | readonly string[],
  instrument: Instrument = "guitar"
): string {
  const paths = typeof imagePaths === "string" ? [imagePaths] : imagePaths;
  const format =
    instrument === "piano"
      ? "This is piano staff notation. Transcribe it to ABC notation in the collection's existing conventions (X:/T:/M:/L:/K: header, one voice unless the source is clearly multi-staff). Emit the ABC as the content field."
      : "This is a guitar tab or chord sheet. Preserve exact tab spacing and line breaks (fret numbers on string lines), or the chords-over-lyrics layout for chord charts. Emit that text verbatim as the content field.";

  if (paths.length <= 1) {
    return `Read the image at ${paths[0]} and transcribe it. ${format}`;
  }
  return `Read the images at ${paths.join(", ")} and transcribe them as a single complete piece — they are sequential panels of one song. ${format}`;
}

/**
 * Assembles the full `-p` prompt for an extraction turn (ADR-0010 §4.3).
 * Prior conversation turns (all messages except the last) are threaded in the
 * same Human:/Assistant: format ai-proxy.ts's buildPrompt uses; the current
 * turn's text (if any) and the image instruction for the current request's
 * images follow. With no history and no current-turn text this reduces to the
 * bare image instruction — ai-import/006's original single-turn shape.
 */
export function buildExtractionPrompt(
  imagePaths: readonly string[],
  instrument: Instrument = "guitar",
  messages?: readonly ChatMessage[]
): string {
  const parts: string[] = [];

  if (messages && messages.length > 1) {
    parts.push(
      messages
        .slice(0, -1)
        .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
        .join("\n\n")
    );
  }

  const currentText =
    messages && messages.length > 0
      ? messages[messages.length - 1].content.trim()
      : "";
  if (currentText) {
    parts.push(currentText);
  }

  if (imagePaths.length > 0) {
    parts.push(buildImagePrompt(imagePaths, instrument));
  }

  return parts.join("\n\n");
}

/**
 * Decodes a base64 image payload and writes it to a uniquely named temp file
 * under os.tmpdir(). Resolves with the absolute path written.
 */
export async function writeTempImageFile(
  base64Data: string,
  mediaType: string
): Promise<string> {
  const ext = mediaTypeToExtension(mediaType);
  const filePath = join(tmpdir(), `guitarhub-import-${randomUUID()}.${ext}`);
  await writeFile(filePath, Buffer.from(base64Data, "base64"));
  return filePath;
}

/**
 * Deletes a temp image file. Any rejection (e.g. the file is already gone) is
 * caught and logged — cleanup failure must never crash the proxy or fail the
 * request.
 */
export async function cleanupTempImageFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`  ! temp file cleanup failed for ${filePath}: ${reason}`);
  }
}

/**
 * Orchestrates one extraction turn: write a temp file per image, run
 * `claude -p` against an instrument-aware prompt pointing at all of them (with
 * prior conversation turns threaded in), always clean every temp file up, and
 * resolve with the same response envelope the literal/URL branches return
 * (success) or an error envelope (failure / spawn error).
 *
 * Images attach to the current turn only (ADR-0010 §4): only the images in
 * this request are written and referenced — prior turns' images are never
 * re-sent, their context lives in `messages` as text.
 */
export async function runImageExtraction(
  request: ImageExtractionRequest
): Promise<ProxyResult> {
  const { image, images, messages, instrument, system, model } = request;
  const resolvedModel = model ?? DEFAULT_MODEL;
  // Backward-compat shim (ADR-0010 §3): a legacy singular `image` is wrapped
  // into a one-element array; `images` takes precedence when present.
  const resolvedImages = images ?? (image ? [image] : []);

  const filePaths: string[] = [];
  for (const img of resolvedImages) {
    filePaths.push(await writeTempImageFile(img.data, img.mediaType));
  }

  const args = [
    "-p",
    buildExtractionPrompt(filePaths, instrument, messages),
    "--output-format",
    "text",
    "--model",
    resolvedModel,
    // The temp files live in os.tmpdir(), outside the proxy's working
    // directory. Headless `claude -p` cannot prompt for read permission on
    // out-of-cwd paths — without this it answers with a permission request
    // instead of the transcription.
    "--add-dir",
    tmpdir(),
    ...(system ? ["--system-prompt", system] : []),
  ];

  // cleanupTempImageFile never rejects, so one failed unlink cannot stop the
  // remaining files from being cleaned up.
  async function cleanupAll(): Promise<void> {
    for (const filePath of filePaths) {
      await cleanupTempImageFile(filePath);
    }
  }

  return new Promise<ProxyResult>((resolve) => {
    const child = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

    child.on("close", async (code) => {
      await cleanupAll();

      if (code !== 0) {
        resolve({
          status: 500,
          body: {
            error: {
              message: stderr.trim() || `Process exited with code ${code}`,
            },
          },
        });
        return;
      }

      resolve({
        status: 200,
        body: {
          content: [{ type: "text", text: stdout.trim() }],
          model: resolvedModel,
          role: "assistant",
        },
      });
    });

    child.on("error", async (err) => {
      await cleanupAll();
      resolve({ status: 500, body: { error: { message: err.message } } });
    });
  });
}
