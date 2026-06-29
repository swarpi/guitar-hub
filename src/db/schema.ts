import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const artists = sqliteTable("artists", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	slug: text("slug").notNull().unique(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const songs = sqliteTable(
	"songs",
	{
		id: text("id").primaryKey(),
		artistId: text("artist_id")
			.notNull()
			.references(() => artists.id),
		instrument: text("instrument").notNull().default("guitar"),
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		content: text("content").notNull(),
		capo: integer("capo"),
		notes: text("notes"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		unique("songs_artist_slug_instrument_unique").on(
			table.artistId,
			table.slug,
			table.instrument,
		),
	],
);
