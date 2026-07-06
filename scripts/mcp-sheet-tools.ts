// Tool handlers for the sheet-ingest MCP server (ADR-0007).
//
// Each handler is a thin adapter over the existing query/action layer:
// add_sheet and update_sheet build a FormData and delegate to
// createSongLogic / updateSongLogic from src/app/actions.ts unchanged —
// validation, slug generation, and duplicate detection all live there.
// Kept separate from mcp-sheet-server.ts so the handlers can be unit-tested
// against an in-memory database (same split as url-import.ts / ai-proxy.ts).

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { createSongLogic, updateSongLogic } from "../src/app/actions";
import { getSongById } from "../src/db/queries";
import type * as schema from "../src/db/schema";
import { artists, songs } from "../src/db/schema";
import { slugify } from "../src/lib/slugify";

export type Db = DrizzleD1Database<typeof schema>;

export interface AddSheetInput {
  title: string;
  artist: string;
  instrument: "guitar" | "piano";
  content: string;
  capo?: number;
  notes?: string;
  difficulty?: string;
  key?: string;
  sourceUrl?: string;
}

export interface UpdateSheetInput extends Partial<AddSheetInput> {
  id: string;
}

export interface ListSheetsFilter {
  instrument?: "guitar" | "piano";
  artist?: string;
}

export type SheetWriteResult =
  | { error: string }
  | { instrument: string; artistSlug: string; songSlug: string };

function setIfPresent(
  fd: FormData,
  name: string,
  value: string | number | null | undefined,
) {
  if (value !== undefined && value !== null) {
    fd.set(name, String(value));
  }
}

export async function addSheet(
  db: Db,
  input: AddSheetInput,
): Promise<SheetWriteResult> {
  const fd = new FormData();
  fd.set("title", input.title);
  fd.set("artist", input.artist);
  fd.set("instrument", input.instrument);
  fd.set("content", input.content);
  setIfPresent(fd, "capo", input.capo);
  setIfPresent(fd, "notes", input.notes);
  setIfPresent(fd, "difficulty", input.difficulty);
  setIfPresent(fd, "key", input.key);
  setIfPresent(fd, "sourceUrl", input.sourceUrl);

  return createSongLogic(db, fd);
}

// Omits `content` by design: list responses are for duplicate detection and
// browsing context, and full tab/notation bodies would bloat tool output.
export async function listSheets(db: Db, filter: ListSheetsFilter = {}) {
  const conditions = [];
  if (filter.instrument) {
    conditions.push(eq(songs.instrument, filter.instrument));
  }
  if (filter.artist) {
    // Match on the slugified name so "Sungha Jung" and "sungha-jung" both work.
    conditions.push(eq(artists.slug, slugify(filter.artist)));
  }

  return db
    .select({
      id: songs.id,
      title: songs.title,
      artist: artists.name,
      instrument: songs.instrument,
      slug: songs.slug,
      difficulty: songs.difficulty,
      key: songs.key,
    })
    .from(songs)
    .innerJoin(artists, eq(songs.artistId, artists.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(songs.title));
}

export async function updateSheet(
  db: Db,
  input: UpdateSheetInput,
): Promise<SheetWriteResult> {
  const current = await getSongById(db, input.id);
  if (!current) {
    return { error: "Song not found." };
  }

  // Instrument is fixed at creation (ADR-0005); updateSongLogic ignores it,
  // so reject a mismatch instead of silently keeping the old value.
  if (input.instrument !== undefined && input.instrument !== current.instrument) {
    return { error: "Instrument cannot be changed after creation." };
  }

  // Partial update: fields not provided keep their current values.
  const fd = new FormData();
  fd.set("title", input.title ?? current.title);
  fd.set("artist", input.artist ?? current.artistName);
  fd.set("content", input.content ?? current.content);
  setIfPresent(fd, "capo", input.capo ?? current.capo);
  setIfPresent(fd, "notes", input.notes ?? current.notes);
  setIfPresent(fd, "difficulty", input.difficulty ?? current.difficulty);
  setIfPresent(fd, "key", input.key ?? current.key);
  setIfPresent(fd, "sourceUrl", input.sourceUrl ?? current.sourceUrl);

  return updateSongLogic(db, input.id, fd);
}
