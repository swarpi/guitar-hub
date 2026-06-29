"use server";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { and, eq, ne, notExists } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { getArtistBySlug, getSongById } from "@/db/queries";
import type * as schema from "@/db/schema";
import { artists, songs } from "@/db/schema";
import { generateId } from "@/lib/nanoid";
import { slugify } from "@/lib/slugify";

type Db = DrizzleD1Database<typeof schema>;

export async function createSongLogic(
	db: Db,
	formData: FormData,
): Promise<{ error: string } | { artistSlug: string; songSlug: string }> {
	const title = (formData.get("title") as string | null)?.trim() ?? "";
	const artist = (formData.get("artist") as string | null)?.trim() ?? "";
	const content = (formData.get("content") as string | null)?.trim() ?? "";
	const capoRaw = (formData.get("capo") as string | null)?.trim() ?? "";
	const notes = (formData.get("notes") as string | null)?.trim() || null;

	if (!title || !artist || !content) {
		return { error: "Title, artist, and content are required." };
	}

	let capo: number | null = null;
	if (capoRaw !== "") {
		capo = Number.parseInt(capoRaw, 10);
		if (Number.isNaN(capo) || capo < 0 || capo > 12) {
			return { error: "Capo must be between 0 and 12." };
		}
	}

	const artistSlug = slugify(artist);
	const songSlug = slugify(title);

	if (!artistSlug || !songSlug) {
		return {
			error: "Title and artist must contain at least one letter or number.",
		};
	}

	const now = new Date().toISOString();

	await db
		.insert(artists)
		.values({
			id: generateId(),
			name: artist,
			slug: artistSlug,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();

	const artistRow = await getArtistBySlug(db, artistSlug);
	if (!artistRow) {
		return { error: "Failed to create or find artist." };
	}

	if (artistRow.name !== artist) {
		return {
			error: `An artist named "${artistRow.name}" already exists with a similar name.`,
		};
	}

	const existing = await db
		.select({ id: songs.id })
		.from(songs)
		.where(and(eq(songs.artistId, artistRow.id), eq(songs.slug, songSlug)))
		.limit(1);

	if (existing.length > 0) {
		return {
			error: "A song with this title already exists for this artist.",
		};
	}

	try {
		await db.insert(songs).values({
			id: generateId(),
			artistId: artistRow.id,
			title,
			slug: songSlug,
			content,
			capo,
			notes,
			createdAt: now,
			updatedAt: now,
		});
	} catch (err) {
		if (err instanceof Error && /unique/i.test(err.message)) {
			return {
				error: "A song with this title already exists for this artist.",
			};
		}
		throw err;
	}

	return { artistSlug, songSlug };
}

export async function createSong(
	formData: FormData,
): Promise<{ error: string } | undefined> {
	const db = getDb(getRequestContext().env);
	const result = await createSongLogic(db, formData);

	if ("error" in result) {
		return result;
	}

	redirect(`/artists/${result.artistSlug}/${result.songSlug}`);
}

export async function updateSongLogic(
	db: Db,
	songId: string,
	formData: FormData,
): Promise<{ error: string } | { artistSlug: string; songSlug: string }> {
	const title = (formData.get("title") as string | null)?.trim() ?? "";
	const artist = (formData.get("artist") as string | null)?.trim() ?? "";
	const content = (formData.get("content") as string | null)?.trim() ?? "";
	const capoRaw = (formData.get("capo") as string | null)?.trim() ?? "";
	const notes = (formData.get("notes") as string | null)?.trim() || null;

	if (!title || !artist || !content) {
		return { error: "Title, artist, and content are required." };
	}

	let capo: number | null = null;
	if (capoRaw !== "") {
		capo = Number.parseInt(capoRaw, 10);
		if (Number.isNaN(capo) || capo < 0 || capo > 12) {
			return { error: "Capo must be between 0 and 12." };
		}
	}

	const newArtistSlug = slugify(artist);
	const newSongSlug = slugify(title);

	if (!newArtistSlug || !newSongSlug) {
		return {
			error: "Title and artist must contain at least one letter or number.",
		};
	}

	const currentSong = await getSongById(db, songId);
	if (!currentSong) {
		return { error: "Song not found." };
	}

	let newArtistId = currentSong.artistId;

	if (newArtistSlug !== currentSong.artistSlug) {
		const now = new Date().toISOString();
		await db
			.insert(artists)
			.values({
				id: generateId(),
				name: artist,
				slug: newArtistSlug,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();

		const artistRow = await getArtistBySlug(db, newArtistSlug);
		if (!artistRow) {
			return { error: "Failed to create or find artist." };
		}

		if (artistRow.name !== artist) {
			return {
				error: `An artist named "${artistRow.name}" already exists with a similar name.`,
			};
		}

		newArtistId = artistRow.id;
	}

	if (
		newArtistId !== currentSong.artistId ||
		newSongSlug !== currentSong.slug
	) {
		const conflict = await db
			.select({ id: songs.id })
			.from(songs)
			.where(
				and(
					eq(songs.artistId, newArtistId),
					eq(songs.slug, newSongSlug),
					ne(songs.id, songId),
				),
			)
			.limit(1);

		if (conflict.length > 0) {
			return {
				error: "A song with this title already exists for this artist.",
			};
		}
	}

	const now = new Date().toISOString();
	await db
		.update(songs)
		.set({
			title,
			slug: newSongSlug,
			content,
			capo,
			notes,
			artistId: newArtistId,
			updatedAt: now,
		})
		.where(eq(songs.id, songId));

	if (newArtistId !== currentSong.artistId) {
		await db
			.delete(artists)
			.where(
				and(
					eq(artists.id, currentSong.artistId),
					notExists(
						db
							.select({ id: songs.id })
							.from(songs)
							.where(eq(songs.artistId, currentSong.artistId)),
					),
				),
			);
	}

	return { artistSlug: newArtistSlug, songSlug: newSongSlug };
}

export async function updateSong(
	formData: FormData,
): Promise<{ error: string } | undefined> {
	const songId = (formData.get("songId") as string | null)?.trim() ?? "";
	if (!songId) {
		return { error: "Song ID is required." };
	}

	const db = getDb(getRequestContext().env);
	const result = await updateSongLogic(db, songId, formData);

	if ("error" in result) {
		return result;
	}

	redirect(`/artists/${result.artistSlug}/${result.songSlug}`);
}

export async function deleteSongLogic(
	db: Db,
	songId: string,
): Promise<{ error: string } | { success: true }> {
	const currentSong = await getSongById(db, songId);
	if (!currentSong) {
		return { error: "Song not found." };
	}

	const { artistId } = currentSong;

	await db.delete(songs).where(eq(songs.id, songId));

	await db
		.delete(artists)
		.where(
			and(
				eq(artists.id, artistId),
				notExists(
					db
						.select({ id: songs.id })
						.from(songs)
						.where(eq(songs.artistId, artistId)),
				),
			),
		);

	return { success: true };
}

export async function deleteSong(
	formData: FormData,
): Promise<{ error: string } | undefined> {
	const songId = (formData.get("songId") as string | null)?.trim() ?? "";
	if (!songId) {
		return { error: "Song ID is required." };
	}

	const db = getDb(getRequestContext().env);
	const result = await deleteSongLogic(db, songId);

	if ("error" in result) {
		return result;
	}

	revalidatePath("/");
	redirect("/");
}
