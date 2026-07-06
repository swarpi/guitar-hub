import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

function readMigration(name: string): string {
	// `--> statement-breakpoint` lines start with `--`, so SQLite treats them
	// as comments and the whole file can be executed in one exec() call.
	return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

describe("0002_sheet-metadata migration", () => {
	it("adds nullable columns and leaves existing rows as NULL", () => {
		const sqlite = new Database(":memory:");
		sqlite.exec(readMigration("0000_initial.sql"));
		sqlite.exec(readMigration("0001_multi-instrument.sql"));

		sqlite
			.prepare(
				`INSERT INTO artists (id, name, slug, created_at, updated_at)
				 VALUES ('a1', 'Sungha Jung', 'sungha-jung', '2026-01-01', '2026-01-01')`,
			)
			.run();
		sqlite
			.prepare(
				`INSERT INTO songs (id, artist_id, title, slug, content, created_at, updated_at)
				 VALUES ('s1', 'a1', 'Amber', 'amber', 'e|---0---', '2026-01-01', '2026-01-01')`,
			)
			.run();

		sqlite.exec(readMigration("0002_sheet-metadata.sql"));

		const row = sqlite
			.prepare('SELECT difficulty, "key", source_url FROM songs WHERE id = ?')
			.get("s1") as {
			difficulty: string | null;
			key: string | null;
			source_url: string | null;
		};

		expect(row.difficulty).toBeNull();
		expect(row.key).toBeNull();
		expect(row.source_url).toBeNull();
	});
});
