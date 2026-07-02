import { describe, expect, it, vi } from "vitest";

import {
	getArtistBySlug,
	getSongBySlugs,
	getSongCountsByInstrument,
	getSongsByArtistId,
} from "./queries";

function mockDb(rows: Record<string, unknown>[]) {
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(rows),
	};
	chain.select.mockReturnValue(chain);
	return chain as unknown as Parameters<typeof getArtistBySlug>[0];
}

function mockDbList(rows: Record<string, unknown>[]) {
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue(rows),
	};
	chain.select.mockReturnValue(chain);
	return chain as unknown as Parameters<typeof getSongsByArtistId>[0];
}

describe("getArtistBySlug", () => {
	it("returns the artist when found", async () => {
		const artist = { id: "abc123", name: "Sungha Jung", slug: "sungha-jung" };
		const db = mockDb([artist]);

		const result = await getArtistBySlug(db, "sungha-jung");
		expect(result).toEqual(artist);
	});

	it("returns null when not found", async () => {
		const db = mockDb([]);

		const result = await getArtistBySlug(db, "nonexistent");
		expect(result).toBeNull();
	});
});

describe("getSongsByArtistId", () => {
	it("returns songs ordered by title", async () => {
		const songs = [
			{ id: "s1", title: "Amber", slug: "amber", capo: null },
			{ id: "s2", title: "Breeze", slug: "breeze", capo: 2 },
		];
		const db = mockDbList(songs);

		const result = await getSongsByArtistId(db, "abc123", "guitar");
		expect(result).toEqual(songs);
	});

	it("returns empty array when artist has no songs", async () => {
		const db = mockDbList([]);

		const result = await getSongsByArtistId(db, "abc123", "guitar");
		expect(result).toEqual([]);
	});
});

describe("getSongBySlugs", () => {
	it("returns the song when found", async () => {
		const song = {
			id: "s1",
			title: "Dust in the Wind",
			content: "e|---0---",
			capo: 2,
			notes: "Standard tuning",
			artistName: "Sungha Jung",
			artistSlug: "sungha-jung",
		};
		const db = mockDb([song]);

		const result = await getSongBySlugs(
			db,
			"sungha-jung",
			"dust-in-the-wind",
			"guitar",
		);
		expect(result).toEqual(song);
	});

	it("returns null when not found", async () => {
		const db = mockDb([]);

		const result = await getSongBySlugs(
			db,
			"sungha-jung",
			"nonexistent",
			"guitar",
		);
		expect(result).toBeNull();
	});
});

function mockDbGroupBy(rows: Record<string, unknown>[]) {
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		groupBy: vi.fn().mockResolvedValue(rows),
	};
	chain.select.mockReturnValue(chain);
	return chain as unknown as Parameters<typeof getSongCountsByInstrument>[0];
}

describe("getSongCountsByInstrument", () => {
	it("maps grouped rows to guitar and piano counts", async () => {
		const db = mockDbGroupBy([
			{ instrument: "guitar", total: 21 },
			{ instrument: "piano", total: 3 },
		]);

		const result = await getSongCountsByInstrument(db);
		expect(result).toEqual({ guitar: 21, piano: 3 });
	});

	it("defaults missing instruments to zero and ignores unknown values", async () => {
		const db = mockDbGroupBy([{ instrument: "drums", total: 5 }]);

		const result = await getSongCountsByInstrument(db);
		expect(result).toEqual({ guitar: 0, piano: 0 });
	});
});
