import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { artists, songs } from "./schema";

describe("artists table", () => {
	it("has expected column names", () => {
		const columns = getTableColumns(artists);
		const columnNames = Object.keys(columns);
		expect(columnNames).toEqual(
			expect.arrayContaining(["id", "name", "slug", "createdAt", "updatedAt"]),
		);
	});
});

describe("songs table", () => {
	it("has expected column names", () => {
		const columns = getTableColumns(songs);
		const columnNames = Object.keys(columns);
		expect(columnNames).toEqual(
			expect.arrayContaining([
				"id",
				"artistId",
				"instrument",
				"title",
				"slug",
				"content",
				"capo",
				"notes",
				"createdAt",
				"updatedAt",
			]),
		);
	});

	it("has foreign key reference to artists", () => {
		const config = getTableConfig(songs);
		expect(config.foreignKeys).toHaveLength(1);
		const fk = config.foreignKeys[0];
		const ref = fk.reference();
		expect(ref.foreignTable).toBe(artists);
		expect(ref.columns.map((c) => c.name)).toEqual(["artist_id"]);
		expect(ref.foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has unique constraint on artist_id, slug, and instrument", () => {
		const config = getTableConfig(songs);
		const compositeUnique = config.uniqueConstraints.find(
			(uc) => uc.columns.length === 3,
		);
		expect(compositeUnique).toBeDefined();
		const colNames = compositeUnique?.columns.map((c) => c.name);
		expect(colNames).toContain("artist_id");
		expect(colNames).toContain("slug");
		expect(colNames).toContain("instrument");
	});
});
