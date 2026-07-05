import { SEED_SONGS } from "../src/db/seed-data";
import { generateId } from "../src/lib/nanoid";
import { slugify } from "../src/lib/slugify";

function escSql(s: string): string {
	return s.replace(/'/g, "''");
}

function sqlVal(v: string | number | null): string {
	if (v === null) return "NULL";
	if (typeof v === "number") return String(v);
	return `'${escSql(v)}'`;
}

const now = new Date().toISOString();
const artistIds = new Map<string, string>();
const lines: string[] = [];

const uniqueArtists = [...new Set(SEED_SONGS.map((s) => s.artist))];
for (const name of uniqueArtists) {
	const id = generateId();
	artistIds.set(name, id);
	lines.push(
		`INSERT INTO artists (id, name, slug, created_at, updated_at) VALUES (${sqlVal(id)}, ${sqlVal(name)}, ${sqlVal(slugify(name))}, ${sqlVal(now)}, ${sqlVal(now)});`,
	);
}

lines.push("");

for (const song of SEED_SONGS) {
	const artistId = artistIds.get(song.artist)!;
	lines.push(
		`INSERT INTO songs (id, artist_id, title, slug, tab_content, capo, notes, created_at, updated_at) VALUES (${sqlVal(generateId())}, ${sqlVal(artistId)}, ${sqlVal(song.title)}, ${sqlVal(slugify(song.title))}, ${sqlVal(song.tab)}, ${sqlVal(song.capo)}, ${sqlVal(song.notes)}, ${sqlVal(now)}, ${sqlVal(now)});`,
	);
}

console.log(lines.join("\n"));
