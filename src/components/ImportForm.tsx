"use client";

import { useEffect, useRef, useState } from "react";

import {
	blobToBase64,
	MAX_UPLOAD_BYTES,
	normalizeImageToJpeg,
	validateImageInput,
} from "@/lib/image-normalize";
import type { SongFormInitialValues } from "./SongForm";

const PROXY_URL = "http://localhost:3456/v1/messages";
const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a guitar tab parser. The user will paste raw text that contains a guitar
tab, chord sheet, or chord chart. Extract the following fields:

- title: The song title
- artist: The artist or performer name
- capo: The capo fret number (integer 0-12), or null if no capo is mentioned
- tabContent: The complete guitar tablature or chord sheet content, preserving
  exact formatting, line breaks, and spacing. Remove any ads, navigation text,
  or website UI elements that are not part of the tab.
- notes: Any relevant metadata like tuning, tempo, difficulty, or source
  attribution. Null if none found.

Respond with ONLY a JSON object containing these five fields. No markdown fences,
no explanation, no commentary.

If you cannot identify the song title or artist from the text, use your best guess
or set the field to "Unknown".`;

// Distinct from SYSTEM_PROMPT: per ADR-0009 §5 the instrument-specific *target
// notation* (tab text vs. ABC) is chosen proxy-side in the `-p` prompt, so this
// system prompt only carries the shared field-discipline instructions and says
// nothing about guitar-vs-piano output format.
const IMAGE_SYSTEM_PROMPT = `You are a sheet-music parser. The user has attached an image of sheet music, a
guitar tab, or a chord chart. Read the image and extract the following fields:

- title: The song title
- artist: The artist or composer name
- capo: The capo fret number (integer 0-12), or null if none is shown
- tabContent: The complete transcription of the music, preserving structure,
  line breaks, and spacing.
- notes: Any relevant metadata like tuning, tempo, difficulty, or source
  attribution. Null if none found.

Be resilient to skew, uneven lighting, and partially legible regions: transcribe
what you can read and make a best effort on the rest.

Respond with ONLY a JSON object containing these five fields. No markdown fences,
no explanation, no commentary.

If you cannot identify the song title or artist, use your best guess or set the
field to "Unknown".`;

const IMAGE_USER_MESSAGE = "Transcribe the attached sheet.";

// The proxy forwards image.data as base64. MAX_UPLOAD_BYTES (25 MB) caps the raw
// upload; base64 inflates the byte count by ~4/3, so a fully-inflated upload is
// ~33 MB of text. Normalization (downscale to 1600px, JPEG q0.8) normally lands
// well under 1 MB, but we still guard the wire size: if the first pass's base64
// exceeds this cap we re-normalize once, then give up with a size error rather
// than POST an oversized body.
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3);

const ERROR_UNREACHABLE =
	"AI service is not running. Start it with `pnpm dev:ai`.";
const ERROR_INVALID_JSON =
	"Could not parse the AI response. Try again or switch to manual entry.";
const ERROR_EMPTY_TAB =
	"No tab content was found in the input. Try pasting a different format.";
const ERROR_HTTP = "The AI service returned an error. Try again.";
const ERROR_URL_FETCH =
	"Could not fetch the URL. Check the link and try again.";
const ERROR_IMAGE_DECODE =
	"Claude cannot read that image. Try a clearer photo or screenshot, or use manual entry.";
const ERROR_IMAGE_TOO_LARGE =
	"That image is too large to send even after resizing. Try a smaller crop, or use manual entry.";

const PASTE_EMPTY_HINT = "Paste an image, or use the file picker.";

interface ProxyResponse {
	readonly content: ReadonlyArray<{
		readonly type: string;
		readonly text: string;
	}>;
	readonly model: string;
	readonly role: string;
}

interface ExtractedSong {
	readonly title?: string;
	readonly artist?: string;
	readonly capo?: number | null;
	readonly tabContent?: string;
	readonly notes?: string | null;
}

interface ExtractionRequestBody {
	readonly messages: ReadonlyArray<{ role: string; content: string }>;
	readonly system: string;
	readonly model: string;
	readonly instrument?: "guitar" | "piano";
	readonly image?: { readonly mediaType: string; readonly data: string };
}

type InputMethod = "paste" | "url" | "image";

interface ImportFormProps {
	readonly onExtracted: (fields: SongFormInitialValues) => void;
	readonly onUseManual: () => void;
	readonly instrument?: "guitar" | "piano";
}

const INPUT_CLASS =
	"w-full rounded-lg border border-line bg-paper px-4 py-3 font-serif text-[15px] text-ink placeholder:text-ink-soft/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50";

const LABEL_CLASS =
	"mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-ink-soft";

const SECONDARY_BUTTON_CLASS =
	"inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]";

const METHOD_TOGGLE_BASE =
	"rounded-lg px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest transition-colors";
const METHOD_TOGGLE_ACTIVE =
	"border border-black/[.15] bg-leather text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)]";
const METHOD_TOGGLE_INACTIVE =
	"border border-line bg-transparent text-ink-soft hover:border-ink-soft/30 hover:bg-accent/[.04]";

const DROPZONE_BASE =
	"flex min-h-[210px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors disabled:opacity-50";
const DROPZONE_IDLE = "border-line bg-paper hover:border-ink-soft/40";
const DROPZONE_ACTIVE = "border-accent bg-accent/[.06]";

export function ImportForm({
	onExtracted,
	onUseManual,
	instrument,
}: ImportFormProps): React.ReactElement {
	const [method, setMethod] = useState<InputMethod>("paste");
	const [text, setText] = useState("");
	const [url, setUrl] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [canRetry, setCanRetry] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [pasteHint, setPasteHint] = useState<string | null>(null);

	const resolvedInstrument: "guitar" | "piano" =
		instrument === "piano" ? "piano" : "guitar";

	const activeValue = method === "paste" ? text : url;
	const retryRef = useRef<() => void>(() => {});
	const fileInputRef = useRef<HTMLInputElement>(null);

	function switchMethod(next: InputMethod): void {
		setMethod(next);
		setError(null);
		setCanRetry(false);
		setPasteHint(null);
	}

	async function sendExtraction(body: ExtractionRequestBody): Promise<void> {
		setError(null);
		setIsLoading(true);

		let response: Response;
		try {
			response = await fetch(PROXY_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		} catch {
			setError(ERROR_UNREACHABLE);
			setIsLoading(false);
			return;
		}

		if (response.status === 502) {
			setError(ERROR_URL_FETCH);
			setIsLoading(false);
			return;
		}

		if (!response.ok) {
			setError(ERROR_HTTP);
			setIsLoading(false);
			return;
		}

		let parsed: ExtractedSong;
		try {
			const data = (await response.json()) as ProxyResponse;
			let raw = data.content[0].text;
			const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
			if (fenced) raw = fenced[1];
			parsed = JSON.parse(raw) as ExtractedSong;
		} catch {
			setError(ERROR_INVALID_JSON);
			setIsLoading(false);
			return;
		}

		if (typeof parsed.tabContent !== "string" || parsed.tabContent === "") {
			setError(ERROR_EMPTY_TAB);
			setIsLoading(false);
			return;
		}

		setIsLoading(false);
		onExtracted({
			title: parsed.title ?? "Unknown",
			artist: parsed.artist ?? "Unknown",
			capo: parsed.capo ?? null,
			content: parsed.tabContent,
			notes: parsed.notes ?? null,
		});
	}

	function handleExtract(): Promise<void> {
		const content = method === "url" ? `URL: ${url.trim()}` : text;
		setCanRetry(true);
		retryRef.current = handleExtract;
		return sendExtraction({
			messages: [{ role: "user", content }],
			system: SYSTEM_PROMPT,
			model: MODEL,
		});
	}

	async function handleImageSelected(source: File | Blob): Promise<void> {
		setPasteHint(null);

		const validationError = validateImageInput(source);
		if (validationError) {
			// Nothing was sent, so there is nothing to retry — offer only manual
			// entry and leave the dropzone available for a different file.
			setError(validationError);
			setCanRetry(false);
			return;
		}

		setError(null);
		setCanRetry(false);
		setIsLoading(true);

		let base64: string;
		try {
			let jpeg = await normalizeImageToJpeg(source);
			base64 = await blobToBase64(jpeg);
			if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
				// One-shot retry: re-normalize once before giving up.
				jpeg = await normalizeImageToJpeg(source);
				base64 = await blobToBase64(jpeg);
			}
		} catch {
			setError(ERROR_IMAGE_DECODE);
			setIsLoading(false);
			return;
		}

		if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
			setError(ERROR_IMAGE_TOO_LARGE);
			setIsLoading(false);
			return;
		}

		const body: ExtractionRequestBody = {
			messages: [{ role: "user", content: IMAGE_USER_MESSAGE }],
			system: IMAGE_SYSTEM_PROMPT,
			model: MODEL,
			instrument: resolvedInstrument,
			image: { mediaType: "image/jpeg", data: base64 },
		};
		// Retry re-sends the already-normalized image, not a fresh file pick.
		setCanRetry(true);
		retryRef.current = () => {
			void sendExtraction(body);
		};
		await sendExtraction(body);
	}

	// Clipboard paste is only wired while Image mode is active, so a Cmd+V into
	// the Paste Text textarea is never intercepted by this listener.
	const handleImageSelectedRef = useRef(handleImageSelected);
	handleImageSelectedRef.current = handleImageSelected;

	useEffect(() => {
		if (method !== "image") return;

		function onPaste(event: ClipboardEvent): void {
			const items = event.clipboardData?.items;
			if (!items) return;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) {
						void handleImageSelectedRef.current(file);
						return;
					}
				}
			}
			// User pasted something that is not an image — a non-blocking hint,
			// not an error state.
			setPasteHint(PASTE_EMPTY_HINT);
		}

		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, [method]);

	function handleFileInputChange(
		event: React.ChangeEvent<HTMLInputElement>,
	): void {
		const file = event.target.files?.[0];
		if (file) void handleImageSelected(file);
	}

	function handleDrop(event: React.DragEvent<HTMLButtonElement>): void {
		event.preventDefault();
		setIsDragging(false);
		const file = event.dataTransfer.files[0];
		if (file) void handleImageSelected(file);
	}

	return (
		<div className="space-y-5">
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => switchMethod("paste")}
					className={`${METHOD_TOGGLE_BASE} ${method === "paste" ? METHOD_TOGGLE_ACTIVE : METHOD_TOGGLE_INACTIVE}`}
				>
					Paste Text
				</button>
				<button
					type="button"
					onClick={() => switchMethod("url")}
					className={`${METHOD_TOGGLE_BASE} ${method === "url" ? METHOD_TOGGLE_ACTIVE : METHOD_TOGGLE_INACTIVE}`}
				>
					URL
				</button>
				<button
					type="button"
					onClick={() => switchMethod("image")}
					className={`${METHOD_TOGGLE_BASE} ${method === "image" ? METHOD_TOGGLE_ACTIVE : METHOD_TOGGLE_INACTIVE}`}
				>
					Image
				</button>
			</div>

			{method === "paste" && (
				<div>
					<label htmlFor="import-input" className={LABEL_CLASS}>
						Paste your tab text here
					</label>
					<textarea
						id="import-input"
						value={text}
						onChange={(e) => setText(e.target.value)}
						disabled={isLoading}
						placeholder="Paste a tab, chord sheet, or chord chart..."
						className={`${INPUT_CLASS} min-h-[210px] overflow-x-auto whitespace-pre font-mono text-[13px] leading-[1.7]`}
					/>
				</div>
			)}

			{method === "url" && (
				<div>
					<label htmlFor="import-url-input" className={LABEL_CLASS}>
						Paste a link to a tab or chord page
					</label>
					<input
						id="import-url-input"
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						disabled={isLoading}
						placeholder="https://..."
						className={INPUT_CLASS}
					/>
				</div>
			)}

			{method === "image" && (
				<div>
					<span className={LABEL_CLASS}>Add an image of a tab or sheet</span>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						onDragOver={(e) => {
							e.preventDefault();
							setIsDragging(true);
						}}
						onDragLeave={() => setIsDragging(false)}
						onDrop={handleDrop}
						disabled={isLoading}
						className={`${DROPZONE_BASE} ${isDragging ? DROPZONE_ACTIVE : DROPZONE_IDLE}`}
					>
						<span className="font-serif text-[15px] text-ink">
							Drop an image here, or click to choose a file
						</span>
						<span className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
							You can also paste (Cmd+V) an image
						</span>
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						aria-label="Choose an image file"
						className="sr-only"
						onChange={handleFileInputChange}
					/>
					{pasteHint && (
						<p className="mt-3 font-serif text-[14px] text-ink-soft">
							{pasteHint}
						</p>
					)}
				</div>
			)}

			{isLoading && (
				<p
					role="status"
					className="animate-pulse font-serif text-[14px] text-ink-soft"
				>
					Extracting song details…
				</p>
			)}

			{error && (
				<div className="space-y-3">
					<p className="font-serif text-[14px] text-delete">{error}</p>
					<div className="flex items-center gap-3">
						{canRetry && (
							<button
								type="button"
								onClick={() => retryRef.current()}
								className={SECONDARY_BUTTON_CLASS}
							>
								Try again
							</button>
						)}
						<button
							type="button"
							onClick={onUseManual}
							className={SECONDARY_BUTTON_CLASS}
						>
							Use manual entry
						</button>
					</div>
				</div>
			)}

			{method !== "image" && (
				<button
					type="button"
					onClick={handleExtract}
					disabled={isLoading || activeValue.trim() === ""}
					className="inline-flex rounded-lg border border-black/[.15] bg-leather px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110 disabled:opacity-50"
				>
					{isLoading ? "Extracting..." : "Extract"}
				</button>
			)}
		</div>
	);
}
