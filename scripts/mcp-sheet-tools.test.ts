import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "../src/db/schema";
import { songs } from "../src/db/schema";

vi.mock("@cloudflare/next-on-pages", () => ({
  getRequestContext: vi.fn(() => ({ env: {} })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let counter = 0;
vi.mock("@/lib/nanoid", () => ({
  generateId: () => `test-id-${++counter}`,
}));

// eslint-disable-next-line -- must be after mocks
const { addSheet, listSheets, updateSheet } = await import(
  "./mcp-sheet-tools"
);

type Db = Parameters<typeof addSheet>[0];

// Same in-memory schema as src/app/actions.test.ts.
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
    \`difficulty\` text,
    \`key\` text,
    \`source_url\` text,
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

let db: Db;

beforeEach(() => {
  counter = 0;
  db = createTestDb();
});

describe("addSheet", () => {
  it("creates a song with metadata through createSongLogic", async () => {
    const result = await addSheet(db, {
      title: "River Flows in You",
      artist: "Yiruma",
      instrument: "piano",
      content: "X:1\nT:River Flows in You\nK:A\n",
      difficulty: "intermediate",
      key: "A",
      sourceUrl: "https://example.com/river",
      notes: "Play softly",
    });

    expect(result).toEqual({
      instrument: "piano",
      artistSlug: "yiruma",
      songSlug: "river-flows-in-you",
    });

    const rows = await (db as unknown as ReturnType<typeof drizzle>)
      .select()
      .from(songs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "River Flows in You",
      instrument: "piano",
      difficulty: "intermediate",
      key: "A",
      sourceUrl: "https://example.com/river",
      notes: "Play softly",
      capo: null,
    });
  });

  it("returns the error from createSongLogic on duplicates instead of throwing", async () => {
    const input = {
      title: "Dust in the Wind",
      artist: "Kansas",
      instrument: "guitar" as const,
      content: "e|---0---",
    };

    expect(await addSheet(db, input)).toEqual({
      instrument: "guitar",
      artistSlug: "kansas",
      songSlug: "dust-in-the-wind",
    });
    expect(await addSheet(db, input)).toEqual({
      error: "A song with this title already exists for this artist.",
    });
  });
});

describe("listSheets", () => {
  beforeEach(async () => {
    await addSheet(db, {
      title: "Blackbird",
      artist: "The Beatles",
      instrument: "guitar",
      content: "e|---0---",
      difficulty: "intermediate",
      key: "G",
    });
    await addSheet(db, {
      title: "Let It Be",
      artist: "The Beatles",
      instrument: "piano",
      content: "X:1\nK:C\n",
    });
    await addSheet(db, {
      title: "Fur Elise",
      artist: "Beethoven",
      instrument: "piano",
      content: "X:1\nK:Am\n",
    });
  });

  it("returns metadata without content, filtered by instrument and artist", async () => {
    const all = await listSheets(db);
    expect(all).toHaveLength(3);
    expect(all[0]).toEqual({
      id: expect.any(String),
      title: "Blackbird",
      artist: "The Beatles",
      instrument: "guitar",
      slug: "blackbird",
      difficulty: "intermediate",
      key: "G",
    });
    expect(all[0]).not.toHaveProperty("content");

    const piano = await listSheets(db, { instrument: "piano" });
    expect(piano.map((s) => s.title)).toEqual(["Fur Elise", "Let It Be"]);

    // Artist filter accepts a display name or a slug.
    const beatles = await listSheets(db, { artist: "The Beatles" });
    expect(beatles).toHaveLength(2);
    const beatlesPiano = await listSheets(db, {
      artist: "the-beatles",
      instrument: "piano",
    });
    expect(beatlesPiano.map((s) => s.title)).toEqual(["Let It Be"]);
  });

  it("returns an empty array when no songs match", async () => {
    expect(await listSheets(db, { artist: "Nobody" })).toEqual([]);
  });
});

describe("updateSheet", () => {
  it("applies a partial update, keeping unspecified fields", async () => {
    await addSheet(db, {
      title: "Blackbird",
      artist: "The Beatles",
      instrument: "guitar",
      content: "e|---0---",
      capo: 2,
      notes: "Fingerstyle",
      key: "G",
    });
    const [song] = await listSheets(db);

    const result = await updateSheet(db, {
      id: song.id,
      difficulty: "advanced",
      content: "e|---3---",
    });

    expect(result).toEqual({
      instrument: "guitar",
      artistSlug: "the-beatles",
      songSlug: "blackbird",
    });

    const rows = await (db as unknown as ReturnType<typeof drizzle>)
      .select()
      .from(songs);
    expect(rows[0]).toMatchObject({
      title: "Blackbird",
      content: "e|---3---",
      capo: 2,
      notes: "Fingerstyle",
      difficulty: "advanced",
      key: "G",
    });
  });

  it("returns an error for an unknown id", async () => {
    expect(await updateSheet(db, { id: "missing", title: "X" })).toEqual({
      error: "Song not found.",
    });
  });

  it("rejects changing the instrument", async () => {
    await addSheet(db, {
      title: "Blackbird",
      artist: "The Beatles",
      instrument: "guitar",
      content: "e|---0---",
    });
    const [song] = await listSheets(db);

    expect(await updateSheet(db, { id: song.id, instrument: "piano" })).toEqual(
      { error: "Instrument cannot be changed after creation." },
    );
  });
});
