"use client";

import dynamic from "next/dynamic";

// `ssr: false` is rejected by next/dynamic inside server components, so this
// client wrapper owns the dynamic import. It also keeps the ~180 KB abcjs
// bundle out of the edge worker and off guitar routes (ADR-0005).
const AbcNotationRenderer = dynamic(() => import("./AbcNotationRenderer"), {
	ssr: false,
	loading: () => (
		<p className="mb-6 font-serif text-[15px] italic text-ink-soft">
			Loading notation…
		</p>
	),
});

interface AbcNotationProps {
	readonly content: string;
}

export function AbcNotation({ content }: AbcNotationProps): React.ReactElement {
	return <AbcNotationRenderer content={content} />;
}
