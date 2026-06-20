interface CapoBadgeProps {
	readonly capo: number;
	readonly size?: "sm" | "lg";
}

export function CapoBadge({
	capo,
	size = "sm",
}: CapoBadgeProps): React.ReactElement {
	const sizeClass =
		size === "lg" ? "px-3 py-1.5 text-[11px]" : "px-[9px] py-1 text-[10px]";
	return (
		<span
			className={`inline-flex items-center whitespace-nowrap rounded-full border border-accent/[.38] bg-accent/[.06] font-mono font-semibold uppercase tracking-[.13em] text-accent ${sizeClass}`}
		>
			Capo {capo}
		</span>
	);
}
