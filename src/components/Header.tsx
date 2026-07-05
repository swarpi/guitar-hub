import Link from "next/link";
import { Suspense } from "react";

import { SearchInput } from "@/components/SearchInput";

export function Header(): React.ReactElement {
	return (
		<header className="sticky top-0 z-20 border-b border-black/30 bg-header shadow-[0_6px_16px_rgba(15,30,22,0.18)]">
			<div className="flex items-center justify-between gap-3.5 px-[clamp(16px,4vw,28px)] pt-4">
				<Link href="/" className="flex min-w-0 items-baseline gap-3.5">
					<span className="whitespace-nowrap font-serif text-[clamp(21px,5vw,26px)] tracking-tight text-cream">
						<span className="font-semibold">Music</span>{" "}
						<span className="font-light italic text-[#a7bdab]">Hub</span>
					</span>
				</Link>
			</div>
			<div className="px-[clamp(16px,4vw,28px)] pb-4 pt-3">
				<Suspense>
					<SearchInput />
				</Suspense>
			</div>
		</header>
	);
}
