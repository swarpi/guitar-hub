import { getRequestContext } from "@cloudflare/next-on-pages";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Header } from "@/components/Header";
import { SongForm } from "@/components/SongForm";
import { getDb } from "@/db/client";
import { artists } from "@/db/schema";

import { createSong } from "../actions";

export const runtime = "edge";

export const metadata: Metadata = {
	title: "Add a Song — Guitar Hub",
};

export default async function AddPage() {
	const db = getDb(getRequestContext().env);

	const allArtists = await db
		.select({ name: artists.name })
		.from(artists)
		.orderBy(asc(artists.name));

	const artistNames = allArtists.map((a) => a.name);

	return (
		<>
			<Header />
			<main className="relative z-[1] px-[clamp(20px,4vw,34px)] pb-20 pt-[clamp(22px,4.5vw,38px)]">
				<Breadcrumb
					items={[{ label: "Home", href: "/" }, { label: "Add a Song" }]}
				/>
				<h1 className="mb-6 font-serif text-[28px] font-medium leading-tight text-ink">
					Add a Song
				</h1>
				<SongForm artistNames={artistNames} action={createSong} />
			</main>
		</>
	);
}
