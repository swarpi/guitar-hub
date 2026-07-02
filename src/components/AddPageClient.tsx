"use client";

import { useState } from "react";

import { ImportForm } from "./ImportForm";
import type { SongFormInitialValues } from "./SongForm";
import { SongForm } from "./SongForm";

type Mode = "manual" | "import";

interface AddPageClientProps {
	readonly artistNames: readonly string[];
	readonly action: (
		formData: FormData,
	) => Promise<{ error: string } | undefined>;
}

const TOGGLE_BASE =
	"rounded-lg px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest transition-colors";
const TOGGLE_ACTIVE =
	"border border-black/[.15] bg-leather text-cream shadow-[0_1px_2px_rgba(40,28,16,0.18)]";
const TOGGLE_INACTIVE =
	"border border-line bg-transparent text-ink-soft hover:border-ink-soft/30 hover:bg-accent/[.04]";

export function AddPageClient({
	artistNames,
	action,
}: AddPageClientProps): React.ReactElement {
	const [mode, setMode] = useState<Mode>("manual");
	const [extractedFields, setExtractedFields] =
		useState<SongFormInitialValues | null>(null);

	function handleExtracted(fields: SongFormInitialValues) {
		setExtractedFields(fields);
	}

	function handleBackToImport() {
		setExtractedFields(null);
	}

	function handleUseManual() {
		setMode("manual");
		setExtractedFields(null);
	}

	const showReview = mode === "import" && extractedFields !== null;

	return (
		<>
			<div className="mb-6 flex gap-2">
				<button
					type="button"
					onClick={() => {
						setMode("manual");
						setExtractedFields(null);
					}}
					className={`${TOGGLE_BASE} ${mode === "manual" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
				>
					Manual
				</button>
				<button
					type="button"
					onClick={() => setMode("import")}
					className={`${TOGGLE_BASE} ${mode === "import" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
				>
					Import via AI
				</button>
			</div>

			{mode === "manual" && (
				<SongForm artistNames={artistNames} action={action} />
			)}

			{mode === "import" && !showReview && (
				<ImportForm
					onExtracted={handleExtracted}
					onUseManual={handleUseManual}
				/>
			)}

			{showReview && (
				<>
					<button
						type="button"
						onClick={handleBackToImport}
						className="mb-4 inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]"
					>
						&larr; Back to Import
					</button>
					<SongForm
						artistNames={artistNames}
						action={action}
						initialValues={extractedFields}
					/>
				</>
			)}
		</>
	);
}
