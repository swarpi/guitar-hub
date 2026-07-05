// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddPageClient } from "./AddPageClient";
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

describe("AddPageClient", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("renders mode toggle with Manual active by default", () => {
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

		expect(
			screen.getByRole("button", { name: /manual$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /import via ai/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
	});

	it("renders the ImportForm when switching to import mode", () => {
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));

		expect(
			screen.getByRole("button", { name: /extract/i }),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/song title/i)).not.toBeInTheDocument();
	});

	it("switches back to manual mode from import", () => {
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		expect(screen.queryByLabelText(/song title/i)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /^manual$/i }));
		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
	});

	it("switches to manual mode when the ImportForm calls onUseManual", () => {
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

		fireEvent.click(screen.getByRole("button", { name: /import via ai/i }));
		fireEvent.click(screen.getByRole("button", { name: /use manual entry/i }));

		expect(screen.getByLabelText(/song title/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /extract/i }),
		).not.toBeInTheDocument();
	});

	it("enters review state when onExtracted is called", () => {
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

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
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

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
		render(<AddPageClient artistNames={artistNames} action={mockAction} />);

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
});
