import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import type * as schema from "./schema";
import { artists, songs } from "./schema";

type Db = DrizzleD1Database<typeof schema>;

export async function getArtistBySlug(db: Db, slug: string) {
	const rows = await db
		.select({ id: artists.id, name: artists.name, slug: artists.slug })
		.from(artists)
		.where(eq(artists.slug, slug))
		.limit(1);
	return rows[0] ?? null;
}

export async function getSongsByArtistId(db: Db, artistId: string) {
	return db
		.select({
			id: songs.id,
			title: songs.title,
			slug: songs.slug,
			capo: songs.capo,
		})
		.from(songs)
		.where(eq(songs.artistId, artistId))
		.orderBy(asc(songs.title));
}

export async function getSongById(db: Db, songId: string) {
	const rows = await db
		.select({
			id: songs.id,
			title: songs.title,
			slug: songs.slug,
			tabContent: songs.tabContent,
			capo: songs.capo,
			notes: songs.notes,
			artistId: artists.id,
			artistName: artists.name,
			artistSlug: artists.slug,
		})
		.from(songs)
		.innerJoin(artists, eq(songs.artistId, artists.id))
		.where(eq(songs.id, songId))
		.limit(1);
	return rows[0] ?? null;
}

export async function getSongBySlugs(
	db: Db,
	artistSlug: string,
	songSlug: string,
) {
	const rows = await db
		.select({
			id: songs.id,
			title: songs.title,
			tabContent: songs.tabContent,
			capo: songs.capo,
			notes: songs.notes,
			artistName: artists.name,
			artistSlug: artists.slug,
		})
		.from(songs)
		.innerJoin(artists, eq(songs.artistId, artists.id))
		.where(and(eq(artists.slug, artistSlug), eq(songs.slug, songSlug)))
		.limit(1);
	return rows[0] ?? null;
}
