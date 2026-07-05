import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { generateId } from "../lib/nanoid";
import { slugify } from "../lib/slugify";
import * as schema from "./schema";
import { SEED_SONGS } from "./seed-data";

const DB_PATH =
	process.env.DB_PATH ??
	resolve(
		import.meta.dirname,
		"../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/3c9bc9ebbf8d47b6582e4d8b0a036070724f940ae907dc856bcd6db3600bc2d6.sqlite",
	);

const sqlite = new Database(DB_PATH);
const migrationSql = readFileSync(
	resolve(import.meta.dirname, "../../migrations/0000_initial.sql"),
	"utf-8",
);
for (const stmt of migrationSql.split("--> statement-breakpoint")) {
	const trimmed = stmt.trim();
	if (trimmed) sqlite.exec(trimmed);
}

const db = drizzle(sqlite, { schema });

const now = new Date().toISOString();
const artistIds = new Map<string, string>();

const uniqueArtists = [...new Set(SEED_SONGS.map((s) => s.artist))];
for (const name of uniqueArtists) {
	const id = generateId();
	artistIds.set(name, id);
	db.insert(schema.artists)
		.values({ id, name, slug: slugify(name), createdAt: now, updatedAt: now })
		.run();
}

for (const song of SEED_SONGS) {
	const artistId = artistIds.get(song.artist) as string;
	db.insert(schema.songs)
		.values({
			id: generateId(),
			artistId,
			title: song.title,
			slug: slugify(song.title),
			content: song.tab,
			capo: song.capo,
			notes: song.notes,
			createdAt: now,
			updatedAt: now,
		})
		.run();
}

const artistCount = db.select().from(schema.artists).all().length;
const songCount = db.select().from(schema.songs).all().length;

console.log(
	`Seeded ${artistCount} artists and ${songCount} songs into ${DB_PATH}`,
);

sqlite.close();
