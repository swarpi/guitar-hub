// Unit tests for the falling-notes pipeline shell-out plumbing (sheet-ingest
// ticket 007). spawn and mkdir are mocked — no network, no real binaries —
// matching the ticket 006 pattern in audio-pipeline.test.ts.

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FRAME_PATTERN,
  FRAME_RATE,
  buildExtractFramesArgs,
  buildStitchArgs,
  buildToolArgs,
  extractFrames,
  framesToMidi,
} from "./falling-notes-pipeline";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), rename: vi.fn() }));

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

const spawnMock = vi.mocked(spawn);
const mkdirMock = vi.mocked(mkdir);

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

function nextSpawn({ code = 0, stderr = "" } = {}): void {
  spawnMock.mockImplementationOnce(() => {
    const child = fakeChild();
    queueMicrotask(() => {
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", code, null);
    });
    return child as unknown as ReturnType<typeof spawn>;
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildExtractFramesArgs", () => {
  it("samples at FRAME_RATE to the frame pattern in the output dir", () => {
    expect(buildExtractFramesArgs("/videos/tutorial.mp4", "/work/frames")).toEqual([
      "-i",
      "/videos/tutorial.mp4",
      "-vf",
      `fps=${FRAME_RATE}`,
      "-q:v",
      "2",
      `/work/frames/${FRAME_PATTERN}`,
    ]);
  });
});

describe("buildStitchArgs", () => {
  it("re-encodes the frame sequence at FRAME_RATE into an mp4", () => {
    expect(buildStitchArgs("/work/frames", "/work/frames/stitched.mp4")).toEqual([
      "-y",
      "-framerate",
      String(FRAME_RATE),
      "-i",
      `/work/frames/${FRAME_PATTERN}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "/work/frames/stitched.mp4",
    ]);
  });
});

describe("buildToolArgs", () => {
  it("invokes youtube_midify.py with the video and -o output", () => {
    const args = buildToolArgs("/work/frames/stitched.mp4", "/work/out.mid");
    expect(args[0]).toMatch(/MIDI-Converter\/youtube_midify\.py$/);
    expect(args.slice(1)).toEqual([
      "/work/frames/stitched.mp4",
      "-o",
      "/work/out.mid",
    ]);
  });

  it("passes a .mp4 positional argument so the tool takes its local-file path", () => {
    expect(buildToolArgs("/work/frames/stitched.mp4", "/o.mid")[1]).toMatch(
      /\.mp4$/,
    );
  });

  it("appends detection-tuning flags only when options are set", () => {
    expect(
      buildToolArgs("/v.mp4", "/o.mid", {
        startSeconds: 3,
        keyboardHeight: 0.6,
        activationThreshold: 40,
      }).slice(4),
    ).toEqual(["-s", "3", "-k", "0.6", "-t", "40"]);
    expect(buildToolArgs("/v.mp4", "/o.mid", {}).slice(4)).toEqual([]);
  });
});

describe("extractFrames", () => {
  it("creates the output dir and spawns ffmpeg with the extraction args", async () => {
    nextSpawn();
    await extractFrames("/videos/tutorial.mp4", "/work/frames");
    expect(mkdirMock).toHaveBeenCalledWith("/work/frames", { recursive: true });
    expect(spawnMock).toHaveBeenCalledWith(
      "ffmpeg",
      buildExtractFramesArgs("/videos/tutorial.mp4", "/work/frames"),
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
  });

  it("propagates ffmpeg failures with stderr detail", async () => {
    nextSpawn({ code: 1, stderr: "No such file or directory" });
    await expect(
      extractFrames("/videos/missing.mp4", "/work/frames"),
    ).rejects.toThrow("ffmpeg exited with code 1: No such file or directory");
  });
});

describe("framesToMidi", () => {
  it("stitches frames then runs the tool with cwd set to the frame dir", async () => {
    nextSpawn();
    nextSpawn();
    await framesToMidi("/work/frames", "/work/out.mid");

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "ffmpeg",
      buildStitchArgs("/work/frames", "/work/frames/stitched.mp4"),
      expect.anything(),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("python"),
      buildToolArgs("/work/frames/stitched.mp4", "/work/out.mid"),
      expect.objectContaining({ cwd: "/work/frames" }),
    );
  });

  it("stops before the tool when stitching fails", async () => {
    nextSpawn({ code: 1, stderr: "could not find codec" });
    await expect(framesToMidi("/work/frames", "/work/out.mid")).rejects.toThrow(
      "could not find codec",
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("propagates detection failures from the tool", async () => {
    nextSpawn();
    nextSpawn({
      code: 2,
      stderr: "Did not detect a valid keyboard at the specified start",
    });
    await expect(framesToMidi("/work/frames", "/work/out.mid")).rejects.toThrow(
      /Did not detect a valid keyboard/,
    );
  });
});
