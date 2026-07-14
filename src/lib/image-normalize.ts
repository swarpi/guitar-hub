/**
 * Client-side image normalization for ADR-0009 (in-app image import).
 *
 * Every image handed to Image mode — from the file picker, drag-and-drop, or
 * clipboard paste — is drawn onto a <canvas> and re-encoded as JPEG before it
 * leaves the browser. One step solves three problems: downscaling large photos,
 * normalizing odd formats (HEIC, WebP, PNG) to one format `claude -p` reliably
 * ingests, and rejecting non-image or oversized inputs early with a clear
 * message. No new dependency — <canvas>, toBlob, createImageBitmap, and
 * FileReader are all built into the browser.
 *
 * This module has no network calls; ai-import/008 wires it into ImportForm.
 */

/** Longest edge of a normalized image, in pixels. Larger images are downscaled. */
export const MAX_LONG_EDGE = 1600;

/** JPEG quality passed to `canvas.toBlob`. */
export const JPEG_QUALITY = 0.8;

/** Reject uploads larger than this before doing any decode work. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** MIME types the browser reliably decodes and we accept for import. */
export const ACCEPTED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

/**
 * Scales dimensions so the longer edge is at most `maxEdge`, preserving aspect
 * ratio. Never upscales: images already within the cap are returned unchanged.
 * Pure — no browser APIs.
 */
export function computeDownscaledDimensions(
	width: number,
	height: number,
	maxEdge: number = MAX_LONG_EDGE,
): { width: number; height: number } {
	const longEdge = Math.max(width, height);
	if (longEdge <= maxEdge) {
		return { width, height };
	}

	const ratio = maxEdge / longEdge;
	return {
		width: Math.round(width * ratio),
		height: Math.round(height * ratio),
	};
}

/** True when `mimeType` is one of {@link ACCEPTED_IMAGE_TYPES}. Pure. */
export function isAcceptedImageType(mimeType: string): boolean {
	return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Validates a candidate upload against the accepted formats and size cap.
 * Returns `null` when the file is acceptable, otherwise a user-facing error
 * string. Type is checked before size so a rejected-type message wins when both
 * are invalid. Pure — reads only `file.type` and `file.size`.
 */
export function validateImageInput(file: Blob): string | null {
	if (!isAcceptedImageType(file.type)) {
		return "Unsupported image format. Please use a PNG, JPEG, or WebP image.";
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
		return `Image is too large. Please use a file under ${maxMb} MB.`;
	}
	return null;
}

/**
 * Base64-encodes a blob's bytes with no `data:` URL prefix. Uses FileReader,
 * which yields a `data:<type>;base64,<payload>` URL, then strips the prefix.
 */
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error("read failed"));
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new Error("expected a data URL string"));
				return;
			}
			const comma = result.indexOf(",");
			resolve(comma === -1 ? result : result.slice(comma + 1));
		};
		reader.readAsDataURL(blob);
	});
}

/**
 * Decodes `source`, downscales it so its longer edge is at most
 * {@link MAX_LONG_EDGE}, draws it onto an in-memory canvas, and re-encodes as
 * JPEG at {@link JPEG_QUALITY}. Resolves with an `image/jpeg` blob.
 *
 * A source the browser cannot decode surfaces as a rejected `createImageBitmap`
 * promise; ai-import/008 catches that and maps it to a user-facing error.
 */
export async function normalizeImageToJpeg(source: Blob): Promise<Blob> {
	const bitmap = await createImageBitmap(source);
	try {
		const { width, height } = computeDownscaledDimensions(
			bitmap.width,
			bitmap.height,
		);

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("could not get a 2D canvas context");
		}
		ctx.drawImage(bitmap, 0, 0, width, height);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error("canvas.toBlob produced no blob"));
					}
				},
				"image/jpeg",
				JPEG_QUALITY,
			);
		});
	} finally {
		bitmap.close();
	}
}
