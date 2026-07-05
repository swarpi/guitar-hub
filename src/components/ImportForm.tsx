"use client";

import { useState } from "react";

import type { SongFormInitialValues } from "./SongForm";

const PROXY_URL = "http://localhost:3456/v1/messages";

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

const ERROR_UNREACHABLE =
	"AI service is not running. Start it with `pnpm dev:ai`.";
const ERROR_INVALID_JSON =
	"Could not parse the AI response. Try again or switch to manual entry.";
const ERROR_EMPTY_TAB =
	"No tab content was found in the input. Try pasting a different format.";
const ERROR_HTTP = "The AI service returned an error. Try again.";
const ERROR_URL_FETCH =
	"Could not fetch the URL. Check the link and try again.";

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

type InputMethod = "paste" | "url";

interface ImportFormProps {
	readonly onExtracted: (fields: SongFormInitialValues) => void;
	readonly onUseManual: () => void;
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

export function ImportForm({
	onExtracted,
	onUseManual,
}: ImportFormProps): React.ReactElement {
	const [method, setMethod] = useState<InputMethod>("paste");
	const [text, setText] = useState("");
	const [url, setUrl] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const activeValue = method === "paste" ? text : url;

	function switchMethod(next: InputMethod): void {
		setMethod(next);
		setError(null);
	}

	async function runExtraction(content: string): Promise<void> {
		setError(null);
		setIsLoading(true);

		let response: Response;
		try {
			response = await fetch(PROXY_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [{ role: "user", content }],
					system: SYSTEM_PROMPT,
					model: "claude-sonnet-4-5",
				}),
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
			parsed = JSON.parse(data.content[0].text) as ExtractedSong;
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
		return runExtraction(content);
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
						<button
							type="button"
							onClick={handleExtract}
							className={SECONDARY_BUTTON_CLASS}
						>
							Try again
						</button>
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

			<button
				type="button"
				onClick={handleExtract}
				disabled={isLoading || activeValue.trim() === ""}
				className="inline-flex rounded-lg border border-black/[.15] bg-leather px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110 disabled:opacity-50"
			>
				{isLoading ? "Extracting..." : "Extract"}
			</button>
		</div>
	);
}
