import { getRequestContext } from "@cloudflare/next-on-pages";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Header } from "@/components/Header";
import { SongForm } from "@/components/SongForm";
import { getDb } from "@/db/client";
import { getSongById } from "@/db/queries";
import { artists } from "@/db/schema";

import { deleteSong, updateSong } from "../../../actions";

export const runtime = "edge";

interface EditPageProps {
	readonly params: Promise<{ songId: string }>;
}

export async function generateMetadata({
	params,
}: EditPageProps): Promise<Metadata> {
	const { songId } = await params;
	const db = getDb(getRequestContext().env);
	const song = await getSongById(db, songId);
	if (!song) return {};
	return { title: `Edit ${song.title}` };
}

export default async function EditPianoSongPage({ params }: EditPageProps) {
	const { songId } = await params;
	const db = getDb(getRequestContext().env);

	const [song, allArtists] = await Promise.all([
		getSongById(db, songId),
		db.select({ name: artists.name }).from(artists).orderBy(asc(artists.name)),
	]);

	if (song?.instrument !== "piano") notFound();

	const artistNames = allArtists.map((a) => a.name);

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<Breadcrumb
					items={[
						{ label: "Home", href: "/" },
						{ label: "Piano", href: "/piano" },
						{
							label: song.artistName,
							href: `/piano/${song.artistSlug}`,
						},
						{
							label: song.title,
							href: `/piano/${song.artistSlug}/${song.slug}`,
						},
						{ label: "Edit" },
					]}
				/>
				<h1 className="mb-6 font-serif text-[28px] font-medium leading-tight text-ink">
					Edit Song
				</h1>
				<SongForm
					artistNames={artistNames}
					action={updateSong}
					initialValues={{
						title: song.title,
						artist: song.artistName,
						capo: song.capo,
						content: song.content,
						notes: song.notes,
					}}
					instrument="piano"
					songId={songId}
					songTitle={song.title}
					artistName={song.artistName}
					cancelHref={`/piano/${song.artistSlug}/${song.slug}`}
					deleteAction={deleteSong}
				/>
			</main>
		</>
	);
}
