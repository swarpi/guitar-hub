// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SongForm } from "./SongForm";

const noopAction = vi.fn(async () => undefined);

describe("SongForm", () => {
	// Vitest globals are off, so RTL's automatic cleanup never registers.
	afterEach(cleanup);

	it("shows the capo field for guitar", () => {
		render(
			<SongForm artistNames={[]} action={noopAction} instrument="guitar" />,
		);
		expect(screen.getByLabelText("Capo")).toBeInTheDocument();
	});

	it("shows the capo field when no instrument is given", () => {
		render(<SongForm artistNames={[]} action={noopAction} />);
		expect(screen.getByLabelText("Capo")).toBeInTheDocument();
	});

	it("hides the capo field for piano", () => {
		render(
			<SongForm artistNames={[]} action={noopAction} instrument="piano" />,
		);
		expect(screen.queryByLabelText("Capo")).not.toBeInTheDocument();
	});

	it("submits the instrument as a hidden field", () => {
		const { container } = render(
			<SongForm artistNames={[]} action={noopAction} instrument="piano" />,
		);
		const hidden = container.querySelector('input[name="instrument"]');
		expect(hidden).toBeInstanceOf(HTMLInputElement);
		expect((hidden as HTMLInputElement).type).toBe("hidden");
		expect((hidden as HTMLInputElement).value).toBe("piano");
	});
});
