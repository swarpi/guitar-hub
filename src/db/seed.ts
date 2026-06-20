import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { generateId } from "../lib/nanoid";
import { slugify } from "../lib/slugify";
import * as schema from "./schema";

const DB_PATH =
	process.env.DB_PATH ??
	resolve(
		import.meta.dirname,
		"../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/3c9bc9ebbf8d47b6582e4d8b0a036070724f940ae907dc856bcd6db3600bc2d6.sqlite",
	);

const TABS = {
	a: `e|-------0---------------------------------0------1p0-1---5---
B|--1p0--1------0--------------------------1--1-----------3---
G|----------2-0----0-2p0-2----2-0----0---------2-----------
D|------2---------0-----------3---------2------0-----------
A|------0---------------------------------------------------
E|----------3------1--------------------------------------------`,
	b: `e|---0-----0-----3-----3-----0-----0-----2-----2---
B|-----1-----1-----0-----0-----1-----1-----3-----3-
G|-------0-----0-----0-----0-----2-----2-----2-----
D|---------2-------------------------------------0-
A|-3-----------------2-----------0-----------------
E|-------------------------3-----------------------`,
	c: `e|--------------------5-7-5------------------------
B|----5-6-5--------------------8-6-5----5-6-5------
G|-5-----------5-7-------------------5----------5-7
D|-----------7-------------------------------------
A|-------------------------------------------------
E|-------------------------------------------------`,
	d: `e|-0h2-3-2-0---------------0h2-3-2-0----------------
B|-----------3-1-0------------------3-1-0-----------
G|-----------------2-0-2------------------2-0-2-----
D|-------------------------------------------------
A|-2-----------------------2-----------------------
E|-------------------------------------------------`,
};

const SEED_SONGS = [
	{
		title: "Amber Light",
		artist: "August Wren",
		capo: 2,
		tab: TABS.a,
		notes: "Let the open strings ring through the second bar.",
	},
	{
		title: "Riverbend",
		artist: "August Wren",
		capo: null,
		tab: TABS.b,
		notes: null,
	},
	{
		title: "Slow Tide",
		artist: "August Wren",
		capo: 4,
		tab: TABS.c,
		notes: null,
	},
	{
		title: "Harbor Lullaby",
		artist: "Coastline Avenue",
		capo: 3,
		tab: TABS.d,
		notes: "Played fingerstyle — thumb keeps a steady bass.",
	},
	{
		title: "Saltwater",
		artist: "Coastline Avenue",
		capo: null,
		tab: TABS.a,
		notes: null,
	},
	{
		title: "Cedar Room",
		artist: "Delia Marsh",
		capo: 5,
		tab: TABS.b,
		notes: null,
	},
	{
		title: "First Frost",
		artist: "Delia Marsh",
		capo: null,
		tab: TABS.c,
		notes: null,
	},
	{
		title: "Letters Home",
		artist: "Delia Marsh",
		capo: 2,
		tab: TABS.d,
		notes: "The pull-offs in the third line should feel loose.",
	},
	{
		title: "Wildflower",
		artist: "Delia Marsh",
		capo: 7,
		tab: TABS.a,
		notes: null,
	},
	{
		title: "Embers",
		artist: "Hollow Pines",
		capo: null,
		tab: TABS.b,
		notes: null,
	},
	{
		title: "Northbound",
		artist: "Hollow Pines",
		capo: 3,
		tab: TABS.c,
		notes: null,
	},
	{
		title: "Departure",
		artist: "Jun Park",
		capo: null,
		tab: TABS.d,
		notes: null,
	},
	{
		title: "Morning Rain",
		artist: "Jun Park",
		capo: 2,
		tab: TABS.a,
		notes: "Quiet and even — no rushing the descending run.",
	},
	{
		title: "Paper Crane",
		artist: "Jun Park",
		capo: 4,
		tab: TABS.b,
		notes: null,
	},
	{
		title: "Luz",
		artist: "Mira Castellanos",
		capo: null,
		tab: TABS.c,
		notes: null,
	},
	{
		title: "Verano",
		artist: "Mira Castellanos",
		capo: 5,
		tab: TABS.d,
		notes: null,
	},
	{
		title: "Driftwood",
		artist: "The Paper Lanterns",
		capo: null,
		tab: TABS.a,
		notes: null,
	},
	{
		title: "Festival",
		artist: "The Paper Lanterns",
		capo: 2,
		tab: TABS.b,
		notes: null,
	},
	{
		title: "Glass Hours",
		artist: "Soren Vale",
		capo: 3,
		tab: TABS.c,
		notes: null,
	},
	{
		title: "Quiet Engine",
		artist: "Soren Vale",
		capo: null,
		tab: TABS.d,
		notes: null,
	},
	{
		title: "Winterlight",
		artist: "Soren Vale",
		capo: 6,
		tab: TABS.a,
		notes: "Tune low E to D for the final phrase.",
	},
];

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
			tabContent: song.tab,
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
