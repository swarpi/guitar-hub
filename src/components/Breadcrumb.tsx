import Link from "next/link";

interface BreadcrumbItem {
	readonly label: string;
	readonly href?: string;
}

interface BreadcrumbProps {
	readonly items: readonly BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps): React.ReactElement {
	return (
		<nav className="mb-[18px] flex flex-wrap items-center gap-2 font-serif text-sm text-ink-soft">
			{items.map((item, i) => (
				<span key={item.label} className="flex items-center gap-2">
					{i > 0 && <span className="opacity-50">›</span>}
					{item.href ? (
						<Link href={item.href} className="italic text-accent">
							{item.label}
						</Link>
					) : (
						<span className="italic text-ink">{item.label}</span>
					)}
				</span>
			))}
		</nav>
	);
}
