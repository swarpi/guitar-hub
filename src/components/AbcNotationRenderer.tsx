"use client";

import { renderAbc } from "abcjs";
import { useEffect, useRef } from "react";

interface AbcNotationRendererProps {
	readonly content: string;
}

export default function AbcNotationRenderer({
	content,
}: AbcNotationRendererProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);

	// renderAbc mutates the DOM (replaces the container's innerHTML), so it
	// must run in an effect, not during render.
	useEffect(() => {
		if (containerRef.current && content) {
			renderAbc(containerRef.current, content, { responsive: "resize" });
		}
	}, [content]);

	return (
		<div className="mb-6 overflow-hidden rounded-lg border border-line bg-paper p-5 shadow-[0_1px_3px_rgba(40,28,16,0.06)]">
			<div ref={containerRef} />
		</div>
	);
}
