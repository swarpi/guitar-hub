// Falling-notes (Synthesia-style) video-to-MIDI pipeline steps (ADR-0007 §2
// "Synthesia-style falling-notes tutorials", spike ticket sheet-ingest/007).
//
// Frame extraction shells out to ffmpeg; key-press detection wraps
// 41pha1/MIDI-Converter (selection rationale in the ticket Notes), installed
// at ~/tools/MIDI-Converter with its own venv — not vendored into this repo
// (it has no published license; local personal use only, like Audiveris).
//
// The chosen tool consumes a *video*, so framesToMidi keeps the ticket's
// frames-in/MIDI-out boundary by stitching the sampled frames back into an
// .mp4 at the sampled frame rate before invoking it. If a frames-native
// detector replaces it later, only this module's internals change.

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { runCommand } from "./audio-pipeline";

// 30 fps, for two documented reasons (ticket 007 Notes): (1) key presses for
// 16th notes at 120 bpm last ~125 ms, so 33 ms sampling resolves them with
// margin; (2) MIDI-Converter's tick arithmetic (delta_frames × fps against
// mido's default 960 ticks/s) only approximates real time near 30 fps —
// lower stitched rates compress every duration uniformly.
export const FRAME_RATE = 30;

// JPEG q=2 over PNG: detection is brightness-threshold based (tolerant of
// compression), and PNG frames for a one-minute 720p video run to gigabytes.
export const FRAME_PATTERN = "frame-%05d.jpg";

const FFMPEG_BIN = process.env.FALLING_NOTES_FFMPEG ?? "ffmpeg";
const TOOL_DIR =
  process.env.FALLING_NOTES_TOOL_DIR ??
  join(homedir(), "tools", "MIDI-Converter");
const TOOL_PYTHON =
  process.env.FALLING_NOTES_PYTHON ?? join(TOOL_DIR, ".venv", "bin", "python");

export function buildExtractFramesArgs(
  videoPath: string,
  outputDir: string,
): string[] {
  return [
    "-i",
    videoPath,
    "-vf",
    `fps=${FRAME_RATE}`,
    "-q:v",
    "2",
    join(outputDir, FRAME_PATTERN),
  ];
}

/** Sample video frames to <outputDir>/frame-NNNNN.jpg at FRAME_RATE. */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await runCommand(FFMPEG_BIN, buildExtractFramesArgs(videoPath, outputDir));
}

export function buildStitchArgs(
  frameDir: string,
  stitchedVideoPath: string,
): string[] {
  return [
    "-y",
    "-framerate",
    String(FRAME_RATE),
    "-i",
    join(frameDir, FRAME_PATTERN),
    "-c:v",
    "libx264",
    // cv2's default decoder path wants 4:2:0; detection reads brightness,
    // so chroma subsampling is harmless.
    "-pix_fmt",
    "yuv420p",
    stitchedVideoPath,
  ];
}

// Detection tuning, needed for real videos: the tool calibrates its per-key
// baselines from the frame at `startSeconds` (default 0 — fails on videos
// with intro fades) by sampling one pixel row at `keyboardHeight` × frame
// height (default 0.85 — must cross the black-key region, ~0.6 on standard
// Synthesia layouts).
export interface FramesToMidiOptions {
  startSeconds?: number;
  keyboardHeight?: number;
  activationThreshold?: number;
}

export function buildToolArgs(
  stitchedVideoPath: string,
  outputMidiPath: string,
  options: FramesToMidiOptions = {},
): string[] {
  // The positional argument must end in .mp4 or the tool treats it as a
  // YouTube URL (its pytube path, which is dead upstream).
  const args = [
    join(TOOL_DIR, "youtube_midify.py"),
    stitchedVideoPath,
    "-o",
    outputMidiPath,
  ];
  if (options.startSeconds !== undefined) {
    args.push("-s", String(options.startSeconds));
  }
  if (options.keyboardHeight !== undefined) {
    args.push("-k", String(options.keyboardHeight));
  }
  if (options.activationThreshold !== undefined) {
    args.push("-t", String(options.activationThreshold));
  }
  return args;
}

/**
 * Detect key presses across the sampled frames and write a MIDI file.
 * Pass absolute paths — the tool runs with cwd set to `frameDir` because it
 * drops a start_frame.jpg debug image (its detected-keyboard overlay,
 * useful when detection needs tuning) into its working directory.
 */
export async function framesToMidi(
  frameDir: string,
  outputMidiPath: string,
  options: FramesToMidiOptions = {},
): Promise<void> {
  const stitched = join(frameDir, "stitched.mp4");
  await runCommand(FFMPEG_BIN, buildStitchArgs(frameDir, stitched));
  await runCommand(
    TOOL_PYTHON,
    buildToolArgs(stitched, outputMidiPath, options),
    { cwd: frameDir },
  );
}
