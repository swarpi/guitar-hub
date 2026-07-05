// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OfflineBanner } from "./OfflineBanner";

function mockOnLine(value: boolean) {
	Object.defineProperty(navigator, "onLine", {
		value,
		writable: true,
		configurable: true,
	});
}

describe("OfflineBanner", () => {
	afterEach(() => {
		cleanup();
		mockOnLine(true);
	});

	it("renders when navigator.onLine is false", () => {
		mockOnLine(false);
		render(<OfflineBanner />);
		expect(
			screen.getByText("You are offline — viewing cached content"),
		).toBeInTheDocument();
	});

	it("does not render when navigator.onLine is true", () => {
		mockOnLine(true);
		render(<OfflineBanner />);
		expect(
			screen.queryByText("You are offline — viewing cached content"),
		).not.toBeInTheDocument();
	});

	it("appears when the offline event fires", () => {
		mockOnLine(true);
		render(<OfflineBanner />);
		expect(
			screen.queryByText("You are offline — viewing cached content"),
		).not.toBeInTheDocument();

		act(() => {
			window.dispatchEvent(new Event("offline"));
		});

		expect(
			screen.getByText("You are offline — viewing cached content"),
		).toBeInTheDocument();
	});

	it("disappears when the online event fires", () => {
		mockOnLine(false);
		render(<OfflineBanner />);
		expect(
			screen.getByText("You are offline — viewing cached content"),
		).toBeInTheDocument();

		act(() => {
			window.dispatchEvent(new Event("online"));
		});

		expect(
			screen.queryByText("You are offline — viewing cached content"),
		).not.toBeInTheDocument();
	});
});
