import Link from "next/link";

interface FABProps {
	readonly href?: string;
}

export function FAB({ href = "/guitar/add" }: FABProps): React.ReactElement {
	return (
		<Link
			href={href}
			className="fixed bottom-[22px] right-[22px] z-50 flex size-[58px] items-center justify-center rounded-full border border-black/[.18] bg-leather text-[26px] leading-none text-cream shadow-[0_6px_16px_rgba(40,28,16,0.28)] transition-all hover:-translate-y-px hover:brightness-110"
		>
			＋
		</Link>
	);
}
