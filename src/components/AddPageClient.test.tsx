// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddPageClient, findDuplicate } from "./AddPageClient";
import type { SongFormInitialValues } from "./SongForm";

vi.mock("next/link", () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

const sampleFields: SongFormInitialValues = {
	title: "Dust in the Wind",
	artist: "Kansas",
	capo: 0,
	tabContent: "Am  C  G\nI close my eyes...",
	notes: null,
};

vi.mock("./ImportForm", () => ({
	ImportForm: ({
		onExtracted,
		onUseManual,
	}: {
		onExtracted: (fields: SongFormInitialValues) => void;
		onUseManual: () => void;
	}) => (
		<div>
			<button
				type="button"
				onClick={() =>
					onExtracted({
						title: "Dust in the Wind",
						artist: "Kansas",
						capo: 0,
						tabContent: "Am  C  G\nI close my eyes...",
						notes: null,
					})
				}
			>
				Extract
			</button>
			<button type="button" onClick={onUseManual}>
				Use manual entry
			</button>
		</div>
	),
}));

const mockAction = vi.fn();
const artistNames = ["Sungha Jung", "Tommy Emmanuel"];
const existingSongs = [
	{ title: "Dust in the Wind", artistName: "Kansas" },
	{ title: "Hotel California", artistName: "Eagles" },
];

describe("AddPageClient", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("renders mode toggle with Manual active by default", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /manual$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /import via ai/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
	});

	it("renders the ImportForm when switching to import mode", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));

		expect(
			screen.getByRole("button", { name: /extract/i }),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/song title/i)).not.toBeInTheDocument();
	});

	it("switches back to manual mode from import", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		expect(screen.queryByLabelText(/song title/i)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /^manual$/i }));
		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
	});

	it("switches to manual mode when the ImportForm calls onUseManual", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /use manual entry/i }));

		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /extract/i }),
		).not.toBeInTheDocument();
	});

	it("enters review state when onExtracted is called", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));

		expect(screen.getByLabelText(/song title/i)).toHaveValue(
			sampleFields.title,
		);
		expect(screen.getByLabelText(/artist/i)).toHaveValue(sampleFields.artist);
		expect(
			screen.getByRole("button", { name: /back to import/i }),
		).toBeInTheDocument();
	});

	it("exits review state when Back to Import is clicked", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));

		expect(screen.getByLabelText(/song title/i)).toHaveValue(
			sampleFields.title,
		);

		fireEvent.click(screen.getByRole("button", { name: /back to import/i }));

		expect(
			screen.queryByRole("button", { name: /back to import/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /extract/i }),
		).toBeInTheDocument();
	});

	it("clears extracted fields when switching to manual mode from review", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));
		expect(screen.getByLabelText(/song title/i)).toHaveValue(
			sampleFields.title,
		);

		fireEvent.click(screen.getByRole("button", { name: /^manual$/i }));
		expect(screen.getByLabelText(/song title/i)).toHaveValue("");

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		expect(
			screen.getByRole("button", { name: /extract/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /back to import/i }),
		).not.toBeInTheDocument();
	});

	it("shows duplicate warning banner when extracted song matches an existing song", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));

		expect(
			screen.getByText(/may already exist in your songbook/i),
		).toBeInTheDocument();
		expect(screen.getByText(/Dust in the Wind/)).toBeInTheDocument();
		expect(screen.getByText(/Kansas/)).toBeInTheDocument();
	});

	it("does not show duplicate warning banner when no match exists", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={[
					{ title: "Stairway to Heaven", artistName: "Led Zeppelin" },
				]}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));

		expect(
			screen.queryByText(/may already exist in your songbook/i),
		).not.toBeInTheDocument();
	});

	it("does not show duplicate warning banner with empty existingSongs", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={[]}
				action={mockAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /extract/i }));

		expect(
			screen.queryByText(/may already exist in your songbook/i),
		).not.toBeInTheDocument();
	});

	it("does not show duplicate warning banner in manual mode", () => {
		render(
			<AddPageClient
				artistNames={artistNames}
				existingSongs={existingSongs}
				action={mockAction}
			/>,
		);

		expect(
			screen.queryByText(/may already exist in your songbook/i),
		).not.toBeInTheDocument();
	});
});

describe("findDuplicate", () => {
	const songs = [
		{ title: "Dust in the Wind", artistName: "Kansas" },
		{ title: "Hotel California", artistName: "Eagles" },
	];

	it("finds a case-insensitive match on both title and artist", () => {
		const result = findDuplicate(
			{
				title: "dust IN THE wind",
				artist: "kansas",
				capo: null,
				tabContent: "",
				notes: null,
			},
			songs,
		);
		expect(result).toEqual({ title: "Dust in the Wind", artistName: "Kansas" });
	});

	it("returns null when title matches but artist differs", () => {
		const result = findDuplicate(
			{
				title: "Dust in the Wind",
				artist: "Eagles",
				capo: null,
				tabContent: "",
				notes: null,
			},
			songs,
		);
		expect(result).toBeNull();
	});

	it("returns null when artist matches but title differs", () => {
		const result = findDuplicate(
			{
				title: "Carry On",
				artist: "Kansas",
				capo: null,
				tabContent: "",
				notes: null,
			},
			songs,
		);
		expect(result).toBeNull();
	});

	it("returns null for empty existingSongs", () => {
		const result = findDuplicate(
			{
				title: "Dust in the Wind",
				artist: "Kansas",
				capo: null,
				tabContent: "",
				notes: null,
			},
			[],
		);
		expect(result).toBeNull();
	});

	it("handles whitespace in extracted fields", () => {
		const result = findDuplicate(
			{
				title: "  Dust in the Wind  ",
				artist: "  Kansas  ",
				capo: null,
				tabContent: "",
				notes: null,
			},
			songs,
		);
		expect(result).toEqual({ title: "Dust in the Wind", artistName: "Kansas" });
	});
});
