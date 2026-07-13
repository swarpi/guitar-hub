// Unit tests for the image-import branch (ai-import ticket 006).
// node:child_process.spawn and node:fs/promises (writeFile/unlink) are mocked —
// no real binaries, no disk writes — following the audio-pipeline.test.ts
// pattern (sheet-ingest ticket 006) and the url-import.test.ts convention.

import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildImagePrompt,
  cleanupTempImageFile,
  mediaTypeToExtension,
  runImageExtraction,
  writeTempImageFile,
} from "./image-import";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ writeFile: vi.fn(), unlink: vi.fn() }));

import { spawn } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";

const spawnMock = vi.mocked(spawn);
const writeFileMock = vi.mocked(writeFile);
const unlinkMock = vi.mocked(unlink);

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
function nextSpawn({ code = 0, stdout = "", stderr = "" } = {}): void {
  spawnMock.mockImplementationOnce(() => {
    const child = fakeChild();
    queueMicrotask(() => {
      if (stdout) child.stdout.emit("data", Buffer.from(stdout));
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", code);
    });
    return child as unknown as ReturnType<typeof spawn>;
  });
}

/** Queue a spawn that fails to start by emitting an "error" event. */
function nextSpawnError(message: string): void {
  spawnMock.mockImplementationOnce(() => {
    const child = fakeChild();
    queueMicrotask(() => child.emit("error", new Error(message)));
    return child as unknown as ReturnType<typeof spawn>;
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("mediaTypeToExtension", () => {
  it("maps the known image media types", () => {
    expect(mediaTypeToExtension("image/jpeg")).toBe("jpg");
    expect(mediaTypeToExtension("image/png")).toBe("png");
    expect(mediaTypeToExtension("image/webp")).toBe("webp");
  });

  it("falls back to jpg for unknown types", () => {
    expect(mediaTypeToExtension("image/gif")).toBe("jpg");
    expect(mediaTypeToExtension("")).toBe("jpg");
  });
});

describe("buildImagePrompt", () => {
  it("mentions tab/chord and not ABC for guitar (default and explicit)", () => {
    const def = buildImagePrompt("/tmp/x.jpg");
    const explicit = buildImagePrompt("/tmp/x.jpg", "guitar");
    for (const prompt of [def, explicit]) {
      expect(prompt.toLowerCase()).toMatch(/tab|chord/);
      expect(prompt).not.toContain("ABC");
    }
  });

  it("mentions ABC for piano", () => {
    expect(buildImagePrompt("/tmp/x.jpg", "piano")).toContain("ABC");
  });

  it("always includes the image path verbatim", () => {
    const path = "/var/folders/tmp/guitarhub-import-abc.png";
    expect(buildImagePrompt(path)).toContain(path);
    expect(buildImagePrompt(path, "piano")).toContain(path);
  });
});

describe("writeTempImageFile", () => {
  it("writes the decoded buffer to a uniquely named temp file and returns its path", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    const data = Buffer.from("hello image").toString("base64");

    const result = await writeTempImageFile(data, "image/png");

    expect(result).toMatch(/guitarhub-import-.+\.png$/);
    expect(result.startsWith(tmpdir())).toBe(true);

    const [writtenPath, writtenBuffer] = writeFileMock.mock.calls[0];
    expect(writtenPath).toBe(result);
    expect(Buffer.isBuffer(writtenBuffer)).toBe(true);
    expect((writtenBuffer as Buffer).equals(Buffer.from("hello image"))).toBe(
      true
    );
  });

  it("uses the extension derived from the media type", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    const result = await writeTempImageFile("Zm9v", "image/jpeg");
    expect(result).toMatch(/guitarhub-import-.+\.jpg$/);
  });
});

describe("cleanupTempImageFile", () => {
  it("unlinks the given path", async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    await cleanupTempImageFile("/tmp/guitarhub-import-x.jpg");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/guitarhub-import-x.jpg");
  });

  it("resolves without throwing and warns when unlink rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    unlinkMock.mockRejectedValueOnce(new Error("ENOENT"));

    await expect(
      cleanupTempImageFile("/tmp/gone.jpg")
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("runImageExtraction", () => {
  const image = { mediaType: "image/jpeg", data: Buffer.from("img").toString("base64") };

  it("returns a 200 envelope with trimmed stdout and cleans up the temp file", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    unlinkMock.mockResolvedValueOnce(undefined);
    nextSpawn({ stdout: "  {\"title\":\"Song\"}  \n" });

    const result = await runImageExtraction({ image, model: "claude-sonnet-4-5" });

    expect(result.status).toBe(200);
    const body = result.body as {
      content: { type: string; text: string }[];
      model: string;
      role: string;
    };
    expect(body.content[0].text).toBe('{"title":"Song"}');
    expect(body.role).toBe("assistant");

    const writtenPath = writeFileMock.mock.calls[0][0];
    expect(unlinkMock).toHaveBeenCalledWith(writtenPath);
  });

  it("returns a 500 envelope with trimmed stderr on a non-zero exit and still cleans up", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    unlinkMock.mockResolvedValueOnce(undefined);
    nextSpawn({ code: 1, stderr: "  claude failed  " });

    const result = await runImageExtraction({ image });

    expect(result.status).toBe(500);
    expect((result.body as { error: { message: string } }).error.message).toBe(
      "claude failed"
    );
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it("returns a 500 envelope with the error message on a spawn error and still cleans up", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    unlinkMock.mockResolvedValueOnce(undefined);
    nextSpawnError("spawn claude ENOENT");

    const result = await runImageExtraction({ image });

    expect(result.status).toBe(500);
    expect((result.body as { error: { message: string } }).error.message).toBe(
      "spawn claude ENOENT"
    );
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it("passes piano ABC wording through to the spawn -p arg, guitar by default", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);

    nextSpawn();
    await runImageExtraction({ image, instrument: "piano" });
    const pianoArgs = spawnMock.mock.calls[0][1] as string[];
    expect(pianoArgs[1]).toContain("ABC");

    nextSpawn();
    await runImageExtraction({ image });
    const guitarArgs = spawnMock.mock.calls[1][1] as string[];
    expect(guitarArgs[1].toLowerCase()).toMatch(/tab|chord/);
    expect(guitarArgs[1]).not.toContain("ABC");
  });

  it("defaults the model and omits --system-prompt when neither is supplied", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    unlinkMock.mockResolvedValueOnce(undefined);
    nextSpawn({ stdout: "ok" });

    const result = await runImageExtraction({ image });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual([
      "-p",
      expect.any(String),
      "--output-format",
      "text",
      "--model",
      "claude-sonnet-4-5",
    ]);
    expect(args).not.toContain("--system-prompt");
    expect((result.body as { model: string }).model).toBe("claude-sonnet-4-5");
  });

  it("forwards --system-prompt and a custom model when supplied", async () => {
    writeFileMock.mockResolvedValueOnce(undefined);
    unlinkMock.mockResolvedValueOnce(undefined);
    nextSpawn({ stdout: "ok" });

    await runImageExtraction({
      image,
      system: "field discipline",
      model: "claude-opus-4-8",
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain("--system-prompt");
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("field discipline");
    expect(args[args.indexOf("--model") + 1]).toBe("claude-opus-4-8");
  });
});
