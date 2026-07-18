// Unit tests for the image-import branch (ai-import ticket 006).
// node:child_process.spawn and node:fs/promises (writeFile/unlink) are mocked —
// no real binaries, no disk writes — following the audio-pipeline.test.ts
// pattern (sheet-ingest ticket 006) and the url-import.test.ts convention.

import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildExtractionPrompt,
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

  it("embeds every path and a stitching instruction for multiple images", () => {
    const paths = ["/tmp/a-0.jpg", "/tmp/a-1.jpg", "/tmp/a-2.jpg"];
    const prompt = buildImagePrompt(paths);
    for (const path of paths) {
      expect(prompt).toContain(path);
    }
    expect(prompt).toContain("single complete piece");
  });

  it("treats a one-element array the same as a bare string", () => {
    expect(buildImagePrompt(["/tmp/x.jpg"])).toBe(buildImagePrompt("/tmp/x.jpg"));
  });
});

describe("buildExtractionPrompt", () => {
  const paths = ["/tmp/img-0.jpg", "/tmp/img-1.jpg"];

  it("is the bare image instruction when messages are absent (ai-import/006 shape)", () => {
    expect(buildExtractionPrompt(["/tmp/x.jpg"])).toBe(
      buildImagePrompt("/tmp/x.jpg")
    );
  });

  it("prepends only the current turn's text for a single message", () => {
    const prompt = buildExtractionPrompt(["/tmp/x.jpg"], "guitar", [
      { role: "user", content: "These are panels of one song" },
    ]);
    expect(prompt).toBe(
      `These are panels of one song\n\n${buildImagePrompt("/tmp/x.jpg")}`
    );
    expect(prompt).not.toContain("Human:");
  });

  it("threads prior turns as Human:/Assistant: lines, in order, before the current turn", () => {
    const prompt = buildExtractionPrompt(paths, "guitar", [
      { role: "user", content: "first ask" },
      { role: "assistant", content: '{"title":"Song"}' },
      { role: "user", content: "you missed the bridge" },
    ]);

    const humanIdx = prompt.indexOf("Human: first ask");
    const assistantIdx = prompt.indexOf('Assistant: {"title":"Song"}');
    const currentIdx = prompt.indexOf("you missed the bridge");
    const imageIdx = prompt.indexOf(paths[0]);

    expect(humanIdx).toBeGreaterThanOrEqual(0);
    expect(assistantIdx).toBeGreaterThan(humanIdx);
    expect(currentIdx).toBeGreaterThan(assistantIdx);
    expect(imageIdx).toBeGreaterThan(currentIdx);
    // The current turn is not prefixed as history.
    expect(prompt).not.toContain("Human: you missed the bridge");
  });

  it("omits the image instruction entirely when there are no images", () => {
    const prompt = buildExtractionPrompt([], "guitar", [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "change the capo to 3" },
    ]);
    expect(prompt).toBe(
      "Human: hello\n\nAssistant: hi\n\nchange the capo to 3"
    );
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
      "--add-dir",
      expect.any(String),
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

  const images = [
    { mediaType: "image/jpeg", data: Buffer.from("one").toString("base64") },
    { mediaType: "image/jpeg", data: Buffer.from("two").toString("base64") },
    { mediaType: "image/png", data: Buffer.from("three").toString("base64") },
  ];

  /** Paths passed to the mocked writeFile, in call order. */
  function writtenPaths(): string[] {
    return writeFileMock.mock.calls.map((call) => call[0] as string);
  }

  it("writes one distinct temp file per images entry and embeds every path in the prompt", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    nextSpawn({ stdout: "ok" });

    await runImageExtraction({ images });

    const paths = writtenPaths();
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(3);
    expect(paths[2]).toMatch(/\.png$/);

    const prompt = (spawnMock.mock.calls[0][1] as string[])[1];
    for (const path of paths) {
      expect(prompt).toContain(path);
    }
    expect(prompt).toContain("single complete piece");
  });

  it("treats a legacy singular image identically to a one-element images array", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);

    nextSpawn({ stdout: "ok" });
    await runImageExtraction({ image });
    const legacyPrompt = (spawnMock.mock.calls[0][1] as string[])[1];
    const legacyPath = writtenPaths()[0];

    nextSpawn({ stdout: "ok" });
    await runImageExtraction({ images: [image] });
    const arrayPrompt = (spawnMock.mock.calls[1][1] as string[])[1];
    const arrayPath = writtenPaths()[1];

    // Identical shape modulo the per-request uuid in the temp path.
    expect(legacyPrompt.replace(legacyPath, "<path>")).toBe(
      arrayPrompt.replace(arrayPath, "<path>")
    );
    expect(unlinkMock).toHaveBeenCalledWith(legacyPath);
    expect(unlinkMock).toHaveBeenCalledWith(arrayPath);
  });

  it("threads multi-turn history into the -p prompt before the current turn and image paths", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    nextSpawn({ stdout: "ok" });

    await runImageExtraction({
      images: images.slice(0, 2),
      messages: [
        { role: "user", content: "here are two panels" },
        { role: "assistant", content: '{"title":"Song"}' },
        { role: "user", content: "you missed the bridge" },
      ],
    });

    const prompt = (spawnMock.mock.calls[0][1] as string[])[1];
    const historyIdx = prompt.indexOf("Human: here are two panels");
    const currentIdx = prompt.indexOf("you missed the bridge");
    const imageIdx = prompt.indexOf(writtenPaths()[0]);
    expect(historyIdx).toBeGreaterThanOrEqual(0);
    expect(prompt.indexOf('Assistant: {"title":"Song"}')).toBeGreaterThan(
      historyIdx
    );
    expect(currentIdx).toBeGreaterThan(historyIdx);
    expect(imageIdx).toBeGreaterThan(currentIdx);
  });

  it("keeps the ai-import/006 single-turn prompt shape when messages has one entry", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    nextSpawn({ stdout: "ok" });

    await runImageExtraction({
      image,
      messages: [{ role: "user", content: "Transcribe the attached sheet." }],
    });

    const prompt = (spawnMock.mock.calls[0][1] as string[])[1];
    expect(prompt).toBe(
      `Transcribe the attached sheet.\n\n${buildImagePrompt(writtenPaths()[0])}`
    );
    expect(prompt).not.toContain("Human:");
  });

  it("cleans up every temp file on success", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    nextSpawn({ stdout: "ok" });

    const result = await runImageExtraction({ images });

    expect(result.status).toBe(200);
    expect(
      (result.body as { content: { text: string }[] }).content[0].text
    ).toBe("ok");
    expect(unlinkMock).toHaveBeenCalledTimes(3);
    for (const path of writtenPaths()) {
      expect(unlinkMock).toHaveBeenCalledWith(path);
    }
  });

  it("cleans up every temp file on a non-zero exit and on a spawn error", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);

    nextSpawn({ code: 1, stderr: "boom" });
    const failed = await runImageExtraction({ images });
    expect(failed.status).toBe(500);
    expect(unlinkMock).toHaveBeenCalledTimes(3);

    unlinkMock.mockClear();
    nextSpawnError("spawn claude ENOENT");
    const errored = await runImageExtraction({ images });
    expect(errored.status).toBe(500);
    expect(unlinkMock).toHaveBeenCalledTimes(3);
  });

  it("keeps cleaning the remaining files when one unlink rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValue(undefined);
    nextSpawn({ stdout: "ok" });

    const result = await runImageExtraction({ images });

    expect(result.status).toBe(200);
    expect(unlinkMock).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
