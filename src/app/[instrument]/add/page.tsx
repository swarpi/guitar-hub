import { getRequestContext } from "@cloudflare/next-on-pages";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";

import { AddPageClient } from "@/components/AddPageClient";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Header } from "@/components/Header";
import { SongForm } from "@/components/SongForm";
import { getDb } from "@/db/client";
import { getAllSongsFlat } from "@/db/queries";
import { artists } from "@/db/schema";
import { assertInstrument, INSTRUMENT_LABELS } from "@/lib/instruments";

import { createSong } from "../../actions";

export const runtime = "edge";

export const metadata: Metadata = {
	title: "Add a Song",
};

interface AddSongPageProps {
	readonly params: Promise<{ instrument: string }>;
}

export default async function AddSongPage({ params }: AddSongPageProps) {
	const { instrument: rawInstrument } = await params;
	const instrument = assertInstrument(rawInstrument);
	const db = getDb(getRequestContext().env);

	// The AI import (and its duplicate check) is guitar-only; the flat song
	// list is not queried for piano.
	const [allArtists, existingSongs] = await Promise.all([
		db.select({ name: artists.name }).from(artists).orderBy(asc(artists.name)),
		instrument === "guitar" ? getAllSongsFlat(db, "guitar") : null,
	]);

	const artistNames = allArtists.map((a) => a.name);

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<Breadcrumb
					items={[
						{ label: "Home", href: "/" },
						{ label: INSTRUMENT_LABELS[instrument], href: `/${instrument}` },
						{ label: "Add a Song" },
					]}
				/>
				<h1 className="mb-6 font-serif text-[28px] font-medium leading-tight text-ink">
					Add a Song
				</h1>
				{instrument === "guitar" && existingSongs ? (
					<AddPageClient
						artistNames={artistNames}
						existingSongs={existingSongs}
						action={createSong}
						instrument="guitar"
						cancelHref="/guitar"
					/>
				) : (
					<SongForm
						artistNames={artistNames}
						action={createSong}
						instrument={instrument}
						cancelHref={`/${instrument}`}
					/>
				)}
			</main>
		</>
	);
}
