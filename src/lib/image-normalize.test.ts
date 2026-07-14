// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	blobToBase64,
	computeDownscaledDimensions,
	isAcceptedImageType,
	JPEG_QUALITY,
	MAX_LONG_EDGE,
	MAX_UPLOAD_BYTES,
	normalizeImageToJpeg,
	validateImageInput,
} from "./image-normalize";

describe("computeDownscaledDimensions", () => {
	it("scales a landscape image over the cap down by width, preserving aspect ratio", () => {
		expect(computeDownscaledDimensions(3200, 1600)).toEqual({
			width: 1600,
			height: 800,
		});
	});

	it("scales a portrait image over the cap down by height", () => {
		expect(computeDownscaledDimensions(1600, 3200)).toEqual({
			width: 800,
			height: 1600,
		});
	});

	it("rounds the scaled short edge to the nearest integer", () => {
		// 3000x2000 -> ratio 1600/3000; height = 2000 * 1600/3000 = 1066.67 -> 1067
		expect(computeDownscaledDimensions(3000, 2000)).toEqual({
			width: 1600,
			height: 1067,
		});
	});

	it("returns an image already under the cap unchanged (never upscales)", () => {
		expect(computeDownscaledDimensions(800, 600)).toEqual({
			width: 800,
			height: 600,
		});
	});

	it("returns a square image exactly at the cap unchanged", () => {
		expect(computeDownscaledDimensions(MAX_LONG_EDGE, MAX_LONG_EDGE)).toEqual({
			width: MAX_LONG_EDGE,
			height: MAX_LONG_EDGE,
		});
	});

	it("honors a custom maxEdge argument", () => {
		expect(computeDownscaledDimensions(200, 100, 100)).toEqual({
			width: 100,
			height: 50,
		});
	});
});

describe("isAcceptedImageType", () => {
	it("returns true for each accepted image type", () => {
		expect(isAcceptedImageType("image/png")).toBe(true);
		expect(isAcceptedImageType("image/jpeg")).toBe(true);
		expect(isAcceptedImageType("image/webp")).toBe(true);
	});

	it("returns false for non-accepted types", () => {
		expect(isAcceptedImageType("application/pdf")).toBe(false);
		expect(isAcceptedImageType("text/plain")).toBe(false);
		expect(isAcceptedImageType("")).toBe(false);
	});
});

describe("validateImageInput", () => {
	it("returns null for an accepted type under the size cap", () => {
		const file = new Blob(["x"], { type: "image/png" });
		expect(validateImageInput(file)).toBeNull();
	});

	it("returns an error naming the accepted formats for a rejected type", () => {
		const file = new Blob(["x"], { type: "application/pdf" });
		const error = validateImageInput(file);
		expect(error).toBeTruthy();
		expect(error).toMatch(/PNG/);
		expect(error).toMatch(/JPEG/);
		expect(error).toMatch(/WebP/);
	});

	it("returns an error naming the size cap for an oversized accepted-type file", () => {
		const file = {
			type: "image/png",
			size: MAX_UPLOAD_BYTES + 1,
		} as Blob;
		const error = validateImageInput(file);
		expect(error).toBeTruthy();
		expect(error).toMatch(/large/i);
		expect(error).toMatch(/25/);
	});

	it("prefers the type-rejection message when both type and size are invalid", () => {
		const file = {
			type: "application/pdf",
			size: MAX_UPLOAD_BYTES + 1,
		} as Blob;
		const error = validateImageInput(file);
		expect(error).toMatch(/PNG/);
	});
});

describe("blobToBase64", () => {
	it("encodes a known blob to base64 with no data: prefix", async () => {
		const blob = new Blob(["hi"], { type: "text/plain" });
		expect(await blobToBase64(blob)).toBe("aGk=");
	});
});

describe("normalizeImageToJpeg", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("sizes the canvas to the downscaled dimensions, draws the bitmap, and encodes JPEG", async () => {
		// A 3200x1600 bitmap downscales to 1600x800.
		const close = vi.fn();
		const bitmap = { width: 3200, height: 1600, close };
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => bitmap),
		);

		const drawImage = vi.fn();
		const outputBlob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });

		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage,
		} as unknown as CanvasRenderingContext2D);
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback) => {
				callback(outputBlob);
			});

		const result = await normalizeImageToJpeg(
			new Blob(["src"], { type: "image/png" }),
		);

		const expected = computeDownscaledDimensions(3200, 1600);
		expect(expected).toEqual({ width: 1600, height: 800 });

		// The canvas the spy was invoked on is `this` for toBlob.
		const canvas = toBlob.mock.instances[0] as HTMLCanvasElement;
		expect(canvas.width).toBe(1600);
		expect(canvas.height).toBe(800);

		expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800);
		expect(toBlob).toHaveBeenCalledWith(
			expect.any(Function),
			"image/jpeg",
			JPEG_QUALITY,
		);
		expect(result).toBe(outputBlob);
		expect(result.type).toBe("image/jpeg");
		expect(close).toHaveBeenCalled();
	});
});
