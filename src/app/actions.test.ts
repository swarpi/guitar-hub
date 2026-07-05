import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllSongsFlat, getSongsByInstrument } from "@/db/queries";
import * as schema from "@/db/schema";
import { artists, songs } from "@/db/schema";

vi.mock("@cloudflare/next-on-pages", () => ({
	getRequestContext: vi.fn(() => ({ env: {} })),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/db/client", () => ({
	getDb: vi.fn(() => currentDb),
}));

// eslint-disable-next-line -- must be after mocks
const {
	createSongLogic,
	updateSongLogic,
	deleteSongLogic,
	createSong,
	updateSong,
	deleteSong,
} = await import("./actions");

type Db = Parameters<typeof createSongLogic>[0];

// Handed to the mocked getDb so wrapper tests run against the in-memory db.
let currentDb: Db;

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
		\`instrument\` text NOT NULL DEFAULT 'guitar',
		\`title\` text NOT NULL,
		\`slug\` text NOT NULL,
		\`content\` text NOT NULL,
		\`capo\` integer,
		\`notes\` text,
		\`created_at\` text NOT NULL,
		\`updated_at\` text NOT NULL,
		FOREIGN KEY (\`artist_id\`) REFERENCES \`artists\`(\`id\`) ON UPDATE no action ON DELETE no action
	)`,
	"CREATE UNIQUE INDEX `songs_artist_slug_instrument_unique` ON `songs` (`artist_id`,`slug`,`instrument`)",
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
			content: "e|---0---",
			capo: "2",
			notes: "Standard tuning",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({
			instrument: "guitar",
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
		expect(songRows[0].content).toBe("e|---0---");
		expect(songRows[0].capo).toBe(2);
		expect(songRows[0].notes).toBe("Standard tuning");
		expect(songRows[0].createdAt).toBeTruthy();
		expect(songRows[0].updatedAt).toBeTruthy();
	});

	it("returns error for duplicate song slug under same artist", async () => {
		const fd = makeFormData({
			title: "Amber",
			artist: "Sungha Jung",
			content: "e|---0---",
		});

		await createSongLogic(db, fd);

		counter = 0;
		const fd2 = makeFormData({
			title: "Amber",
			artist: "Sungha Jung",
			content: "e|---1---",
		});

		const result = await createSongLogic(db, fd2);

		expect(result).toEqual({
			error: "A song with this title already exists for this artist.",
		});
	});

	it("returns error when required fields are missing", async () => {
		const noTitle = await createSongLogic(
			db,
			makeFormData({ artist: "X", content: "tab" }),
		);
		expect(noTitle).toEqual({
			error: "Title, artist, and content are required.",
		});

		const noArtist = await createSongLogic(
			db,
			makeFormData({ title: "X", content: "tab" }),
		);
		expect(noArtist).toEqual({
			error: "Title, artist, and content are required.",
		});

		const noTab = await createSongLogic(
			db,
			makeFormData({ title: "X", artist: "Y" }),
		);
		expect(noTab).toEqual({
			error: "Title, artist, and content are required.",
		});
	});

	it("returns error when capo is out of range", async () => {
		const fd = makeFormData({
			title: "Song",
			artist: "Artist",
			content: "tab",
			capo: "15",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({ error: "Capo must be between 0 and 12." });
	});

	it("reuses existing artist without duplication", async () => {
		const fd1 = makeFormData({
			title: "Song One",
			artist: "Sungha Jung",
			content: "tab1",
		});
		await createSongLogic(db, fd1);

		const fd2 = makeFormData({
			title: "Song Two",
			artist: "Sungha Jung",
			content: "tab2",
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

	it("creates a song with instrument piano", async () => {
		const fd = makeFormData({
			title: "River Flows in You",
			artist: "Yiruma",
			content: "X:1\nT:River Flows in You",
			instrument: "piano",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({
			instrument: "piano",
			artistSlug: "yiruma",
			songSlug: "river-flows-in-you",
		});

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(1);
		expect(songRows[0].instrument).toBe("piano");
	});

	it("returns error for invalid instrument", async () => {
		const fd = makeFormData({
			title: "Song",
			artist: "Artist",
			content: "tab",
			instrument: "drums",
		});

		const result = await createSongLogic(db, fd);

		expect(result).toEqual({ error: "Instrument must be guitar or piano." });
	});

	it("allows same artist and title under different instruments", async () => {
		const guitarResult = await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "e|---0---",
				instrument: "guitar",
			}),
		);
		expect(guitarResult).toEqual({
			instrument: "guitar",
			artistSlug: "yiruma",
			songSlug: "river-flows-in-you",
		});

		const pianoResult = await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:1\nT:River Flows in You",
				instrument: "piano",
			}),
		);
		expect(pianoResult).toEqual({
			instrument: "piano",
			artistSlug: "yiruma",
			songSlug: "river-flows-in-you",
		});

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(2);
		expect(songRows[0].artistId).toBe(songRows[1].artistId);
		expect(songRows[0].slug).toBe(songRows[1].slug);
		expect(songRows.map((s) => s.instrument).sort()).toEqual([
			"guitar",
			"piano",
		]);
	});

	it("returns error for duplicate song under the same instrument", async () => {
		await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:1",
				instrument: "piano",
			}),
		);

		const result = await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:2",
				instrument: "piano",
			}),
		);

		expect(result).toEqual({
			error: "A song with this title already exists for this artist.",
		});
	});

	it("returns error when artist name collides on slug with existing artist", async () => {
		await createSongLogic(
			db,
			makeFormData({
				title: "Song A",
				artist: "Foo Bar",
				content: "tab",
			}),
		);

		const result = await createSongLogic(
			db,
			makeFormData({
				title: "Song B",
				artist: "Foo--Bar",
				content: "tab",
			}),
		);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Foo Bar");
	});
});

async function seedSong(
	db: Db,
	fields: {
		title: string;
		artist: string;
		content?: string;
		instrument?: string;
	},
) {
	const fd = makeFormData({
		title: fields.title,
		artist: fields.artist,
		content: fields.content ?? "e|---0---",
		...(fields.instrument ? { instrument: fields.instrument } : {}),
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
			content: "e|---1---",
		});

		const result = await updateSongLogic(db, song.id, fd);

		expect(result).toEqual({
			instrument: "guitar",
			artistSlug: "sungha-jung",
			songSlug: "gravity",
		});

		const songRows = await (db as unknown as ReturnType<typeof drizzle>)
			.select()
			.from(songs);
		expect(songRows).toHaveLength(1);
		expect(songRows[0].title).toBe("Gravity");
		expect(songRows[0].slug).toBe("gravity");
		expect(songRows[0].content).toBe("e|---1---");
	});

	it("artist rename upserts new artist and cleans orphaned artist", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		const fd = makeFormData({
			title: "Amber",
			artist: "Tommy Emmanuel",
			content: "e|---0---",
		});

		const result = await updateSongLogic(db, song.id, fd);

		expect(result).toEqual({
			instrument: "guitar",
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
			content: "e|---0---",
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
			makeFormData({ artist: "X", content: "tab" }),
		);
		expect(result).toEqual({
			error: "Title, artist, and content are required.",
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
			content: "e|---0---",
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

		expect(result).toEqual({ success: true, instrument: "guitar" });

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

		expect(result).toEqual({ success: true, instrument: "guitar" });

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

describe("action wrappers", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
		currentDb = db;
		vi.clearAllMocks();
	});

	it("createSong redirects to the instrument-prefixed song path", async () => {
		await createSong(
			makeFormData({
				title: "Amber",
				artist: "Sungha Jung",
				content: "e|---0---",
			}),
		);

		expect(redirect).toHaveBeenCalledWith("/guitar/sungha-jung/amber");
	});

	it("createSong redirects to /piano/... for piano songs", async () => {
		await createSong(
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:1",
				instrument: "piano",
			}),
		);

		expect(redirect).toHaveBeenCalledWith("/piano/yiruma/river-flows-in-you");
	});

	it("createSong returns the error without redirecting", async () => {
		const result = await createSong(makeFormData({ title: "X", artist: "Y" }));

		expect(result).toEqual({
			error: "Title, artist, and content are required.",
		});
		expect(redirect).not.toHaveBeenCalled();
	});

	it("updateSong redirects to the instrument-prefixed song path", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		await updateSong(
			makeFormData({
				songId: song.id,
				title: "Gravity",
				artist: "Sungha Jung",
				content: "e|---1---",
			}),
		);

		expect(redirect).toHaveBeenCalledWith("/guitar/sungha-jung/gravity");
	});

	it("deleteSong revalidates and redirects to the instrument section", async () => {
		const song = await seedSong(db, {
			title: "Amber",
			artist: "Sungha Jung",
		});

		await deleteSong(makeFormData({ songId: song.id }));

		expect(revalidatePath).toHaveBeenCalledWith("/guitar");
		expect(redirect).toHaveBeenCalledWith("/guitar");
	});

	it("deleteSong revalidates and redirects to /piano for piano songs", async () => {
		const song = await seedSong(db, {
			title: "River Flows in You",
			artist: "Yiruma",
			content: "X:1",
			instrument: "piano",
		});

		await deleteSong(makeFormData({ songId: song.id }));

		expect(revalidatePath).toHaveBeenCalledWith("/piano");
		expect(redirect).toHaveBeenCalledWith("/piano");
	});
});

describe("getSongsByInstrument", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
	});

	it("returns only songs for the given instrument, ordered by title", async () => {
		await createSongLogic(
			db,
			makeFormData({
				title: "Gravity",
				artist: "Sungha Jung",
				content: "e|---0---",
			}),
		);
		await createSongLogic(
			db,
			makeFormData({
				title: "Amber",
				artist: "Sungha Jung",
				content: "e|---1---",
			}),
		);
		await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:1",
				instrument: "piano",
			}),
		);

		const guitarSongs = await getSongsByInstrument(db, "guitar");
		expect(guitarSongs.map((s) => s.title)).toEqual(["Amber", "Gravity"]);
		expect(guitarSongs[0].artistName).toBe("Sungha Jung");
		expect(guitarSongs[0].artistSlug).toBe("sungha-jung");

		const pianoSongs = await getSongsByInstrument(db, "piano");
		expect(pianoSongs.map((s) => s.title)).toEqual(["River Flows in You"]);
		expect(pianoSongs[0].artistName).toBe("Yiruma");
	});

	it("returns an empty array when no songs exist for the instrument", async () => {
		const rows = await getSongsByInstrument(db, "piano");
		expect(rows).toEqual([]);
	});
});

describe("getAllSongsFlat", () => {
	let db: Db;

	beforeEach(() => {
		counter = 0;
		db = createTestDb();
	});

	it("scopes the flat duplicate-check list to the given instrument", async () => {
		await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "e|---0---",
			}),
		);
		await createSongLogic(
			db,
			makeFormData({
				title: "River Flows in You",
				artist: "Yiruma",
				content: "X:1",
				instrument: "piano",
			}),
		);

		const guitarRows = await getAllSongsFlat(db, "guitar");
		expect(guitarRows).toEqual([
			{ title: "River Flows in You", artistName: "Yiruma" },
		]);

		const pianoRows = await getAllSongsFlat(db, "piano");
		expect(pianoRows).toHaveLength(1);
	});
});
