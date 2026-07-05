// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

vi.mock("@cloudflare/next-on-pages", () => ({
	getRequestContext: vi.fn(() => ({ env: {} })),
}));

vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
	redirect: vi.fn(),
}));

vi.mock("@/db/client", () => ({
	getDb: vi.fn(() => currentDb),
}));

vi.mock("@/db/queries", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/queries")>();
	return { ...actual, getAllSongsFlat: vi.fn(actual.getAllSongsFlat) };
});

// Client components with router/network dependencies are stubbed; the pages
// under test are the server components.
vi.mock("@/components/Header", () => ({
	Header: () => <div data-testid="header" />,
}));
vi.mock("@/components/FAB", () => ({
	FAB: ({ href }: { href: string }) => (
		<div data-testid="fab" data-href={href} />
	),
}));
vi.mock("@/components/AbcNotation", () => ({
	AbcNotation: ({ content }: { content: string }) => (
		<div data-testid="abc-notation">{content}</div>
	),
}));
vi.mock("@/components/AddPageClient", () => ({
	AddPageClient: ({
		instrument,
		cancelHref,
		existingSongs,
	}: {
		instrument?: string;
		cancelHref?: string;
		existingSongs: readonly unknown[];
	}) => (
		<div
			data-testid="add-page-client"
			data-instrument={instrument}
			data-cancel={cancelHref}
			data-existing={existingSongs.length}
		/>
	),
}));

const { getAllSongsFlat } = await import("@/db/queries");
const SongListPage = (await import("./page")).default;
const AddSongPage = (await import("./add/page")).default;
const EditSongPage = (await import("./edit/[songId]/page")).default;
const ArtistPage = (await import("./[artistSlug]/page")).default;
const SongPage = (await import("./[artistSlug]/[songSlug]/page")).default;

type Db = ReturnType<typeof makeDb>;
let currentDb: Db;

const MIGRATION_STATEMENTS = [
	`CREATE TABLE \`artists\` (
		\`id\` text PRIMARY KEY NOT NULL,
		\`name\` text NOT NULL,
		\`slug\` text NOT NULL,
		\`created_at\` text NOT NULL,
		\`updated_at\` text NOT NULL
	)`,
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
		\`updated_at\` text NOT NULL
	)`,
];

function makeDb() {
	const sqlite = new Database(":memory:");
	for (const stmt of MIGRATION_STATEMENTS) {
		sqlite.exec(stmt);
	}
	return drizzle(sqlite, { schema });
}

const NOW = "2026-07-05T00:00:00.000Z";

async function seedArtist(db: Db, name: string, slug: string, id: string) {
	await db
		.insert(schema.artists)
		.values({ id, name, slug, createdAt: NOW, updatedAt: NOW });
}

async function seedSong(
	db: Db,
	fields: {
		id: string;
		artistId: string;
		instrument: string;
		title: string;
		slug: string;
		content?: string;
		capo?: number | null;
	},
) {
	await db.insert(schema.songs).values({
		...fields,
		content: fields.content ?? "content",
		capo: fields.capo ?? null,
		notes: null,
		createdAt: NOW,
		updatedAt: NOW,
	});
}

/** Seeds one guitar song (capo 2) and one piano song (capo 3, to prove the
 *  pages ignore piano capo) under two artists. */
async function seedBoth(db: Db) {
	await seedArtist(db, "Sungha Jung", "sungha-jung", "artist-g");
	await seedArtist(db, "Yiruma", "yiruma", "artist-p");
	await seedSong(db, {
		id: "song-g",
		artistId: "artist-g",
		instrument: "guitar",
		title: "Amber",
		slug: "amber",
		content: "e|---0---",
		capo: 2,
	});
	await seedSong(db, {
		id: "song-p",
		artistId: "artist-p",
		instrument: "piano",
		title: "River Flows in You",
		slug: "river-flows-in-you",
		content: "X:1\nK:C\nCDEF|",
		capo: 3,
	});
}

const p = <T,>(value: T) => Promise.resolve(value);
const noQuery = p({} as { q?: string });

beforeEach(async () => {
	currentDb = makeDb();
	await seedBoth(currentDb);
	vi.clearAllMocks();
});

afterEach(cleanup);

describe("invalid instrument segments", () => {
	it("404s on the list route", async () => {
		await expect(
			SongListPage({
				params: p({ instrument: "banjo" }),
				searchParams: noQuery,
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("404s on the add route", async () => {
		await expect(
			AddSongPage({ params: p({ instrument: "banjo" }) }),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});
});

describe("song list page", () => {
	it("shows guitar songs with capo badges and guitar-scoped links", async () => {
		render(
			await SongListPage({
				params: p({ instrument: "guitar" }),
				searchParams: noQuery,
			}),
		);
		expect(screen.getByText("Amber")).toBeInTheDocument();
		expect(screen.getByText("Capo 2")).toBeInTheDocument();
		expect(screen.queryByText("River Flows in You")).not.toBeInTheDocument();
		expect(screen.getByTestId("fab").dataset.href).toBe("/guitar/add");
		expect(screen.getByText(/The Songbook/)).toHaveTextContent("Guitar");
	});

	it("shows piano songs without capo badges even when capo is set", async () => {
		render(
			await SongListPage({
				params: p({ instrument: "piano" }),
				searchParams: noQuery,
			}),
		);
		expect(screen.getByText("River Flows in You")).toBeInTheDocument();
		expect(screen.queryByText("Capo 3")).not.toBeInTheDocument();
		expect(screen.queryByText("Amber")).not.toBeInTheDocument();
		expect(screen.getByTestId("fab").dataset.href).toBe("/piano/add");
	});
});

describe("add page", () => {
	it("renders AddPageClient with the duplicate-check list for guitar", async () => {
		render(await AddSongPage({ params: p({ instrument: "guitar" }) }));
		const client = screen.getByTestId("add-page-client");
		expect(client.dataset.instrument).toBe("guitar");
		expect(client.dataset.cancel).toBe("/guitar");
		expect(client.dataset.existing).toBe("1");
		expect(getAllSongsFlat).toHaveBeenCalledTimes(1);
		expect(vi.mocked(getAllSongsFlat).mock.calls[0][1]).toBe("guitar");
	});

	it("renders a plain SongForm for piano and skips the duplicate query", async () => {
		render(await AddSongPage({ params: p({ instrument: "piano" }) }));
		expect(screen.queryByTestId("add-page-client")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tab Content")).toBeInTheDocument();
		const hidden = document.querySelector('input[name="instrument"]');
		expect((hidden as HTMLInputElement).value).toBe("piano");
		expect(getAllSongsFlat).not.toHaveBeenCalled();
	});
});

describe("edit page instrument guard", () => {
	it("404s when a piano song is opened under /guitar/edit", async () => {
		await expect(
			EditSongPage({ params: p({ instrument: "guitar", songId: "song-p" }) }),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("404s when a guitar song is opened under /piano/edit", async () => {
		await expect(
			EditSongPage({ params: p({ instrument: "piano", songId: "song-g" }) }),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("renders the form when the instrument matches", async () => {
		render(
			await EditSongPage({
				params: p({ instrument: "guitar", songId: "song-g" }),
			}),
		);
		expect(screen.getByText("Edit Song")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Amber")).toBeInTheDocument();
	});
});

describe("artist page", () => {
	it("renders the 0-songs state for guitar when the artist has no guitar songs", async () => {
		render(
			await ArtistPage({
				params: p({ instrument: "guitar", artistSlug: "yiruma" }),
			}),
		);
		expect(screen.getByRole("heading", { name: "Yiruma" })).toBeInTheDocument();
		expect(screen.getByText(/0 songs/)).toBeInTheDocument();
	});

	it("404s for piano when the artist has no piano songs", async () => {
		await expect(
			ArtistPage({
				params: p({ instrument: "piano", artistSlug: "sungha-jung" }),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("hides capo on piano artist listings even when capo is set", async () => {
		render(
			await ArtistPage({
				params: p({ instrument: "piano", artistSlug: "yiruma" }),
			}),
		);
		expect(screen.getByText("River Flows in You")).toBeInTheDocument();
		expect(screen.queryByText("Capo 3")).not.toBeInTheDocument();
	});
});

describe("song detail page", () => {
	it("renders a pre block and capo badge for guitar", async () => {
		render(
			await SongPage({
				params: p({
					instrument: "guitar",
					artistSlug: "sungha-jung",
					songSlug: "amber",
				}),
			}),
		);
		expect(screen.getByText("e|---0---")).toBeInTheDocument();
		expect(screen.getByText("e|---0---").tagName).toBe("PRE");
		expect(screen.getByText("Capo 2")).toBeInTheDocument();
		expect(screen.queryByTestId("abc-notation")).not.toBeInTheDocument();
		const edit = screen.getByText("Edit");
		expect(edit.closest("a")?.getAttribute("href")).toBe("/guitar/edit/song-g");
	});

	it("renders AbcNotation and no capo badge for piano", async () => {
		render(
			await SongPage({
				params: p({
					instrument: "piano",
					artistSlug: "yiruma",
					songSlug: "river-flows-in-you",
				}),
			}),
		);
		expect(screen.getByTestId("abc-notation")).toHaveTextContent("CDEF|");
		expect(document.querySelector("pre")).toBeNull();
		expect(screen.queryByText("Capo 3")).not.toBeInTheDocument();
	});

	it("404s when the song exists under the other instrument", async () => {
		await expect(
			SongPage({
				params: p({
					instrument: "piano",
					artistSlug: "sungha-jung",
					songSlug: "amber",
				}),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
