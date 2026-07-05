import { getRequestContext } from "@cloudflare/next-on-pages";
import Link from "next/link";

import { FAB } from "@/components/FAB";
import { Header } from "@/components/Header";
import { SongListItem } from "@/components/SongListItem";
import { getDb } from "@/db/client";
import { getSongsByInstrument } from "@/db/queries";
import {
	assertInstrument,
	INSTRUMENT_LABELS,
	type Instrument,
} from "@/lib/instruments";
import { groupSongsByLetter } from "@/lib/songs";

export const runtime = "edge";

interface SongListPageProps {
	readonly params: Promise<{ instrument: string }>;
	readonly searchParams: Promise<{ q?: string }>;
}

export default async function SongListPage({
	params,
	searchParams,
}: SongListPageProps) {
	const { instrument: rawInstrument } = await params;
	const instrument = assertInstrument(rawInstrument);
	const { q } = await searchParams;
	const db = getDb(getRequestContext().env);

	const allSongs = await getSongsByInstrument(db, instrument);

	const songCount = allSongs.length;
	const artistCount = new Set(allSongs.map((s) => s.artistSlug)).size;

	const query = q?.trim().toLowerCase() ?? "";
	const filtered = query
		? allSongs.filter(
				(s) =>
					s.title.toLowerCase().includes(query) ||
					s.artistName.toLowerCase().includes(query),
			)
		: allSongs;

	const sections = groupSongsByLetter(filtered);

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<div className="mb-[7px] mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-[.22em] text-ink-soft">
					The Songbook &middot; {INSTRUMENT_LABELS[instrument]}
				</div>
				<div className="mb-2.5 font-serif text-[15px] italic text-ink-soft">
					{songCount} {songCount === 1 ? "song" : "songs"} &middot;{" "}
					{artistCount} {artistCount === 1 ? "artist" : "artists"}
				</div>

				{songCount === 0 && !query && <EmptyState instrument={instrument} />}

				{songCount > 0 && query && sections.length === 0 && (
					<p className="px-1.5 py-11 font-serif text-base italic text-ink-soft">
						No songs match &ldquo;{q}&rdquo;
					</p>
				)}

				{sections.length > 0 && (
					<div className="border-t border-line">
						{sections.map((section) => (
							<div key={section.letter}>
								<div className="px-1.5 pb-1.5 pt-6 font-mono text-[11px] font-semibold uppercase tracking-[.3em] text-accent opacity-85">
									{section.letter}
								</div>
								{section.songs.map((song) => (
									<SongListItem
										key={`${song.artistSlug}/${song.slug}`}
										title={song.title}
										artist={song.artistName}
										capo={
											instrument === "guitar"
												? (song.capo ?? undefined)
												: undefined
										}
										href={`/${instrument}/${song.artistSlug}/${song.slug}`}
									/>
								))}
							</div>
						))}
					</div>
				)}
			</main>
			<FAB href={`/${instrument}/add`} />
		</>
	);
}

function EmptyState({
	instrument,
}: {
	readonly instrument: Instrument;
}): React.ReactElement {
	return (
		<div className="px-5 py-[60px] text-center text-ink-soft">
			<h2 className="mb-[9px] font-serif text-[23px] font-medium text-ink">
				Your songbook is empty
			</h2>
			<p className="mb-6 font-serif text-[15.5px] italic">
				{instrument === "guitar"
					? "Add your first tab to begin the collection."
					: "Add your first piece to begin the collection."}
			</p>
			<Link
				href={`/${instrument}/add`}
				className="inline-flex rounded-lg border border-black/[.15] bg-leather px-6 py-[13px] font-mono text-xs font-semibold uppercase tracking-widest text-[#f1e7d4] shadow-[0_1px_2px_rgba(40,28,16,0.18)]"
			>
				＋ Add a Song
			</Link>
		</div>
	);
}
