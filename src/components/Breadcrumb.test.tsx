// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: {
		href: string;
		children: React.ReactNode;
		className?: string;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
	it("renders a single item without a link", () => {
		render(<Breadcrumb items={[{ label: "Home" }]} />);
		const item = screen.getByText("Home");
		expect(item).toBeInTheDocument();
		expect(item.tagName).toBe("SPAN");
		expect(item.className).toContain("text-ink");
	});

	it("renders multiple items with links and separators", () => {
		render(
			<Breadcrumb
				items={[
					{ label: "Songs", href: "/" },
					{ label: "Artists", href: "/artists" },
					{ label: "Current Song" },
				]}
			/>,
		);

		const songsLink = screen.getByText("Songs");
		expect(songsLink.tagName).toBe("A");
		expect(songsLink).toHaveAttribute("href", "/");
		expect(songsLink.className).toContain("text-accent");

		const artistsLink = screen.getByText("Artists");
		expect(artistsLink.tagName).toBe("A");
		expect(artistsLink).toHaveAttribute("href", "/artists");

		const currentItem = screen.getByText("Current Song");
		expect(currentItem.tagName).toBe("SPAN");
		expect(currentItem.className).toContain("text-ink");

		const separators = screen.getAllByText("›");
		expect(separators).toHaveLength(2);
	});
});
