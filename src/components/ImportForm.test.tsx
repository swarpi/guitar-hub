// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportForm } from "./ImportForm";

const extracted = {
	title: "Dust in the Wind",
	artist: "Kansas",
	capo: null,
	tabContent: "Am  C  G\nI close my eyes...",
	notes: "Standard tuning",
};

function proxyResponse(text: string): Response {
	return {
		ok: true,
		status: 200,
		json: async () => ({
			content: [{ type: "text", text }],
			model: "claude-sonnet-4-5",
			role: "assistant",
		}),
	} as unknown as Response;
}

function renderForm() {
	const onExtracted = vi.fn();
	const onUseManual = vi.fn();
	render(<ImportForm onExtracted={onExtracted} onUseManual={onUseManual} />);
	return { onExtracted, onUseManual };
}

function pasteAndExtract(text = "some tab text") {
	fireEvent.change(screen.getByLabelText(/paste your tab text here/i), {
		target: { value: text },
	});
	fireEvent.click(screen.getByRole("button", { name: /extract/i }));
}

async function expectErrorState(message: string | RegExp) {
	await waitFor(() => {
		expect(screen.getByText(message)).toBeInTheDocument();
	});
	expect(
		screen.getByRole("button", { name: /try again/i }),
	).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: /use manual entry/i }),
	).toBeInTheDocument();
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	expect(screen.getByLabelText(/paste your tab text here/i)).toBeEnabled();
	expect(screen.getByRole("button", { name: /^extract$/i })).toBeEnabled();
}

describe("ImportForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("disables the Extract button when the textarea is empty", () => {
		renderForm();
		expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
	});

	it("disables the Extract button when the textarea is whitespace only", () => {
		renderForm();
		fireEvent.change(screen.getByLabelText(/paste your tab text here/i), {
			target: { value: "   \n  " },
		});
		expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
	});

	it("shows a loading state and disables the button while extracting", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => {})),
		);
		renderForm();
		pasteAndExtract();

		expect(screen.getByRole("button", { name: /extracting/i })).toBeDisabled();
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.getByLabelText(/paste your tab text here/i)).toBeDisabled();
	});

	it("sends the pasted text, system prompt, and model to the proxy", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		const { onExtracted } = renderForm();
		pasteAndExtract("Am C G tab text");

		await waitFor(() => expect(onExtracted).toHaveBeenCalled());

		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:3456/v1/messages",
			expect.objectContaining({ method: "POST" }),
		);
		const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
		expect(body.messages).toEqual([
			{ role: "user", content: "Am C G tab text" },
		]);
		expect(body.system).toContain("You are a guitar tab parser");
		expect(body.model).toBe("claude-sonnet-4-5");
	});

	it("calls onExtracted with mapped fields, keeping capo null", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse(JSON.stringify(extracted))),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await waitFor(() => {
			expect(onExtracted).toHaveBeenCalledWith({
				title: "Dust in the Wind",
				artist: "Kansas",
				capo: null,
				tabContent: "Am  C  G\nI close my eyes...",
				notes: "Standard tuning",
			});
		});
	});

	it("keeps capo 0 as 0, not null", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				proxyResponse(JSON.stringify({ ...extracted, capo: 0 })),
			),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await waitFor(() => {
			expect(onExtracted).toHaveBeenCalledWith(
				expect.objectContaining({ capo: 0 }),
			);
		});
	});

	it("shows the unreachable error when fetch throws", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		const { onUseManual } = renderForm();
		pasteAndExtract();

		await expectErrorState(
			"AI service is not running. Start it with `pnpm dev:ai`.",
		);

		fireEvent.click(screen.getByRole("button", { name: /use manual entry/i }));
		expect(onUseManual).toHaveBeenCalledOnce();
	});

	it("retries the extraction when Try again is clicked", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(proxyResponse(JSON.stringify(extracted)));
		vi.stubGlobal("fetch", fetchMock);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await expectErrorState(
			"AI service is not running. Start it with `pnpm dev:ai`.",
		);

		fireEvent.click(screen.getByRole("button", { name: /try again/i }));

		await waitFor(() => expect(onExtracted).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			screen.queryByText(/AI service is not running/i),
		).not.toBeInTheDocument();
	});

	it("shows the parse error when the AI returns invalid JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse("this is not json")),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await expectErrorState(
			"Could not parse the AI response. Try again or switch to manual entry.",
		);
		expect(onExtracted).not.toHaveBeenCalled();
	});

	it("shows the empty-tab error when tabContent is an empty string", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				proxyResponse(JSON.stringify({ ...extracted, tabContent: "" })),
			),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await expectErrorState(
			"No tab content was found in the input. Try pasting a different format.",
		);
		expect(onExtracted).not.toHaveBeenCalled();
	});

	it("shows the empty-tab error when tabContent is missing", async () => {
		const { tabContent: _tabContent, ...withoutTab } = extracted;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse(JSON.stringify(withoutTab))),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await expectErrorState(
			"No tab content was found in the input. Try pasting a different format.",
		);
		expect(onExtracted).not.toHaveBeenCalled();
	});

	it("shows the HTTP error when the proxy responds with a non-200 status", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response),
		);
		const { onExtracted } = renderForm();
		pasteAndExtract();

		await expectErrorState("The AI service returned an error. Try again.");
		expect(onExtracted).not.toHaveBeenCalled();
	});

	describe("URL input mode", () => {
		function switchToUrlMode() {
			fireEvent.click(screen.getByRole("button", { name: /^url$/i }));
		}

		function typeUrl(value: string) {
			fireEvent.change(
				screen.getByLabelText(/paste a link to a tab or chord page/i),
				{ target: { value } },
			);
		}

		it("defaults to paste mode: textarea visible, URL input not rendered", () => {
			renderForm();

			expect(
				screen.getByLabelText(/paste your tab text here/i),
			).toBeInTheDocument();
			expect(
				screen.queryByLabelText(/paste a link to a tab or chord page/i),
			).not.toBeInTheDocument();
		});

		it("switching to URL mode hides the textarea and disables Extract until a URL is entered", () => {
			renderForm();
			switchToUrlMode();

			expect(
				screen.queryByLabelText(/paste your tab text here/i),
			).not.toBeInTheDocument();
			expect(
				screen.getByLabelText(/paste a link to a tab or chord page/i),
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /^extract$/i })).toBeDisabled();

			typeUrl("   ");
			expect(screen.getByRole("button", { name: /^extract$/i })).toBeDisabled();

			typeUrl("https://example.com/tab");
			expect(screen.getByRole("button", { name: /^extract$/i })).toBeEnabled();
		});

		it("keeps pasted text and URL input in separate state across mode switches", () => {
			renderForm();

			fireEvent.change(screen.getByLabelText(/paste your tab text here/i), {
				target: { value: "Am C G" },
			});
			switchToUrlMode();
			typeUrl("https://example.com/tab");

			fireEvent.click(screen.getByRole("button", { name: /paste text/i }));
			expect(screen.getByLabelText(/paste your tab text here/i)).toHaveValue(
				"Am C G",
			);

			switchToUrlMode();
			expect(
				screen.getByLabelText(/paste a link to a tab or chord page/i),
			).toHaveValue("https://example.com/tab");
		});

		it("sends URL:-prefixed trimmed content and calls onExtracted on success", async () => {
			const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			const { onExtracted } = renderForm();

			switchToUrlMode();
			typeUrl("  https://example.com/tab  ");
			fireEvent.click(screen.getByRole("button", { name: /^extract$/i }));

			await waitFor(() => {
				expect(onExtracted).toHaveBeenCalledWith({
					title: "Dust in the Wind",
					artist: "Kansas",
					capo: null,
					tabContent: "Am  C  G\nI close my eyes...",
					notes: "Standard tuning",
				});
			});

			const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			expect(body.messages).toEqual([
				{ role: "user", content: "URL: https://example.com/tab" },
			]);
			expect(body.system).toContain("You are a guitar tab parser");
			expect(body.model).toBe("claude-sonnet-4-5");
		});

		it("shows the URL fetch error on a 502 response with recovery buttons and re-enabled inputs", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => ({ ok: false, status: 502 }) as unknown as Response),
			);
			const { onExtracted } = renderForm();

			switchToUrlMode();
			typeUrl("https://example.com/tab");
			fireEvent.click(screen.getByRole("button", { name: /^extract$/i }));

			await waitFor(() => {
				expect(
					screen.getByText(
						"Could not fetch the URL. Check the link and try again.",
					),
				).toBeInTheDocument();
			});
			expect(
				screen.getByRole("button", { name: /try again/i }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /use manual entry/i }),
			).toBeInTheDocument();
			expect(screen.queryByRole("status")).not.toBeInTheDocument();
			expect(
				screen.getByLabelText(/paste a link to a tab or chord page/i),
			).toBeEnabled();
			expect(screen.getByRole("button", { name: /^extract$/i })).toBeEnabled();
			expect(onExtracted).not.toHaveBeenCalled();
		});

		it("clears a displayed error when switching input method", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => {
					throw new TypeError("Failed to fetch");
				}),
			);
			renderForm();
			pasteAndExtract();

			await waitFor(() => {
				expect(
					screen.getByText(/AI service is not running/i),
				).toBeInTheDocument();
			});

			switchToUrlMode();
			expect(
				screen.queryByText(/AI service is not running/i),
			).not.toBeInTheDocument();
		});
	});
});
