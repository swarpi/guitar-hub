import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

const { INSTRUMENTS, assertInstrument, isInstrument } = await import(
	"./instruments"
);

describe("isInstrument", () => {
	it("accepts every known instrument", () => {
		for (const instrument of INSTRUMENTS) {
			expect(isInstrument(instrument)).toBe(true);
		}
	});

	it("rejects unknown values", () => {
		expect(isInstrument("banjo")).toBe(false);
		expect(isInstrument("")).toBe(false);
		expect(isInstrument("Guitar")).toBe(false);
	});
});

describe("assertInstrument", () => {
	it("returns the narrowed value for known instruments", () => {
		expect(assertInstrument("guitar")).toBe("guitar");
		expect(assertInstrument("piano")).toBe("piano");
	});

	it("404s for unknown values", () => {
		expect(() => assertInstrument("banjo")).toThrow("NEXT_NOT_FOUND");
	});
});
