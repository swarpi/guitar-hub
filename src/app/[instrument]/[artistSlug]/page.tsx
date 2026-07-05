import { getRequestContext } from "@cloudflare/next-on-pages";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Header } from "@/components/Header";
import { SongListItem } from "@/components/SongListItem";
import { getDb } from "@/db/client";
import { getArtistBySlug, getSongsByArtistId } from "@/db/queries";
import { assertInstrument, INSTRUMENT_LABELS } from "@/lib/instruments";

export const runtime = "edge";

interface ArtistPageProps {
	readonly params: Promise<{ instrument: string; artistSlug: string }>;
}

export async function generateMetadata({
	params,
}: ArtistPageProps): Promise<Metadata> {
	const { artistSlug } = await params;
	const db = getDb(getRequestContext().env);
	const artist = await getArtistBySlug(db, artistSlug);
	if (!artist) return {};
	return { title: artist.name };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
	const { instrument: rawInstrument, artistSlug } = await params;
	const instrument = assertInstrument(rawInstrument);
	const db = getDb(getRequestContext().env);
	const artist = await getArtistBySlug(db, artistSlug);
	if (!artist) notFound();

	const songs = await getSongsByArtistId(db, artist.id, instrument);

	// Pre-existing behavioral difference, preserved (see ticket
	// route-consolidation/001): piano 404s when the artist has no songs for
	// the instrument; guitar renders the "0 songs" state.
	if (instrument === "piano" && songs.length === 0) notFound();

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<Breadcrumb
					items={[
						{ label: "Home", href: "/" },
						{ label: INSTRUMENT_LABELS[instrument], href: `/${instrument}` },
						{ label: artist.name },
					]}
				/>
				<h1 className="mb-1 font-serif text-[28px] font-medium leading-tight text-ink">
					{artist.name}
				</h1>
				<div className="mb-6 font-serif text-[15px] italic text-ink-soft">
					{songs.length} {songs.length === 1 ? "song" : "songs"}
				</div>

				{songs.length > 0 && (
					<div className="border-t border-line">
						{songs.map((song) => (
							<SongListItem
								key={song.id}
								title={song.title}
								capo={
									instrument === "guitar" ? (song.capo ?? undefined) : undefined
								}
								href={`/${instrument}/${artistSlug}/${song.slug}`}
							/>
						))}
					</div>
				)}
			</main>
		</>
	);
}
