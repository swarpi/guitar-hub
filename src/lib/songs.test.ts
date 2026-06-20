import { describe, expect, it } from "vitest";

import { groupSongsByLetter } from "./songs";

describe("groupSongsByLetter", () => {
	it("groups songs by their first letter", () => {
		const songs = [
			{ title: "Amber Light" },
			{ title: "Amber Rose" },
			{ title: "Cedar Room" },
			{ title: "Driftwood" },
		];
		const sections = groupSongsByLetter(songs);

		expect(sections).toHaveLength(3);
		expect(sections[0].letter).toBe("A");
		expect(sections[0].songs).toHaveLength(2);
		expect(sections[1].letter).toBe("C");
		expect(sections[2].letter).toBe("D");
	});

	it("assigns non-alpha characters to #", () => {
		const songs = [{ title: "3am" }, { title: "#1 Hit" }, { title: "Amber" }];
		const sections = groupSongsByLetter(songs);

		expect(sections).toHaveLength(2);
		expect(sections[0].letter).toBe("A");
		expect(sections[1].letter).toBe("#");
		expect(sections[1].songs).toHaveLength(2);
	});

	it("sorts # after all letters", () => {
		const songs = [{ title: "Zen" }, { title: "9 Crimes" }];
		const sections = groupSongsByLetter(songs);

		expect(sections[0].letter).toBe("Z");
		expect(sections[1].letter).toBe("#");
	});

	it("returns empty array for empty input", () => {
		const sections = groupSongsByLetter([]);
		expect(sections).toEqual([]);
	});

	it("handles lowercase first characters", () => {
		const songs = [{ title: "amber" }, { title: "Apex" }];
		const sections = groupSongsByLetter(songs);

		expect(sections).toHaveLength(1);
		expect(sections[0].letter).toBe("A");
		expect(sections[0].songs).toHaveLength(2);
	});

	it("preserves song order within each section", () => {
		const songs = [{ title: "Alpha" }, { title: "Apex" }, { title: "Amber" }];
		const sections = groupSongsByLetter(songs);

		expect(sections[0].songs.map((s) => s.title)).toEqual([
			"Alpha",
			"Apex",
			"Amber",
		]);
	});
});
