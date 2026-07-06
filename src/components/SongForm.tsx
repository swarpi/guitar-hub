"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { DeleteModal } from "./DeleteModal";

export interface SongFormInitialValues {
	readonly title: string;
	readonly artist: string;
	readonly capo: number | null;
	readonly content: string;
	readonly notes: string | null;
	readonly difficulty?: string | null;
	readonly key?: string | null;
	readonly sourceUrl?: string | null;
}

const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"] as const;

interface SongFormProps {
	readonly artistNames: readonly string[];
	readonly action: (
		formData: FormData,
	) => Promise<{ error: string } | undefined>;
	readonly initialValues?: SongFormInitialValues;
	readonly instrument?: string;
	readonly songId?: string;
	readonly songTitle?: string;
	readonly artistName?: string;
	readonly cancelHref?: string;
	readonly deleteAction?: (
		formData: FormData,
	) => Promise<{ error: string } | undefined>;
}

const INPUT_CLASS =
	"w-full rounded-lg border border-line bg-paper px-4 py-3 font-serif text-[15px] text-ink placeholder:text-ink-soft/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const LABEL_CLASS =
	"mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-ink-soft";

export function SongForm({
	artistNames,
	action,
	initialValues,
	instrument,
	songId,
	songTitle,
	artistName,
	cancelHref,
	deleteAction,
}: SongFormProps): React.ReactElement {
	const [isOffline, setIsOffline] = useState(false);
	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [artist, setArtist] = useState(initialValues?.artist ?? "");
	const [capo, setCapo] = useState(initialValues?.capo?.toString() ?? "");
	const [content, setContent] = useState(initialValues?.content ?? "");
	const [notes, setNotes] = useState(initialValues?.notes ?? "");
	const [difficulty, setDifficulty] = useState(initialValues?.difficulty ?? "");
	const [songKey, setSongKey] = useState(initialValues?.key ?? "");
	const [sourceUrl, setSourceUrl] = useState(initialValues?.sourceUrl ?? "");
	const [showDeleteModal, setShowDeleteModal] = useState(false);

	useEffect(() => {
		setIsOffline(!navigator.onLine);
		const goOffline = () => setIsOffline(true);
		const goOnline = () => setIsOffline(false);
		window.addEventListener("offline", goOffline);
		window.addEventListener("online", goOnline);
		return () => {
			window.removeEventListener("offline", goOffline);
			window.removeEventListener("online", goOnline);
		};
	}, []);

	const [state, formAction, isPending] = useActionState(
		async (_prev: { error: string } | undefined, formData: FormData) => {
			return await action(formData);
		},
		undefined,
	);

	if (isOffline) {
		return (
			<p className="py-10 text-center font-serif text-[15px] text-ink-soft">
				You need to be online to add or edit songs
			</p>
		);
	}

	return (
		<>
			<form action={formAction} className="space-y-5">
				{songId && <input type="hidden" name="songId" value={songId} />}
				{instrument && (
					<input type="hidden" name="instrument" value={instrument} />
				)}
				<div>
					<label htmlFor="title-input" className={LABEL_CLASS}>
						Song Title
					</label>
					<input
						id="title-input"
						name="title"
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="e.g. Dust in the Wind"
						className={INPUT_CLASS}
						required
					/>
				</div>

				<div>
					<label htmlFor="artist-input" className={LABEL_CLASS}>
						Artist
					</label>
					<input
						id="artist-input"
						name="artist"
						type="text"
						value={artist}
						onChange={(e) => setArtist(e.target.value)}
						placeholder="e.g. Sungha Jung"
						list="artist-list"
						className={INPUT_CLASS}
						required
					/>
					<datalist id="artist-list">
						{artistNames.map((name) => (
							<option key={name} value={name} />
						))}
					</datalist>
				</div>

				{instrument !== "piano" && (
					<div>
						<label htmlFor="capo-input" className={LABEL_CLASS}>
							Capo
						</label>
						<input
							id="capo-input"
							name="capo"
							type="number"
							value={capo}
							onChange={(e) => setCapo(e.target.value)}
							min={0}
							max={12}
							placeholder="0"
							className={`${INPUT_CLASS} max-w-[170px]`}
						/>
					</div>
				)}

				<div>
					<label htmlFor="tab-input" className={LABEL_CLASS}>
						Tab Content
					</label>
					<textarea
						id="tab-input"
						name="content"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Paste your tab here..."
						className={`${INPUT_CLASS} min-h-[210px] overflow-x-auto whitespace-pre font-mono text-[13px] leading-[1.7]`}
						required
					/>
				</div>

				{content.trim() && (
					<div>
						<div className={LABEL_CLASS}>Preview</div>
						<pre className="overflow-x-auto whitespace-pre rounded-lg border border-line bg-paper p-5 font-mono text-[13px] leading-[1.7] text-tab-text shadow-[0_1px_3px_rgba(40,28,16,0.06)]">
							{content}
						</pre>
					</div>
				)}

				<div className="flex flex-wrap gap-5">
					<div>
						<label htmlFor="difficulty-input" className={LABEL_CLASS}>
							Difficulty
						</label>
						<select
							id="difficulty-input"
							name="difficulty"
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value)}
							className={`${INPUT_CLASS} min-w-[170px]`}
						>
							<option value="">—</option>
							{DIFFICULTY_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</div>

					<div>
						<label htmlFor="key-input" className={LABEL_CLASS}>
							Key
						</label>
						<input
							id="key-input"
							name="key"
							type="text"
							value={songKey}
							onChange={(e) => setSongKey(e.target.value)}
							placeholder="e.g. G, Am"
							className={`${INPUT_CLASS} max-w-[170px]`}
						/>
					</div>
				</div>

				<div>
					<label htmlFor="source-url-input" className={LABEL_CLASS}>
						Source URL
					</label>
					<input
						id="source-url-input"
						name="sourceUrl"
						type="url"
						value={sourceUrl}
						onChange={(e) => setSourceUrl(e.target.value)}
						placeholder="https://..."
						className={INPUT_CLASS}
					/>
				</div>

				<div>
					<label htmlFor="notes-input" className={LABEL_CLASS}>
						Notes
					</label>
					<textarea
						id="notes-input"
						name="notes"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Tuning, arrangement notes, source..."
						className={`${INPUT_CLASS} min-h-[100px]`}
					/>
				</div>

				{state?.error && (
					<p className="font-serif text-[14px] text-delete">{state.error}</p>
				)}

				<div className="flex items-center justify-between gap-3 pt-2">
					<div className="flex items-center gap-3">
						<button
							type="submit"
							disabled={isPending}
							className="inline-flex rounded-lg border border-black/[.15] bg-leather px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110 disabled:opacity-50"
						>
							{isPending
								? "Saving…"
								: songId
									? "Save Changes"
									: "Save to Songbook"}
						</button>
						<Link
							href={cancelHref ?? "/"}
							className="inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]"
						>
							Cancel
						</Link>
					</div>
					{songId && deleteAction && (
						<button
							type="button"
							onClick={() => setShowDeleteModal(true)}
							className="font-mono text-[11px] font-semibold uppercase tracking-widest text-delete transition-colors hover:opacity-70"
						>
							Delete
						</button>
					)}
				</div>
			</form>
			{songId && deleteAction && (
				<DeleteModal
					isOpen={showDeleteModal}
					onClose={() => setShowDeleteModal(false)}
					songTitle={songTitle ?? title}
					artistName={artistName ?? artist}
					songId={songId}
					deleteAction={deleteAction}
				/>
			)}
		</>
	);
}
