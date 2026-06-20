import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { artists, songs } from "@/db/schema";

vi.mock("@cloudflare/next-on-pages", () => ({
	getRequestContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// eslint-disable-next-line -- must be after mocks
const { createSongLogic, updateSongLogic, deleteSongLogic } = await import(
	"./actions"
);

type Db = Parameters<typeof createSongLogic>[0];

let counter = 0;
vi.mock("@/lib/nanoid", () => ({
	generateId: () => `test-id-${++counter}`,
}));

const MIGRATION_STATEMENTS = [
	`CREATE TABLE \`artists\` (
		\`id\` text PRIMARY KEY NOT NULL,
		\`name\` text NOT NULL,
		\`slug\` text NOT NULL,
		\`created_at\` text NOT NULL,
		\`updated_at\` text NOT NULL
	)`,
	"CREATE UNIQUE INDEX `artists_name_unique` ON `artists` (`name`)",
	"CREATE UNIQUE INDEX `artists_slug_unique` ON `artists` (`slug`)",
	`CREATE TABLE \`songs\` (
		\`id\` text PRIMARY KEY NOT NULL,
		\`artist_id\` text NOT NULL,
		\`title\` text NOT NULL,
		\`slug\` text NOT NULL,
		\`tab_content\` text NOT NULL,
		\`capo\` integer,
		\`notes\` text,
		\`created_at\` text NOT NULL,
		\`updated_at\` text NOT NULL,
		FOREIGN KEY (\`artist_id\`) REFERENCES \`artists\`(\`id\`) ON UPDATE no action ON DELETE no action
	)`,
	"CREATE UNIQUE INDEX `songs_artist_slug_unique` ON `songs` (`artist_id`,`slug`)",
];

function createTestDb(): Db {
	const sqlite = new Database(":memory:");
	for (const stmt of MIGRATION_STATEMENTS) {
		sqlite.exec(stmt);
	}
	return drizzle(sqlite, { schema }) as unknown as Db;
}

function makeFormData(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		fd.set(key, value);
	}
	return fd;
}

describe("createSongLogic", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
	});

	it("creates artist and song for valid input", async () => {
		const fd = makeFormData({
			title: "Dust in the Wind",
			artist: "Sungha Jung",
			tabContent: "e|---0---",
			capo: "2",
			notes: "Standard tuning",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({
			artistSlug: "sungha-jung",
			songSlug: "dust-in-the-wind",
		});

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(1);
		expect(artistRows[0].name).toBe("Sungha Jung");
		expect(artistRows[0].slug).toBe("sungha-jung");

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(1);
		expect(songRows[0].title).toBe("Dust in the Wind");
		expect(songRows[0].slug).toBe("dust-in-the-wind");
		expect(songRows[0].tabContent).toBe("e|---0---");
		expect(songRows[0].capo).toBe(2);
		expect(songRows[0].notes).toBe("Standard tuning");
		expect(songRows[0].createdAt).toBeTruthy();
		expect(songRows[0].updatedAt).toBeTruthy();
	});

	it("returns error for duplicate song slug under same artist", async () => {
		const fd = makeFormData({
			title: "Amber",
			artist: "Sungha Jung",
			tabContent: "e|---0---",
		});

		await createSongLogic(db, fd);

		counter = 0;
		const fd2 = makeFormData({
			title: "Amber",
			artist: "Sungha Jung",
			tabContent: "e|---1---",
		});

		const result = await createSongLogic(db, fd2);

		expect(result).toEqual({
			error: "A song with this title already exists for this artist.",
		});
	});

	it("returns error when required fields are missing", async () => {
		const noTitle = await createSongLogic(
			db,
			makeFormData({ artist: "X", tabContent: "tab" }),
		);
		expect(noTitle).toEqual({
			error: "Title, artist, and tab content are required.",
		});

		const noArtist = await createSongLogic(
			db,
			makeFormData({ title: "X", tabContent: "tab" }),
		);
		expect(noArtist).toEqual({
			error: "Title, artist, and tab content are required.",
		});

		const noTab = await createSongLogic(
			db,
			makeFormData({ title: "X", artist: "Y" }),
		);
		expect(noTab).toEqual({
			error: "Title, artist, and tab content are required.",
		});
	});

	it("returns error when capo is out of range", async () => {
		const fd = makeFormData({
			title: "Song",
			artist: "Artist",
			tabContent: "tab",
			capo: "15",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({ error: "Capo must be between 0 and 12." });
	});

	it("reuses existing artist without duplication", async () => {
		const fd1 = makeFormData({
			title: "Song One",
			artist: "Sungha Jung",
			tabContent: "tab1",
		});
		await createSongLogic(db, fd1);

		const fd2 = makeFormData({
			title: "Song Two",
			artist: "Sungha Jung",
			tabContent: "tab2",
		});
		await createSongLogic(db, fd2);

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(1);

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(2);
		expect(songRows[0].artistId).toBe(songRows[1].artistId);
	});

	it("returns error when artist name collides on slug with existing artist", async () => {
		await createSongLogic(
			db,
			makeFormData({
				title: "Song A",
				artist: "Foo Bar",
				tabContent: "tab",
			}),
		);

		const result = await createSongLogic(
			db,
			makeFormData({
				title: "Song B",
				artist: "Foo--Bar",
				tabContent: "tab",
			}),
		);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Foo Bar");
	});
});

async function seedSong(
	db: Db,
	fields: { title: string; artist: string; tabContent?: string },
) {
	const fd = makeFormData({
		title: fields.title,
		artist: fields.artist,
		tabContent: fields.tabContent ?? "e|---0---",
	});
	const result = await createSongLogic(db, fd);
	if ("error" in result) throw new Error(result.error);

	const songRows = await (db as unknown as ReturnType<typeof drizzle>)
		.select()
		.from(songs);
	const song = songRows.find(
		(s: { title: string }) => s.title === fields.title,
	);
	if (!song) throw new Error("Song not found after seed");
	return song;
}

describe("updateSongLogic", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
	});

	it("valid update changes title and slug", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		const fd = makeFormData({
			title: "Gravity",
			artist: "Sungha Jung",
			tabContent: "e|---1---",
		});

		const result = await updateSongLogic(db, song.id, fd);

		expect(result).toEqual({
			artistSlug: "sungha-jung",
			songSlug: "gravity",
		});

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(1);
		expect(songRows[0].title).toBe("Gravity");
		expect(songRows[0].slug).toBe("gravity");
		expect(songRows[0].tabContent).toBe("e|---1---");
	});

	it("artist rename upserts new artist and cleans orphaned artist", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		const fd = makeFormData({
			title: "Amber",
			artist: "Tommy Emmanuel",
			tabContent: "e|---0---",
		});

		const result = await updateSongLogic(db, song.id, fd);

		expect(result).toEqual({
			artistSlug: "tommy-emmanuel",
			songSlug: "amber",
		});

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(1);
		expect(artistRows[0].name).toBe("Tommy Emmanuel");
	});

	it("artist rename keeps old artist when other songs remain", async () => {
		await seedSong(db, { title: "Amber", artist: "Sungha Jung" });
		const song2 = await seedSong(db, {
			title: "Gravity",
			artist: "Sungha Jung",
		});

		const fd = makeFormData({
			title: "Gravity",
			artist: "Tommy Emmanuel",
			tabContent: "e|---0---",
		});

		await updateSongLogic(db, song2.id, fd);

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(2);
		expect(artistRows.map((a: { name: string }) => a.name).sort()).toEqual([
			"Sungha Jung",
			"Tommy Emmanuel",
		]);
	});

	it("returns error for missing required fields", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		const result = await updateSongLogic(
			db,
			song.id,
			makeFormData({ artist: "X", tabContent: "tab" }),
		);
		expect(result).toEqual({
			error: "Title, artist, and tab content are required.",
		});
	});

	it("returns error for song slug conflict", async () => {
		await seedSong(db, { title: "Amber", artist: "Sungha Jung" });
		const song2 = await seedSong(db, {
			title: "Gravity",
			artist: "Sungha Jung",
		});

		const fd = makeFormData({
			title: "Amber",
			artist: "Sungha Jung",
			tabContent: "e|---0---",
		});

		const result = await updateSongLogic(db, song2.id, fd);

		expect(result).toEqual({
			error: "A song with this title already exists for this artist.",
		});
	});
});

describe("deleteSongLogic", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
	});

	it("deletes song and orphaned artist", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		const result = await deleteSongLogic(db, song.id);

		expect(result).toEqual({ success: true });

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(0);

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(0);
	});

	it("does not delete artist with remaining songs", async () => {
		await seedSong(db, { title: "Amber", artist: "Sungha Jung" });
		const song2 = await seedSong(db, {
			title: "Gravity",
			artist: "Sungha Jung",
		});

		const result = await deleteSongLogic(db, song2.id);

		expect(result).toEqual({ success: true });

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(1);
		expect(songRows[0].title).toBe("Amber");

		const artistRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(artists);
		expect(artistRows).toHaveLength(1);
		expect(artistRows[0].name).toBe("Sungha Jung");
	});
});
