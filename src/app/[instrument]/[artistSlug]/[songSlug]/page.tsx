import { getRequestContext } from "@cloudflare/next-on-pages";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AbcNotation } from "@/components/AbcNotation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CapoBadge } from "@/components/CapoBadge";
import { Header } from "@/components/Header";
import { getDb } from "@/db/client";
import { getSongBySlugs } from "@/db/queries";
import { assertInstrument, INSTRUMENT_LABELS } from "@/lib/instruments";

export const runtime = "edge";

interface SongPageProps {
	readonly params: Promise<{
		instrument: string;
		artistSlug: string;
		songSlug: string;
	}>;
}

export async function generateMetadata({
	params,
}: SongPageProps): Promise<Metadata> {
	const { instrument: rawInstrument, artistSlug, songSlug } = await params;
	const instrument = assertInstrument(rawInstrument);
	const db = getDb(getRequestContext().env);
	const song = await getSongBySlugs(db, artistSlug, songSlug, instrument);
	if (!song) return {};
	return { title: song.title };
}

export default async function SongPage({ params }: SongPageProps) {
	const { instrument: rawInstrument, artistSlug, songSlug } = await params;
	const instrument = assertInstrument(rawInstrument);
	const db = getDb(getRequestContext().env);
	const song = await getSongBySlugs(db, artistSlug, songSlug, instrument);
	if (!song) notFound();

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<Breadcrumb
					items={[
						{ label: "Home", href: "/" },
						{ label: INSTRUMENT_LABELS[instrument], href: `/${instrument}` },
						{
							label: song.artistName,
							href: `/${instrument}/${song.artistSlug}`,
						},
						{ label: song.title },
					]}
				/>
				<h1 className="mb-1 font-serif text-[28px] font-medium leading-tight text-ink">
					{song.title}
				</h1>
				<div className="mb-5 font-serif text-[15px] italic text-ink-soft">
					{song.artistName}
				</div>

				{instrument === "guitar" && song.capo != null && (
					<div className="mb-4">
						<CapoBadge capo={song.capo} size="lg" />
					</div>
				)}

				{instrument === "guitar" ? (
					<pre className="mb-6 overflow-x-auto whitespace-pre rounded-lg border border-line bg-paper p-5 font-mono text-[13px] leading-[1.7] text-tab-text shadow-[0_1px_3px_rgba(40,28,16,0.06)]">
						{song.content}
					</pre>
				) : (
					<AbcNotation content={song.content} />
				)}

				{song.notes && song.notes.trim() !== "" && (
					<div className="mb-6">
						<div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-ink-soft">
							Notes
						</div>
						<p className="font-serif text-[15px] italic leading-relaxed text-ink-soft">
							{song.notes}
						</p>
					</div>
				)}

				<Link
					href={`/${instrument}/edit/${song.id}`}
					className="inline-flex items-center rounded-lg border border-line bg-transparent px-5 py-[11px] font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink-soft/30 hover:bg-accent/[.04]"
				>
					Edit
				</Link>
			</main>
		</>
	);
}
