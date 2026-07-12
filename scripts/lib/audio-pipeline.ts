// Audio-to-MIDI pipeline steps for sheet ingestion (ADR-0007 §2 "Audio-only /
// performance videos", §3 "MIDI as Intermediate Format").
//
// Each step shells out to a local tool — yt-dlp, basic-pitch, or a music21
// helper script — via child_process.spawn, mirroring scripts/ai-proxy.ts.
// Claude Code drives these steps directly (per the ADR-0007 architecture
// diagram); they are not wrapped in an MCP tool. Install instructions for
// the underlying tools live in scripts/lib/README.md.
//
// Every step throws a descriptive Error (command, exit code, stderr) on
// failure — never fails silently.

import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const LIB_DIR = import.meta.dirname;
const VENV_BIN = join(LIB_DIR, ".venv-audio", "bin");

// Binary locations, overridable for non-default setups (e.g. a system-wide
// basic-pitch instead of the scripts/lib/.venv-audio venv).
const YT_DLP_BIN = process.env.AUDIO_PIPELINE_YT_DLP ?? "yt-dlp";
const BASIC_PITCH_BIN =
  process.env.AUDIO_PIPELINE_BASIC_PITCH ?? join(VENV_BIN, "basic-pitch");
const PYTHON_BIN = process.env.AUDIO_PIPELINE_PYTHON ?? join(VENV_BIN, "python");
const MIDI_TO_MUSICXML_SCRIPT = join(LIB_DIR, "midi_to_musicxml.py");

// yt-dlp and basic-pitch legitimately run for minutes on long sources; this
// is a stuck-process backstop, not an expected duration.
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function formatCommandError(
  command: string,
  code: number | null,
  stderr: string,
  signal?: NodeJS.Signals | null,
): string {
  const exit =
    code !== null
      ? `exited with code ${code}`
      : `was killed${signal ? ` by signal ${signal}` : ""}`;
  const detail = stderr.trim() || "(no stderr output)";
  return `${command} ${exit}: ${detail}`;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface RunCommandOptions {
  timeoutMs?: number;
  /** Working directory — for tools that write auxiliary files to their cwd. */
  cwd?: string;
}

export function runCommand(
  command: string,
  args: string[],
  { timeoutMs = DEFAULT_TIMEOUT_MS, cwd }: RunCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      cwd,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        // Some tools (e.g. MIDI-Converter) report failures on stdout only.
        const detail = stderr.trim() ? stderr : stdout;
        reject(new Error(formatCommandError(command, code, detail, signal)));
      }
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to run ${command}: ${err.message}. Is it installed? See scripts/lib/README.md.`,
        ),
      );
    });
  });
}

// yt-dlp's audio extraction replaces the download's extension, so the output
// template must use %(ext)s — passing a literal foo.wav would yield
// foo.wav.wav. Requiring a .wav target keeps the final path predictable
// (basic-pitch expects a standard audio file, ticket 006 Notes).
export function buildYtDlpArgs(
  youtubeUrl: string,
  outputPath: string,
): string[] {
  if (!outputPath.endsWith(".wav")) {
    throw new Error(
      `downloadAudio output path must end with .wav, got: ${outputPath}`,
    );
  }
  const template = `${outputPath.slice(0, -".wav".length)}.%(ext)s`;
  return [
    "--extract-audio",
    "--audio-format",
    "wav",
    "--no-playlist",
    "--output",
    template,
    youtubeUrl,
  ];
}

/** Extract audio-only from a YouTube URL to a local .wav file. */
export async function downloadAudio(
  youtubeUrl: string,
  outputPath: string,
): Promise<void> {
  await runCommand(YT_DLP_BIN, buildYtDlpArgs(youtubeUrl, outputPath));
}

// basic-pitch's CLI takes an output *directory* and names the file itself:
// <output-dir>/<audio-stem>_basic_pitch.mid.
export function basicPitchMidiPath(
  audioPath: string,
  outputDir: string,
): string {
  const stem = basename(audioPath, extname(audioPath));
  return join(outputDir, `${stem}_basic_pitch.mid`);
}

/**
 * Transcribe an audio file to MIDI with basic-pitch. Runs the CLI into the
 * output path's directory, then renames its `<stem>_basic_pitch.mid` output
 * to the requested path. basic-pitch refuses to overwrite — remove stale
 * outputs before re-running.
 */
export async function audioToMidi(
  audioPath: string,
  outputMidiPath: string,
): Promise<void> {
  const outputDir = dirname(outputMidiPath);
  await runCommand(BASIC_PITCH_BIN, [outputDir, audioPath]);
  const produced = basicPitchMidiPath(audioPath, outputDir);
  if (produced !== outputMidiPath) {
    await rename(produced, outputMidiPath);
  }
}

/**
 * Convert a MIDI file to MusicXML text via the checked-in music21 script.
 * MusicXML is transit-only (ADR-0005/0007) — the caller validates it with
 * validate_notation and normalizes to ABC/tab in the Claude review pass.
 */
export async function midiToNotation(
  midiPath: string,
): Promise<{ musicxml: string }> {
  const { stdout } = await runCommand(PYTHON_BIN, [
    MIDI_TO_MUSICXML_SCRIPT,
    midiPath,
  ]);
  return { musicxml: stdout };
}
