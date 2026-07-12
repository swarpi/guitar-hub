// Unit tests for the audio-pipeline shell-out steps (sheet-ingest ticket 006).
// child_process.spawn and fs rename are mocked — no network, no real
// binaries — following the no-network-I/O convention from url-import.test.ts.

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  audioToMidi,
  basicPitchMidiPath,
  buildYtDlpArgs,
  downloadAudio,
  formatCommandError,
  midiToNotation,
  runCommand,
} from "./audio-pipeline";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ rename: vi.fn() }));

import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";

const spawnMock = vi.mocked(spawn);
const renameMock = vi.mocked(rename);

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

/** Queue a spawn that emits the given streams, then closes with `code`. */
function nextSpawn({
  code = 0,
  signal = null as NodeJS.Signals | null,
  stdout = "",
  stderr = "",
} = {}): void {
  spawnMock.mockImplementationOnce(() => {
    const child = fakeChild();
    queueMicrotask(() => {
      if (stdout) child.stdout.emit("data", Buffer.from(stdout));
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", code, signal);
    });
    // The module only uses the stdout/stderr/close/error surface.
    return child as unknown as ReturnType<typeof spawn>;
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("formatCommandError", () => {
  it("includes the command, exit code, and trimmed stderr", () => {
    expect(formatCommandError("yt-dlp", 1, "  ERROR: bad url\n")).toBe(
      "yt-dlp exited with code 1: ERROR: bad url",
    );
  });

  it("notes when there is no stderr output", () => {
    expect(formatCommandError("basic-pitch", 2, "")).toBe(
      "basic-pitch exited with code 2: (no stderr output)",
    );
  });

  it("reports the signal when the process was killed instead of exiting", () => {
    expect(formatCommandError("yt-dlp", null, "", "SIGTERM")).toBe(
      "yt-dlp was killed by signal SIGTERM: (no stderr output)",
    );
  });

  it("handles a null code with no signal", () => {
    expect(formatCommandError("yt-dlp", null, "boom")).toBe(
      "yt-dlp was killed: boom",
    );
  });
});

describe("buildYtDlpArgs", () => {
  it("builds an audio-extraction command with an %(ext)s output template", () => {
    expect(
      buildYtDlpArgs("https://youtube.com/watch?v=abc", "/tmp/clip.wav"),
    ).toEqual([
      "--extract-audio",
      "--audio-format",
      "wav",
      "--no-playlist",
      "--output",
      "/tmp/clip.%(ext)s",
      "https://youtube.com/watch?v=abc",
    ]);
  });

  it("throws when the output path does not end in .wav", () => {
    expect(() =>
      buildYtDlpArgs("https://youtube.com/watch?v=abc", "/tmp/clip.mp3"),
    ).toThrow("must end with .wav");
  });
});

describe("basicPitchMidiPath", () => {
  it("appends _basic_pitch.mid to the audio file's stem in the output dir", () => {
    expect(basicPitchMidiPath("/audio/clip.wav", "/out")).toBe(
      "/out/clip_basic_pitch.mid",
    );
  });

  it("strips only the final extension", () => {
    expect(basicPitchMidiPath("/audio/song.take2.wav", "/out")).toBe(
      "/out/song.take2_basic_pitch.mid",
    );
  });
});

describe("runCommand", () => {
  it("resolves with collected stdout and stderr on exit 0", async () => {
    nextSpawn({ stdout: "hello", stderr: "warning" });
    await expect(runCommand("tool", [])).resolves.toEqual({
      stdout: "hello",
      stderr: "warning",
    });
  });

  it("rejects with the command and stderr on a non-zero exit", async () => {
    nextSpawn({ code: 1, stderr: "ERROR: something broke" });
    await expect(runCommand("yt-dlp", ["x"])).rejects.toThrow(
      "yt-dlp exited with code 1: ERROR: something broke",
    );
  });

  it("falls back to stdout detail when stderr is empty on failure", async () => {
    nextSpawn({ code: 2, stdout: "Did not detect a valid keyboard" });
    await expect(runCommand("tool", [])).rejects.toThrow(
      "tool exited with code 2: Did not detect a valid keyboard",
    );
  });

  it("rejects with an install hint when the binary cannot be spawned", async () => {
    spawnMock.mockImplementationOnce(() => {
      const child = fakeChild();
      queueMicrotask(() =>
        child.emit("error", new Error("spawn yt-dlp ENOENT")),
      );
      return child as unknown as ReturnType<typeof spawn>;
    });
    await expect(runCommand("yt-dlp", [])).rejects.toThrow(
      /Failed to run yt-dlp: spawn yt-dlp ENOENT.*Is it installed/,
    );
  });
});

describe("downloadAudio", () => {
  it("spawns yt-dlp with the built extraction args", async () => {
    nextSpawn();
    await downloadAudio("https://youtube.com/watch?v=abc", "/tmp/clip.wav");
    expect(spawnMock).toHaveBeenCalledWith(
      "yt-dlp",
      buildYtDlpArgs("https://youtube.com/watch?v=abc", "/tmp/clip.wav"),
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
  });

  it("propagates yt-dlp failures with stderr detail", async () => {
    nextSpawn({ code: 1, stderr: "ERROR: Video unavailable" });
    await expect(
      downloadAudio("https://youtube.com/watch?v=gone", "/tmp/clip.wav"),
    ).rejects.toThrow("ERROR: Video unavailable");
  });
});

describe("audioToMidi", () => {
  it("runs basic-pitch into the output directory and renames its output", async () => {
    nextSpawn();
    await audioToMidi("/audio/clip.wav", "/out/final.mid");
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("basic-pitch"),
      ["/out", "/audio/clip.wav"],
      expect.anything(),
    );
    expect(renameMock).toHaveBeenCalledWith(
      "/out/clip_basic_pitch.mid",
      "/out/final.mid",
    );
  });

  it("skips the rename when the target already matches basic-pitch's naming", async () => {
    nextSpawn();
    await audioToMidi("/audio/clip.wav", "/out/clip_basic_pitch.mid");
    expect(renameMock).not.toHaveBeenCalled();
  });

  it("does not rename anything when basic-pitch fails", async () => {
    nextSpawn({ code: 1, stderr: "no valid audio" });
    await expect(
      audioToMidi("/audio/clip.wav", "/out/final.mid"),
    ).rejects.toThrow("no valid audio");
    expect(renameMock).not.toHaveBeenCalled();
  });
});

describe("midiToNotation", () => {
  it("returns the python script's stdout as musicxml", async () => {
    nextSpawn({ stdout: "<score-partwise/>" });
    await expect(midiToNotation("/out/final.mid")).resolves.toEqual({
      musicxml: "<score-partwise/>",
    });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("python"),
      [expect.stringContaining("midi_to_musicxml.py"), "/out/final.mid"],
      expect.anything(),
    );
  });

  it("surfaces the script's stderr when conversion fails", async () => {
    nextSpawn({ code: 1, stderr: "music21 could not parse the MIDI file: bad header" });
    await expect(midiToNotation("/out/final.mid")).rejects.toThrow(
      "music21 could not parse the MIDI file: bad header",
    );
  });
});
