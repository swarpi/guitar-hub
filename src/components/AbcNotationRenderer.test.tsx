// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AbcNotationRenderer from "./AbcNotationRenderer";

vi.mock("abcjs", () => ({
	renderAbc: vi.fn(),
}));

const { renderAbc } = await import("abcjs");

const SAMPLE_ABC = "X:1\nT:Test\nM:4/4\nK:C\nCDEF|GABc|";

describe("AbcNotationRenderer", () => {
	// Vitest globals are off, so RTL's automatic cleanup never registers.
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("renders ABC content into the container with responsive resize", () => {
		const { container } = render(<AbcNotationRenderer content={SAMPLE_ABC} />);

		expect(renderAbc).toHaveBeenCalledTimes(1);
		const [target, code, params] = vi.mocked(renderAbc).mock.calls[0];
		expect(target).toBeInstanceOf(HTMLDivElement);
		expect(container.contains(target as HTMLDivElement)).toBe(true);
		expect(code).toBe(SAMPLE_ABC);
		expect(params).toEqual({ responsive: "resize" });
	});

	it("re-renders when content changes", () => {
		const { rerender } = render(<AbcNotationRenderer content={SAMPLE_ABC} />);
		expect(renderAbc).toHaveBeenCalledTimes(1);

		const updated = "X:1\nT:Other\nM:3/4\nK:G\nGAB|";
		rerender(<AbcNotationRenderer content={updated} />);

		expect(renderAbc).toHaveBeenCalledTimes(2);
		expect(vi.mocked(renderAbc).mock.calls[1][1]).toBe(updated);
	});

	it("does not call renderAbc for empty content", () => {
		render(<AbcNotationRenderer content="" />);
		expect(renderAbc).not.toHaveBeenCalled();
	});
});
