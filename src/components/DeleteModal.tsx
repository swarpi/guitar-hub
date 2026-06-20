"use client";

import { useEffect, useRef } from "react";

interface DeleteModalProps {
	readonly isOpen: boolean;
	readonly onClose: () => void;
	readonly songTitle: string;
	readonly artistName: string;
	readonly songId: string;
	readonly deleteAction: (
		formData: FormData,
	) => Promise<{ error: string } | undefined>;
}

export function DeleteModal({
	isOpen,
	onClose,
	songTitle,
	artistName,
	songId,
	deleteAction,
}: DeleteModalProps): React.ReactElement | null {
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isOpen) dialogRef.current?.focus();
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
		<div
			role="presentation"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,28,16,0.55)]"
			onClick={onClose}
		>
			<div
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
				aria-modal="true"
				aria-labelledby="delete-modal-title"
				className="relative mx-4 w-full max-w-[400px] rounded-xl bg-page p-6 shadow-[0_8px_32px_rgba(40,28,16,0.22)] outline-none"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => {
					if (e.key === "Escape") onClose();
				}}
			>
				<h2
					id="delete-modal-title"
					className="mb-2 font-serif text-[20px] font-medium text-ink"
				>
					Delete this song?
				</h2>
				<p className="mb-6 font-serif text-[14px] leading-relaxed text-ink-soft">
					This will permanently remove{" "}
					<span className="font-medium text-ink">{songTitle}</span> by{" "}
					<span className="font-medium text-ink">{artistName}</span>. This
					action cannot be undone.
				</p>
				<div className="flex items-center justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]"
					>
						Cancel
					</button>
					<form
						action={async (formData) => {
							await deleteAction(formData);
						}}
					>
						<input type="hidden" name="songId" value={songId} />
						<button
							type="submit"
							className="inline-flex rounded-lg border border-black/[.15] bg-delete px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)] transition-colors hover:brightness-110"
						>
							Delete
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
