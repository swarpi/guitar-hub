// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/image-normalize", () => ({
	MAX_UPLOAD_BYTES: 25 * 1024 * 1024,
	validateImageInput: vi.fn(() => null),
	normalizeImageToJpeg: vi.fn(
		async () => new Blob(["jpeg"], { type: "image/jpeg" }),
	),
	blobToBase64: vi.fn(async () => "BASE64DATA"),
}));

import {
	blobToBase64,
	normalizeImageToJpeg,
	validateImageInput,
} from "@/lib/image-normalize";
import { ImportForm } from "./ImportForm";

const mockedValidate = vi.mocked(validateImageInput);
const mockedNormalize = vi.mocked(normalizeImageToJpeg);
const mockedToBase64 = vi.mocked(blobToBase64);

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

function renderForm(instrument?: "guitar" | "piano") {
	const onExtracted = vi.fn();
	const onUseManual = vi.fn();
	render(
		<ImportForm
			onExtracted={onExtracted}
			onUseManual={onUseManual}
			instrument={instrument}
		/>,
	);
	return { onExtracted, onUseManual };
}

function switchToImageMode() {
	fireEvent.click(screen.getByRole("button", { name: /^image$/i }));
}

function getFileInput(): HTMLInputElement {
	return screen.getByLabelText(/choose an image file/i) as HTMLInputElement;
}

function selectFile(file: File) {
	fireEvent.change(getFileInput(), { target: { files: [file] } });
}

function imageFile(name = "sheet.png", type = "image/png"): File {
	return new File(["binary"], name, { type });
}

function firePaste(
	items: Array<{ type: string; getAsFile: () => File | null }>,
) {
	const event = new Event("paste", { bubbles: true });
	Object.defineProperty(event, "clipboardData", { value: { items } });
	act(() => {
		window.dispatchEvent(event);
	});
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
		// Restore the module-mock defaults cleared by clearAllMocks / overridden
		// by individual image-mode tests.
		mockedValidate.mockReturnValue(null);
		mockedNormalize.mockResolvedValue(
			new Blob(["jpeg"], { type: "image/jpeg" }),
		);
		mockedToBase64.mockResolvedValue("BASE64DATA");
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
				content: "Am  C  G\nI close my eyes...",
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
					content: "Am  C  G\nI close my eyes...",
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

	describe("Image input mode", () => {
		it("shows the dropzone and hides text/URL inputs and the Extract button", () => {
			renderForm();
			switchToImageMode();

			expect(
				screen.queryByLabelText(/paste your tab text here/i),
			).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(/paste a link to a tab or chord page/i),
			).not.toBeInTheDocument();
			expect(getFileInput()).toBeInTheDocument();
			expect(screen.getByText(/drop an image here/i)).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: /^extract$/i }),
			).not.toBeInTheDocument();
		});

		it("normalizes a picked file and sends an image request with instrument", async () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			const { onExtracted } = renderForm("piano");

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => expect(onExtracted).toHaveBeenCalled());

			expect(mockedValidate).toHaveBeenCalled();
			expect(mockedNormalize).toHaveBeenCalled();
			expect(mockedToBase64).toHaveBeenCalled();

			const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			expect(body.image).toEqual({
				mediaType: "image/jpeg",
				data: "BASE64DATA",
			});
			expect(body.instrument).toBe("piano");
			expect(body.model).toBe("claude-sonnet-4-5");
			expect(body.system).toContain("sheet-music parser");
		});

		it("defaults instrument to guitar when the prop is omitted", async () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => expect(fetchMock).toHaveBeenCalled());
			const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			expect(body.instrument).toBe("guitar");
		});

		it("handles drag-and-drop through the same flow as the file picker", async () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			switchToImageMode();
			const dropzone = screen
				.getByText(/drop an image here/i)
				.closest("button");
			if (!dropzone) throw new Error("dropzone not found");
			fireEvent.dragOver(dropzone);
			fireEvent.drop(dropzone, {
				dataTransfer: { files: [imageFile()] },
			});

			await waitFor(() => expect(fetchMock).toHaveBeenCalled());
			const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			expect(body.image.data).toBe("BASE64DATA");
		});

		it("handles a pasted image item while in Image mode", async () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			switchToImageMode();
			firePaste([{ type: "image/png", getAsFile: () => imageFile() }]);

			await waitFor(() => expect(fetchMock).toHaveBeenCalled());
			const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			expect(body.image.data).toBe("BASE64DATA");
		});

		it("shows a non-blocking hint and sends nothing when pasting non-image content", () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			switchToImageMode();
			firePaste([{ type: "text/plain", getAsFile: () => null }]);

			expect(
				screen.getByText(/paste an image, or use the file picker/i),
			).toBeInTheDocument();
			expect(fetchMock).not.toHaveBeenCalled();
			expect(
				screen.queryByRole("button", { name: /try again/i }),
			).not.toBeInTheDocument();
		});

		it("does not intercept a paste while in Paste Text mode", () => {
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			// Never switch to image mode: the window paste listener is not mounted.
			firePaste([{ type: "image/png", getAsFile: () => imageFile() }]);

			expect(mockedValidate).not.toHaveBeenCalled();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("shows a validation error inline and sends nothing when the file is rejected", () => {
			mockedValidate.mockReturnValue(
				"Unsupported image format. Please use a PNG, JPEG, or WebP image.",
			);
			const fetchMock = vi.fn(async () =>
				proxyResponse(JSON.stringify(extracted)),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderForm();

			switchToImageMode();
			selectFile(imageFile("bad.pdf", "application/pdf"));

			expect(screen.getByText(/unsupported image format/i)).toBeInTheDocument();
			expect(fetchMock).not.toHaveBeenCalled();
			expect(mockedNormalize).not.toHaveBeenCalled();
			expect(
				screen.getByRole("button", { name: /use manual entry/i }),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: /try again/i }),
			).not.toBeInTheDocument();
		});

		it("shows a decode error when normalization rejects", async () => {
			mockedNormalize.mockRejectedValue(new Error("cannot decode"));
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => proxyResponse(JSON.stringify(extracted))),
			);
			const { onExtracted } = renderForm();

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => {
				expect(screen.getByText(/cannot read that image/i)).toBeInTheDocument();
			});
			expect(onExtracted).not.toHaveBeenCalled();
			expect(
				screen.getByRole("button", { name: /use manual entry/i }),
			).toBeInTheDocument();
		});

		it("calls onExtracted with mapped fields on a successful image extraction", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => proxyResponse(JSON.stringify(extracted))),
			);
			const { onExtracted } = renderForm();

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => {
				expect(onExtracted).toHaveBeenCalledWith({
					title: "Dust in the Wind",
					artist: "Kansas",
					capo: null,
					content: "Am  C  G\nI close my eyes...",
					notes: "Standard tuning",
				});
			});
		});

		it("reuses the shared HTTP error path for an image-mode request", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response),
			);
			const { onExtracted } = renderForm();

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => {
				expect(
					screen.getByText("The AI service returned an error. Try again."),
				).toBeInTheDocument();
			});
			expect(onExtracted).not.toHaveBeenCalled();
		});

		it("retries with the same normalized image without re-picking a file", async () => {
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
				} as unknown as Response)
				.mockResolvedValueOnce(proxyResponse(JSON.stringify(extracted)));
			vi.stubGlobal("fetch", fetchMock);
			const { onExtracted } = renderForm();

			switchToImageMode();
			selectFile(imageFile());

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /try again/i }),
				).toBeInTheDocument();
			});

			// Normalization ran once for the initial pick.
			expect(mockedNormalize).toHaveBeenCalledTimes(1);
			fireEvent.click(screen.getByRole("button", { name: /try again/i }));

			await waitFor(() => expect(onExtracted).toHaveBeenCalledOnce());
			expect(fetchMock).toHaveBeenCalledTimes(2);
			// The retry reused the normalized image, it did not re-normalize.
			expect(mockedNormalize).toHaveBeenCalledTimes(1);
		});

		it("clears the paste hint when switching away from image mode", () => {
			renderForm();
			switchToImageMode();
			firePaste([{ type: "text/plain", getAsFile: () => null }]);
			expect(
				screen.getByText(/paste an image, or use the file picker/i),
			).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /paste text/i }));
			expect(
				screen.queryByText(/paste an image, or use the file picker/i),
			).not.toBeInTheDocument();
		});
	});
});
