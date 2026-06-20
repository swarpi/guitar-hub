interface SongForGrouping {
	readonly title: string;
}

export interface SongSection<T extends SongForGrouping> {
	readonly letter: string;
	readonly songs: T[];
}

export function groupSongsByLetter<T extends SongForGrouping>(
	songs: readonly T[],
): SongSection<T>[] {
	const map = new Map<string, T[]>();

	for (const song of songs) {
		const firstChar = song.title[0] ?? "";
		const letter = /^[A-Za-z]$/.test(firstChar) ? firstChar.toUpperCase() : "#";
		const existing = map.get(letter);
		if (existing) {
			existing.push(song);
		} else {
			map.set(letter, [song]);
		}
	}

	return Array.from(map.entries())
		.sort(([a], [b]) => {
			if (a === "#") return 1;
			if (b === "#") return -1;
			return a.localeCompare(b);
		})
		.map(([letter, songs]) => ({ letter, songs }));
}
