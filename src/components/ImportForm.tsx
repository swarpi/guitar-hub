"use client";

import { useEffect, useRef, useState } from "react";

import {
	blobToBase64,
	MAX_UPLOAD_BYTES,
	normalizeImageToJpeg,
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

// Distinct from SYSTEM_PROMPT: per ADR-0009 §5 / ADR-0010 §5 the instrument-specific
// *target notation* (tab text vs. ABC) is chosen proxy-side in the `-p` prompt, so this
// system prompt only carries the shared field-discipline instructions and says nothing
// about guitar-vs-piano output format. Selected fresh per turn (ADR-0010 §5): any turn
// carrying one or more images uses this prompt; a text-only turn uses SYSTEM_PROMPT.
const IMAGE_SYSTEM_PROMPT = `You are a sheet-music parser. The user has attached one or more images of sheet
music, guitar tabs, or chord charts — possibly multiple panels of the same piece.
Read every attached image and extract the following fields, stitching multiple
panels into one complete transcription:

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

// ADR-0010 §1: when the user attaches images but types no text, this stands in as
// the turn's user message — preserving the one-click convenience of the old Image mode.
const DEFAULT_IMAGE_MESSAGE = "Transcribe the attached sheet(s).";

// ADR-0010 §1/§7: soft cap of 10 images per message.
const MAX_IMAGES = 10;
const ERROR_TOO_MANY_IMAGES = "Maximum 10 images per message.";

// The proxy forwards each image's base64 payload as text. MAX_UPLOAD_BYTES (25 MB)
// caps a raw upload; base64 inflates the byte count by ~4/3. Normalization (downscale
// to 1600px, JPEG q0.8) normally lands well under 1 MB, but we still guard the wire
// size per image: if the first pass's base64 exceeds this cap we re-normalize once,
// then give up on that one image rather than POST an oversized body (ai-import/008,
// applied per image here rather than to a single pending image).
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3);

// Error strings are preserved verbatim from the pre-chat implementation so their
// user-facing wording does not regress (ADR-0010 §7). ERROR_INVALID_JSON is only
// used when the proxy's HTTP envelope itself is not JSON — a response whose *text*
// is not extraction JSON is a normal conversational reply, rendered as plain chat.
const ERROR_UNREACHABLE =
	"AI service is not running. Start it with `pnpm dev:ai`.";
const ERROR_INVALID_JSON =
	"Could not parse the AI response. Try again or switch to manual entry.";
const ERROR_HTTP = "The AI service returned an error. Try again.";

// Shown in place of a result card when the AI returns valid JSON with no usable
// tabContent (ADR-0010 §7). Distinct from an error: it is the AI's turn in the
// thread, just not an actionable one.
const NO_TAB_CONTENT_NOTE = "No tab content found.";

// The auto-expanding composer grows with its content up to roughly four lines,
// then scrolls internally rather than pushing the thread off-screen.
const MAX_TEXTAREA_HEIGHT_PX = 140;

// Names a specific attachment in composer-area errors (ADR-0010 §7: flag the
// problematic image rather than failing the batch silently). Pasted blobs often
// have no filename, so fall back to a generic phrase.
function imageLabel(file: File): string {
	return file.name && file.name.trim() !== ""
		? `"${file.name}"`
		: "the attached image";
}

function decodeErrorFor(file: File): string {
	return `Claude cannot read ${imageLabel(file)}. Remove it and try again, or use manual entry.`;
}

function tooLargeErrorFor(file: File): string {
	return `${imageLabel(file)} is too large to send even after resizing. Remove it or use a smaller crop.`;
}

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

// A base64-encoded, normalized JPEG ready for the proxy's `images` array (ADR-0010 §3).
interface NormalizedImage {
	readonly mediaType: string;
	readonly data: string;
}

// ADR-0010 §6 models staged attachments as `File[]`. We wrap each File with a
// stable id (for React keys and independent removal) and its object-URL preview
// (created at attach time, revoked on removal / send / unmount) — the content is
// still exactly the staged files, one normalized on send per §1.
interface AttachedImage {
	readonly id: string;
	readonly file: File;
	readonly url: string;
}

// ADR-0010 §6. `imageCount` is populated for image-bearing user turns; text-only
// turns omit it. `isTabContentEmpty` is an internal render discriminator: an
// assistant message with neither `extractedFields` nor `isTabContentEmpty` is plain
// conversational text, whereas `isTabContentEmpty` marks a parsed-but-empty response.
interface ChatMessage {
	readonly id: string;
	readonly role: "user" | "assistant";
	readonly text: string;
	readonly imageCount?: number;
	readonly extractedFields?: SongFormInitialValues;
	readonly isTabContentEmpty?: boolean;
}

interface ExtractionRequestBody {
	readonly messages: ReadonlyArray<{ role: string; content: string }>;
	readonly system: string;
	readonly model: string;
	readonly instrument?: "guitar" | "piano";
	// Only populated for image-bearing turns (ADR-0010 §3). This client never sends
	// the legacy singular `image` field.
	readonly images?: ReadonlyArray<NormalizedImage>;
}

// Captured so a retry re-sends the last turn identically (same history, images, and
// per-turn system-prompt selection) without re-normalizing or re-typing.
interface RetryState {
	readonly history: ChatMessage[];
	readonly images?: NormalizedImage[];
	readonly usedImages: boolean;
}

interface ImportFormProps {
	readonly onExtracted: (fields: SongFormInitialValues) => void;
	readonly onUseManual: () => void;
	readonly instrument?: "guitar" | "piano";
}

const LABEL_CLASS =
	"font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-ink-soft";

const PRIMARY_BUTTON_CLASS =
	"inline-flex items-center rounded-lg border border-black/[.15] bg-leather px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110 disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
	"inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]";

const ATTACH_BUTTON_CLASS =
	"inline-flex h-[48px] items-center rounded-lg border border-line bg-transparent px-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04] disabled:opacity-50";

// Reuse the fence-stripping parse tail carried over from the pre-chat form: the
// AI is asked for bare JSON but occasionally wraps it in a ```json fence.
function parseExtraction(raw: string): ExtractedSong | null {
	try {
		let text = raw;
		const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		if (fenced) text = fenced[1];
		return JSON.parse(text) as ExtractedSong;
	} catch {
		return null;
	}
}

function toExtractedFields(parsed: ExtractedSong): SongFormInitialValues {
	return {
		title: parsed.title ?? "Unknown",
		artist: parsed.artist ?? "Unknown",
		capo: parsed.capo ?? null,
		content: parsed.tabContent ?? "",
		notes: parsed.notes ?? null,
	};
}

function buildAssistantMessage(raw: string): ChatMessage {
	const base = {
		id: crypto.randomUUID(),
		role: "assistant" as const,
		text: raw,
	};
	const parsed = parseExtraction(raw);
	if (parsed === null) {
		// Not JSON at all — a conversational reply, rendered as plain chat text.
		return base;
	}
	if (typeof parsed.tabContent === "string" && parsed.tabContent !== "") {
		return { ...base, extractedFields: toExtractedFields(parsed) };
	}
	// Valid JSON but no usable tab content.
	return { ...base, isTabContentEmpty: true };
}

// Normalizes one staged file to a base64 JPEG, reusing ai-import/008's one-shot
// size-retry guard independently per image (normalize → check base64 length → one
// re-normalize retry if over → give up on this image if still over). Returns the
// wire object on success or a user-facing, image-specific error string.
async function normalizeOne(
	file: File,
): Promise<{ image: NormalizedImage } | { error: string }> {
	let base64: string;
	try {
		let jpeg = await normalizeImageToJpeg(file);
		base64 = await blobToBase64(jpeg);
		if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
			// One-shot retry: re-normalize once before giving up on this image.
			jpeg = await normalizeImageToJpeg(file);
			base64 = await blobToBase64(jpeg);
		}
	} catch {
		return { error: decodeErrorFor(file) };
	}

	if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
		return { error: tooLargeErrorFor(file) };
	}
	return { image: { mediaType: "image/jpeg", data: base64 } };
}

function isImageFile(file: File): boolean {
	return file.type.startsWith("image/");
}

export function ImportForm({
	onExtracted,
	onUseManual,
	instrument,
}: ImportFormProps): React.ReactElement {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputText, setInputText] = useState("");
	const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	// In-thread error (proxy unreachable, non-OK HTTP, non-JSON envelope) — retryable.
	const [error, setError] = useState<string | null>(null);
	// Composer-area error (attachment cap, per-image normalization / size failure).
	// Kept distinct from `error` so image problems surface next to the thumbnails,
	// not in the chat thread (ADR-0010 §7).
	const [composerError, setComposerError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const resolvedInstrument: "guitar" | "piano" =
		instrument === "piano" ? "piano" : "guitar";

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const threadRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Holds the last turn's inputs so a retry can re-send without re-typing or
	// re-normalizing.
	const retryRef = useRef<RetryState | null>(null);
	// Latest attachments, read only by the unmount cleanup so it revokes whatever is
	// still staged without re-subscribing on every change.
	const attachedRef = useRef<AttachedImage[]>(attachedImages);
	attachedRef.current = attachedImages;

	// Revoke any object URLs still staged when the component unmounts.
	useEffect(() => {
		return () => {
			for (const a of attachedRef.current) URL.revokeObjectURL(a.url);
		};
	}, []);

	// Grow the composer to fit its content, capped so it scrolls internally. Run
	// against the live element on each change (its value is already current in the
	// DOM when `change` fires), so no effect keyed on `inputText` is needed.
	function resizeComposer(el: HTMLTextAreaElement): void {
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
	}

	// Keep the newest turn in view as the thread grows. The body reads a ref, so
	// Biome cannot see that the thread contents are the trigger — the dep list is
	// intentional, not redundant.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the newest turn whenever the thread changes
	useEffect(() => {
		const el = threadRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages, isLoading, error]);

	// Single convergence point for the file picker, drag-and-drop, and clipboard
	// paste (ADR-0010 §1). Non-image files are dropped silently; the 10-image cap
	// and its message live here so every entry point shares one behavior.
	function addImages(candidates: File[]): void {
		const imageFiles = candidates.filter(isImageFile);
		if (imageFiles.length === 0) return;

		const remaining = MAX_IMAGES - attachedImages.length;
		if (remaining <= 0) {
			setComposerError(ERROR_TOO_MANY_IMAGES);
			return;
		}

		const accepted = imageFiles.slice(0, remaining).map((file) => ({
			id: crypto.randomUUID(),
			file,
			url: URL.createObjectURL(file),
		}));
		setAttachedImages((prev) => [...prev, ...accepted]);
		// Surface the cap message when the drop/paste/selection had more than fit;
		// otherwise clear any stale attachment error.
		setComposerError(
			imageFiles.length > remaining ? ERROR_TOO_MANY_IMAGES : null,
		);
	}

	function removeImage(id: string): void {
		setAttachedImages((prev) => {
			const target = prev.find((a) => a.id === id);
			if (target) URL.revokeObjectURL(target.url);
			return prev.filter((a) => a.id !== id);
		});
		// Removing an image clears any attachment error and re-enables attaching
		// (e.g. dropping back below the 10-image cap).
		setComposerError(null);
	}

	async function runTurn(
		history: ChatMessage[],
		images: NormalizedImage[] | undefined,
		usedImages: boolean,
	): Promise<void> {
		retryRef.current = { history, images, usedImages };
		setError(null);
		setIsLoading(true);

		const body: ExtractionRequestBody = {
			messages: history.map((m) => ({ role: m.role, content: m.text })),
			system: usedImages ? IMAGE_SYSTEM_PROMPT : SYSTEM_PROMPT,
			model: MODEL,
			instrument: resolvedInstrument,
			...(images && images.length > 0 ? { images } : {}),
		};

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

		if (!response.ok) {
			setError(ERROR_HTTP);
			setIsLoading(false);
			return;
		}

		let raw: string;
		try {
			const data = (await response.json()) as ProxyResponse;
			raw = data.content[0].text;
		} catch {
			// The HTTP envelope was not the expected JSON shape.
			setError(ERROR_INVALID_JSON);
			setIsLoading(false);
			return;
		}

		setMessages((prev) => [...prev, buildAssistantMessage(raw)]);
		setIsLoading(false);
	}

	async function handleSend(): Promise<void> {
		if (isLoading) return;
		const hasImages = attachedImages.length > 0;
		const trimmed = inputText.trim();
		// Send is valid with non-whitespace text OR at least one image (ADR-0010 §1).
		if (trimmed === "" && !hasImages) return;

		let images: NormalizedImage[] | undefined;
		if (hasImages) {
			setComposerError(null);
			const normalized: NormalizedImage[] = [];
			// Normalize each image independently. If any single one fails (undecodable
			// or still oversized after its retry), stop before sending so we never POST
			// a partial/mismatched set — name the offending image and keep all staged.
			for (const attached of attachedImages) {
				const result = await normalizeOne(attached.file);
				if ("error" in result) {
					setComposerError(result.error);
					return;
				}
				normalized.push(result.image);
			}
			images = normalized;
		}

		const text = trimmed === "" ? DEFAULT_IMAGE_MESSAGE : inputText;
		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			text,
			...(hasImages ? { imageCount: attachedImages.length } : {}),
		};
		const history = [...messages, userMessage];
		setMessages(history);
		setInputText("");
		// Images attach to the current turn only (ADR-0010 §4): clear staging so the
		// next turn starts empty, and release the previews.
		for (const a of attachedImages) URL.revokeObjectURL(a.url);
		setAttachedImages([]);
		setComposerError(null);
		if (textareaRef.current) textareaRef.current.style.height = "auto";
		void runTurn(history, images, hasImages);
	}

	function handleRetry(): void {
		const saved = retryRef.current;
		if (saved) void runTurn(saved.history, saved.images, saved.usedImages);
	}

	function handleKeyDown(
		event: React.KeyboardEvent<HTMLTextAreaElement>,
	): void {
		// Only a real Enter keydown submits; Shift+Enter (and pasted newlines,
		// which never fire this handler) insert a newline instead.
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSend();
		}
	}

	function handleFileInputChange(
		event: React.ChangeEvent<HTMLInputElement>,
	): void {
		const files = event.target.files ? Array.from(event.target.files) : [];
		addImages(files);
		// Reset so selecting the same file again still fires a change event.
		event.target.value = "";
	}

	function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
		event.preventDefault();
		setIsDragging(false);
		addImages(Array.from(event.dataTransfer.files));
	}

	function handlePaste(event: React.ClipboardEvent<HTMLDivElement>): void {
		const items = event.clipboardData?.items;
		if (!items) return;
		const files: File[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}
		// No image items: let the paste fall through to native text-paste behavior.
		if (files.length === 0) return;
		event.preventDefault();
		addImages(files);
	}

	const isSendDisabled =
		isLoading || (inputText.trim() === "" && attachedImages.length === 0);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drag/paste target for image attachment spans the whole panel (ADR-0010 §1)
		<div
			className="space-y-4"
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragging(true);
			}}
			onDragLeave={() => setIsDragging(false)}
			onDrop={handleDrop}
			onPaste={handlePaste}
		>
			<div
				ref={threadRef}
				className={`flex max-h-[460px] min-h-[280px] flex-col gap-4 overflow-y-auto rounded-lg border bg-paper/50 px-4 py-4 transition-colors ${isDragging ? "border-accent bg-accent/[.06]" : "border-line"}`}
			>
				{messages.length === 0 && !isLoading && !error && (
					<p className="m-auto max-w-[42ch] text-center font-serif text-[14px] leading-[1.7] text-ink-soft">
						Paste a tab, chord sheet, or chord chart — attach screenshots of a
						tab or sheet, or just describe the song you want to import. Press
						Enter to send.
					</p>
				)}

				{messages.map((message) =>
					message.role === "user" ? (
						<div
							key={message.id}
							className="ml-auto max-w-[85%] rounded-lg border border-line bg-accent/[.06] px-4 py-3"
						>
							{message.imageCount ? (
								<span
									className={`${LABEL_CLASS} mb-2 inline-flex items-center rounded-md border border-line bg-paper px-2 py-1`}
								>
									{message.imageCount} image
									{message.imageCount === 1 ? "" : "s"}
								</span>
							) : null}
							<p className="whitespace-pre-wrap font-serif text-[15px] leading-[1.6] text-ink">
								{message.text}
							</p>
						</div>
					) : message.extractedFields ? (
						<ResultCard
							key={message.id}
							fields={message.extractedFields}
							onUse={() =>
								onExtracted(message.extractedFields as SongFormInitialValues)
							}
						/>
					) : message.isTabContentEmpty ? (
						<div
							key={message.id}
							className="mr-auto max-w-[85%] rounded-lg border border-line bg-paper px-4 py-3 font-serif text-[14px] leading-[1.6] text-ink-soft"
						>
							{NO_TAB_CONTENT_NOTE}
						</div>
					) : (
						<div
							key={message.id}
							className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-paper px-4 py-3 font-serif text-[15px] leading-[1.6] text-ink"
						>
							{message.text}
						</div>
					),
				)}

				{isLoading && (
					<p
						role="status"
						className="mr-auto animate-pulse font-serif text-[14px] text-ink-soft"
					>
						Extracting song details…
					</p>
				)}

				{error && (
					<div className="mr-auto max-w-[85%] space-y-3 rounded-lg border border-delete/30 bg-delete/[.06] px-4 py-3">
						<p className="font-serif text-[14px] text-delete">{error}</p>
						<button
							type="button"
							onClick={handleRetry}
							className={SECONDARY_BUTTON_CLASS}
						>
							Try again
						</button>
					</div>
				)}
			</div>

			{attachedImages.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{attachedImages.map((attached) => (
						<div
							key={attached.id}
							className="relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-paper"
						>
							{/* biome-ignore lint/performance/noImgElement: local object-URL preview of a staged attachment, not a remote asset */}
							<img
								src={attached.url}
								alt={
									attached.file.name && attached.file.name.trim() !== ""
										? attached.file.name
										: "attached image"
								}
								className="h-full w-full object-cover"
							/>
							<button
								type="button"
								onClick={() => removeImage(attached.id)}
								aria-label={`Remove ${
									attached.file.name && attached.file.name.trim() !== ""
										? attached.file.name
										: "image"
								}`}
								className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black/[.15] bg-leather font-mono text-[11px] leading-none text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110"
							>
								×
							</button>
						</div>
					))}
				</div>
			)}

			{composerError && (
				<p className="font-serif text-[14px] text-delete">{composerError}</p>
			)}

			<div className="flex items-end gap-2">
				<textarea
					ref={textareaRef}
					value={inputText}
					onChange={(e) => {
						setInputText(e.target.value);
						resizeComposer(e.target);
					}}
					onKeyDown={handleKeyDown}
					disabled={isLoading}
					rows={1}
					aria-label="Message"
					placeholder="Paste a tab or chord sheet, attach images, or ask a question…"
					className="max-h-[140px] min-h-[48px] flex-1 resize-none overflow-y-auto rounded-lg border border-line bg-paper px-4 py-3 font-serif text-[15px] text-ink placeholder:text-ink-soft/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
				/>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/png,image/jpeg,image/webp"
					aria-label="Attach image files"
					className="sr-only"
					onChange={handleFileInputChange}
				/>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={isLoading}
					aria-label="Attach images"
					className={ATTACH_BUTTON_CLASS}
				>
					+ Images
				</button>
				<button
					type="button"
					onClick={() => void handleSend()}
					disabled={isSendDisabled}
					className={PRIMARY_BUTTON_CLASS}
				>
					Send
				</button>
			</div>

			<button
				type="button"
				onClick={onUseManual}
				className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
			>
				Use manual entry
			</button>
		</div>
	);
}

function ResultCard({
	fields,
	onUse,
}: {
	fields: SongFormInitialValues;
	onUse: () => void;
}): React.ReactElement {
	const preview =
		fields.content.length > 200
			? `${fields.content.slice(0, 200)}…`
			: fields.content;

	return (
		<div className="mr-auto w-full space-y-4 rounded-lg border border-line bg-paper px-4 py-4">
			<dl className="space-y-2">
				<Field label="Title" value={fields.title} />
				<Field label="Artist" value={fields.artist} />
				<Field
					label="Capo"
					value={fields.capo === null ? "None" : String(fields.capo)}
				/>
				<Field label="Notes" value={fields.notes ?? "None"} />
			</dl>
			<div>
				<span className={LABEL_CLASS}>Preview</span>
				<pre className="mt-1 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-cream/40 px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink">
					{preview}
				</pre>
			</div>
			<button type="button" onClick={onUse} className={PRIMARY_BUTTON_CLASS}>
				Use this result
			</button>
		</div>
	);
}

function Field({
	label,
	value,
}: {
	label: string;
	value: string;
}): React.ReactElement {
	return (
		<div className="flex gap-3">
			<dt className={`${LABEL_CLASS} w-16 shrink-0 pt-[3px]`}>{label}</dt>
			<dd className="font-serif text-[15px] leading-[1.5] text-ink">{value}</dd>
		</div>
	);
}
