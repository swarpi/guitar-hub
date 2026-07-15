/**
 * Image-import branch for ADR-0009's in-app Image sub-mode. The proxy writes an
 * incoming base64 image to a temp file, points `claude -p` at that file by
 * embedding its absolute path in the prompt, and cleans the temp file up in
 * every outcome. Extracted (like url-import.ts for ticket 004) so the
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

interface ImageExtractionRequest {
  image: { mediaType: string; data: string };
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
 * Builds the `claude -p` prompt for a single image. The absolute image path is
 * always embedded verbatim so the Read (vision) tool can open it. The
 * output-format instruction is instrument-aware (ADR-0009 §5): piano targets
 * ABC notation in the collection's conventions; guitar (the default) keeps
 * producing verbatim tab/chord text.
 */
export function buildImagePrompt(
  imagePath: string,
  instrument: Instrument = "guitar"
): string {
  const format =
    instrument === "piano"
      ? "This is piano staff notation. Transcribe it to ABC notation in the collection's existing conventions (X:/T:/M:/L:/K: header, one voice unless the source is clearly multi-staff). Emit the ABC as the content field."
      : "This is a guitar tab or chord sheet. Preserve exact tab spacing and line breaks (fret numbers on string lines), or the chords-over-lyrics layout for chord charts. Emit that text verbatim as the content field.";

  return `Read the image at ${imagePath} and transcribe it. ${format}`;
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
 * Orchestrates a single image extraction: write the temp file, run `claude -p`
 * against an instrument-aware prompt pointing at it, always clean the temp file
 * up, and resolve with the same response envelope the literal/URL branches
 * return (success) or an error envelope (failure / spawn error).
 */
export async function runImageExtraction(
  request: ImageExtractionRequest
): Promise<ProxyResult> {
  const { image, instrument, system, model } = request;
  const resolvedModel = model ?? DEFAULT_MODEL;
  const filePath = await writeTempImageFile(image.data, image.mediaType);

  const args = [
    "-p",
    buildImagePrompt(filePath, instrument),
    "--output-format",
    "text",
    "--model",
    resolvedModel,
    // The temp file lives in os.tmpdir(), outside the proxy's working
    // directory. Headless `claude -p` cannot prompt for read permission on
    // out-of-cwd paths — without this it answers with a permission request
    // instead of the transcription.
    "--add-dir",
    tmpdir(),
    ...(system ? ["--system-prompt", system] : []),
  ];

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
      await cleanupTempImageFile(filePath);

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
      await cleanupTempImageFile(filePath);
      resolve({ status: 500, body: { error: { message: err.message } } });
    });
  });
}
