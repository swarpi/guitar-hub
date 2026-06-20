// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapoBadge } from "./CapoBadge";

describe("CapoBadge", () => {
	it("renders capo number with default sm size", () => {
		render(<CapoBadge capo={2} />);
		const badge = screen.getByText("Capo 2");
		expect(badge).toBeInTheDocument();
		expect(badge.className).toContain("px-[9px]");
		expect(badge.className).toContain("text-[10px]");
	});

	it("renders capo number with lg size", () => {
		render(<CapoBadge capo={5} size="lg" />);
		const badge = screen.getByText("Capo 5");
		expect(badge).toBeInTheDocument();
		expect(badge.className).toContain("px-3");
		expect(badge.className).toContain("text-[11px]");
	});
});
