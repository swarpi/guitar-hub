import Link from "next/link";

import { CapoBadge } from "@/components/CapoBadge";

interface SongListItemProps {
	readonly title: string;
	readonly artist?: string;
	readonly capo?: number;
	readonly href: string;
}

export function SongListItem({
	title,
	artist,
	capo,
	href,
}: SongListItemProps): React.ReactElement {
	return (
		<Link
			href={href}
			className="group flex min-h-[62px] items-center justify-between gap-4 rounded-md border-b border-line px-1.5 py-3.5 transition-all duration-150 hover:bg-accent/[.06] hover:px-3"
		>
			<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span className="truncate font-serif text-[19px] font-medium leading-tight text-ink">
					{title}
				</span>
				{artist && (
					<span className="truncate font-serif text-[13.5px] italic text-ink-soft">
						{artist}
					</span>
				)}
			</span>
			<span className="flex shrink-0 items-center gap-3">
				{capo != null && <CapoBadge capo={capo} />}
				<span className="font-serif text-[19px] leading-none text-ink-soft/40">
					›
				</span>
			</span>
		</Link>
	);
}
