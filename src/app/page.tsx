import { getRequestContext } from "@cloudflare/next-on-pages";
import type { Metadata } from "next";
import Link from "next/link";

import { getDb } from "@/db/client";
import { getSongCountsByInstrument } from "@/db/queries";

export const runtime = "edge";

export const metadata: Metadata = {
	title: "Music Hub",
};

export default async function LandingPage() {
	const db = getDb(getRequestContext().env);
	const counts = await getSongCountsByInstrument(db);

	return (
		<>
			<header className="sticky top-0 z-20 border-b border-black/30 bg-header shadow-[0_6px_16px_rgba(15,30,22,0.18)]">
				<div className="px-[clamp(16px,4vw,28px)] py-4">
					<span className="whitespace-nowrap font-serif text-[clamp(21px,5vw,26px)] tracking-tight text-cream">
						<span className="font-semibold">Music</span>{" "}
						<span className="font-light italic text-[#a7bdab]">Hub</span>
					</span>
				</div>
			</header>
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<div className="mb-[7px] mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-[.22em] text-ink-soft">
					The Songbook
				</div>
				<p className="mb-8 font-serif text-[15px] italic text-ink-soft">
					Pick an instrument to browse its collection.
				</p>

				<div className="grid gap-5 sm:grid-cols-2">
					<InstrumentCard
						name="Guitar"
						href="/guitar"
						count={counts.guitar}
						description="Fingerstyle tablature"
					/>
					<InstrumentCard
						name="Piano"
						href="/piano"
						count={counts.piano}
						description="Sheets in ABC notation"
					/>
				</div>
			</main>
		</>
	);
}

interface InstrumentCardProps {
	readonly name: string;
	readonly href: string;
	readonly count: number;
	readonly description: string;
}

function InstrumentCard({
	name,
	href,
	count,
	description,
}: InstrumentCardProps): React.ReactElement {
	return (
		<Link
			href={href}
			className="group block rounded-lg border border-line bg-paper p-6 shadow-[0_1px_3px_rgba(40,28,16,0.06)] transition-all hover:-translate-y-px hover:border-accent/40 hover:shadow-[0_4px_12px_rgba(40,28,16,0.10)]"
		>
			<h2 className="mb-1 font-serif text-[23px] font-medium text-ink">
				{name}
			</h2>
			<p className="mb-4 font-serif text-[14px] italic text-ink-soft">
				{description}
			</p>
			<div className="flex items-baseline justify-between">
				<span className="font-serif text-[15px] italic text-ink-soft">
					{count} {count === 1 ? "song" : "songs"}
				</span>
				<span className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-accent transition-transform group-hover:translate-x-0.5">
					Browse →
				</span>
			</div>
		</Link>
	);
}
