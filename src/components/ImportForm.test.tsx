// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// image-normalize is mocked per ai-import/008's established pattern. MAX_UPLOAD_BYTES
// is shrunk so MAX_IMAGE_BASE64_LENGTH (ceil(bytes * 4 / 3) = 40) is small enough to
// exercise the per-image size guard without producing 30 MB test strings.
vi.mock("@/lib/image-normalize", () => ({
	MAX_UPLOAD_BYTES: 30,
	normalizeImageToJpeg: vi.fn(async (blob: Blob) => blob),
	blobToBase64: vi.fn(async () => "BASE64DATA"),
}));

import { blobToBase64, normalizeImageToJpeg } from "@/lib/image-normalize";
import { ImportForm } from "./ImportForm";

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

function composer(): HTMLTextAreaElement {
	return screen.getByRole("textbox", {
		name: /message/i,
	}) as HTMLTextAreaElement;
}

function sendButton(): HTMLElement {
	return screen.getByRole("button", { name: /^send$/i });
}

function fileInput(): HTMLInputElement {
	return screen.getByLabelText(/attach image files/i) as HTMLInputElement;
}

function type(value: string) {
	fireEvent.change(composer(), { target: { value } });
}

function send(value = "some tab text") {
	type(value);
	fireEvent.click(sendButton());
}

function imageFile(name = "sheet.png", type = "image/png"): File {
	return new File(["binary"], name, { type });
}

function textFile(name = "notes.txt"): File {
	return new File(["hello"], name, { type: "text/plain" });
}

function selectFiles(files: File[]) {
	fireEvent.change(fileInput(), { target: { files } });
}

function dropFiles(files: File[]) {
	fireEvent.drop(composer(), { dataTransfer: { files } });
}

// Dispatches a native paste on the composer (bubbling to ImportForm's onPaste).
// clipboardData is attached via defineProperty because jsdom's paste event does
// not accept it through the constructor. Returns the event so callers can assert
// whether default was prevented (i.e. whether the paste was intercepted).
function firePaste(
	items: Array<{ type: string; getAsFile: () => File | null }>,
): Event {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", { value: { items } });
	act(() => {
		composer().dispatchEvent(event);
	});
	return event;
}

function thumbnailRemoveButtons(): HTMLElement[] {
	return screen.queryAllByRole("button", { name: /^remove/i });
}

describe("ImportForm", () => {
	beforeEach(() => {
		mockedNormalize.mockReset().mockImplementation(async (blob: Blob) => blob);
		mockedToBase64.mockReset().mockResolvedValue("BASE64DATA");
		// jsdom does not implement object URLs; stub them for the thumbnail previews.
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			writable: true,
			value: vi.fn(() => "blob:mock"),
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			writable: true,
			value: vi.fn(),
		});
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	// --- Chat core (carried over from chat-import/002) ---------------------------

	it("renders an empty thread and a disabled Send button on first load", () => {
		renderForm();
		expect(sendButton()).toBeDisabled();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("disables Send while the composer is empty or whitespace-only", () => {
		renderForm();
		expect(sendButton()).toBeDisabled();

		type("   \n  ");
		expect(sendButton()).toBeDisabled();

		type("Am C G");
		expect(sendButton()).toBeEnabled();
	});

	it("submits on Enter and prevents the default newline", () => {
		const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		type("Am C G");
		fireEvent.keyDown(composer(), { key: "Enter" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(composer()).toHaveValue("");
		expect(screen.getByText("Am C G")).toBeInTheDocument();
	});

	it("inserts a newline on Shift+Enter without submitting", () => {
		const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		type("Am C G");
		const event = fireEvent.keyDown(composer(), {
			key: "Enter",
			shiftKey: true,
		});

		expect(event).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("shows a loading indicator in the thread while extracting", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => {})),
		);
		renderForm();
		send("Am C G tab text");

		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(composer()).toBeDisabled();
	});

	it("sends the full history, system prompt, model, and instrument to the proxy", async () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm("guitar");
		send("Am C G tab text");

		await waitFor(() =>
			expect(screen.getByText(/use this result/i)).toBeInTheDocument(),
		);

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
		expect(body.instrument).toBe("guitar");
		// A text-only turn never populates the images array.
		expect(body.images).toBeUndefined();
	});

	it("renders a result card and calls onExtracted with mapped fields when used", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse(JSON.stringify(extracted))),
		);
		const { onExtracted } = renderForm();
		send();

		const useButton = await screen.findByRole("button", {
			name: /use this result/i,
		});
		const card = useButton.closest("div") as HTMLElement;
		expect(within(card).getByText("Dust in the Wind")).toBeInTheDocument();
		expect(within(card).getByText("Kansas")).toBeInTheDocument();
		expect(within(card).getByText("Standard tuning")).toBeInTheDocument();

		fireEvent.click(useButton);
		expect(onExtracted).toHaveBeenCalledWith({
			title: "Dust in the Wind",
			artist: "Kansas",
			capo: null,
			content: "Am  C  G\nI close my eyes...",
			notes: "Standard tuning",
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
		send();

		fireEvent.click(
			await screen.findByRole("button", { name: /use this result/i }),
		);
		expect(onExtracted).toHaveBeenCalledWith(
			expect.objectContaining({ capo: 0 }),
		);
	});

	it("does not clear the thread when Use this result fires", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse(JSON.stringify(extracted))),
		);
		renderForm();
		send("my first message");

		fireEvent.click(
			await screen.findByRole("button", { name: /use this result/i }),
		);
		expect(screen.getByText("my first message")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /use this result/i }),
		).toBeInTheDocument();
	});

	it("renders a non-JSON response as plain text with no result card", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse("I need more detail about the song.")),
		);
		const { onExtracted } = renderForm();
		send();

		await waitFor(() =>
			expect(
				screen.getByText("I need more detail about the song."),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: /use this result/i }),
		).not.toBeInTheDocument();
		expect(onExtracted).not.toHaveBeenCalled();
	});

	it("notes missing tab content and offers no Use this result affordance", async () => {
		const { tabContent: _tab, ...withoutTab } = extracted;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => proxyResponse(JSON.stringify(withoutTab))),
		);
		renderForm();
		send();

		await waitFor(() =>
			expect(screen.getByText(/no tab content found/i)).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: /use this result/i }),
		).not.toBeInTheDocument();
	});

	it("notes missing tab content when tabContent is an empty string", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				proxyResponse(JSON.stringify({ ...extracted, tabContent: "" })),
			),
		);
		renderForm();
		send();

		await waitFor(() =>
			expect(screen.getByText(/no tab content found/i)).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: /use this result/i }),
		).not.toBeInTheDocument();
	});

	it("round-trips multi-turn history: user, raw assistant text, new user", async () => {
		const conversational = "Sure — which section should I focus on?";
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(proxyResponse(conversational))
			.mockResolvedValueOnce(proxyResponse(JSON.stringify(extracted)));
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		send("first message");
		await waitFor(() =>
			expect(screen.getByText(conversational)).toBeInTheDocument(),
		);

		send("second message");
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
		expect(body.messages).toEqual([
			{ role: "user", content: "first message" },
			{ role: "assistant", content: conversational },
			{ role: "user", content: "second message" },
		]);
	});

	it("shows the unreachable error in-thread when fetch throws", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		renderForm();
		send();

		await waitFor(() =>
			expect(
				screen.getByText(
					"AI service is not running. Start it with `pnpm dev:ai`.",
				),
			).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("shows the HTTP error in-thread on a non-OK status", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response),
		);
		renderForm();
		send();

		await waitFor(() =>
			expect(
				screen.getByText("The AI service returned an error. Try again."),
			).toBeInTheDocument(),
		);
	});

	it("shows the invalid-JSON error when the response envelope is not JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					({
						ok: true,
						status: 200,
						json: async () => {
							throw new SyntaxError("Unexpected token");
						},
					}) as unknown as Response,
			),
		);
		renderForm();
		send();

		await waitFor(() =>
			expect(
				screen.getByText(
					"Could not parse the AI response. Try again or switch to manual entry.",
				),
			).toBeInTheDocument(),
		);
	});

	it("retries the last user message without requiring re-entry", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(proxyResponse(JSON.stringify(extracted)));
		vi.stubGlobal("fetch", fetchMock);
		renderForm();
		send("Am C G");

		await waitFor(() =>
			expect(
				screen.getByText(/AI service is not running/i),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByRole("button", { name: /try again/i }));

		await waitFor(() =>
			expect(screen.getByText(/use this result/i)).toBeInTheDocument(),
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			screen.queryByText(/AI service is not running/i),
		).not.toBeInTheDocument();

		const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
		expect(body.messages).toEqual([{ role: "user", content: "Am C G" }]);
	});

	it("calls onUseManual when the manual-entry control is activated", () => {
		const { onUseManual } = renderForm();
		fireEvent.click(screen.getByRole("button", { name: /use manual entry/i }));
		expect(onUseManual).toHaveBeenCalledOnce();
	});

	// --- Multi-image attachment (chat-import/003) --------------------------------

	it("appends multiple picked files as thumbnails", () => {
		renderForm();
		selectFiles([imageFile("panel1.png"), imageFile("panel2.png")]);

		expect(thumbnailRemoveButtons()).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: /remove panel1\.png/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /remove panel2\.png/i }),
		).toBeInTheDocument();
	});

	it("accumulates onto already-attached images instead of replacing them", () => {
		renderForm();
		selectFiles([imageFile("panel1.png")]);
		selectFiles([imageFile("panel2.png")]);

		expect(thumbnailRemoveButtons()).toHaveLength(2);
	});

	it("removes only the chosen thumbnail, leaving others and the text intact", () => {
		renderForm();
		type("stitch these panels");
		selectFiles([imageFile("panel1.png"), imageFile("panel2.png")]);

		fireEvent.click(
			screen.getByRole("button", { name: /remove panel1\.png/i }),
		);

		expect(
			screen.queryByRole("button", { name: /remove panel1\.png/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /remove panel2\.png/i }),
		).toBeInTheDocument();
		expect(composer()).toHaveValue("stitch these panels");
	});

	it("appends dropped image files and ignores a non-image file in the same drop", () => {
		renderForm();
		dropFiles([imageFile("a.png"), textFile("notes.txt"), imageFile("b.png")]);

		expect(thumbnailRemoveButtons()).toHaveLength(2);
		expect(
			screen.queryByRole("button", { name: /remove notes\.txt/i }),
		).not.toBeInTheDocument();
	});

	it("appends a pasted image and leaves a text-only paste to native handling", () => {
		renderForm();

		const imagePaste = firePaste([
			{ type: "image/png", getAsFile: () => imageFile("pasted.png") },
		]);
		expect(thumbnailRemoveButtons()).toHaveLength(1);
		// The image paste was intercepted (default prevented).
		expect(imagePaste.defaultPrevented).toBe(true);

		const textPaste = firePaste([
			{ type: "text/plain", getAsFile: () => null },
		]);
		// A text-only paste is not intercepted and does not add a thumbnail.
		expect(textPaste.defaultPrevented).toBe(false);
		expect(thumbnailRemoveButtons()).toHaveLength(1);
	});

	it("caps attachments at 10 and re-enables after one is removed", () => {
		renderForm();
		const ten = Array.from({ length: 10 }, (_, i) => imageFile(`p${i}.png`));
		selectFiles(ten);
		expect(thumbnailRemoveButtons()).toHaveLength(10);
		expect(
			screen.queryByText(/maximum 10 images per message/i),
		).not.toBeInTheDocument();

		// An 11th is blocked with the cap message; still 10 attached.
		selectFiles([imageFile("overflow.png")]);
		expect(
			screen.getByText(/maximum 10 images per message/i),
		).toBeInTheDocument();
		expect(thumbnailRemoveButtons()).toHaveLength(10);

		// Removing one drops below the cap, clears the message, and re-enables.
		fireEvent.click(screen.getByRole("button", { name: /remove p0\.png/i }));
		expect(
			screen.queryByText(/maximum 10 images per message/i),
		).not.toBeInTheDocument();
		selectFiles([imageFile("late.png")]);
		expect(thumbnailRemoveButtons()).toHaveLength(10);
	});

	it("enables Send with images attached and no text", () => {
		renderForm();
		expect(sendButton()).toBeDisabled();

		selectFiles([imageFile("panel1.png")]);
		expect(sendButton()).toBeEnabled();
	});

	it("substitutes the default message when only images are attached", async () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		selectFiles([imageFile("panel1.png")]);
		fireEvent.click(sendButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		// Rendered in the thread…
		expect(
			screen.getByText("Transcribe the attached sheet(s)."),
		).toBeInTheDocument();
		// …and in the outgoing request's messages entry.
		const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
		expect(body.messages).toEqual([
			{ role: "user", content: "Transcribe the attached sheet(s)." },
		]);
	});

	it("sends the normalized images as an array in attachment order", async () => {
		mockedToBase64
			.mockReset()
			.mockResolvedValueOnce("B64-0")
			.mockResolvedValueOnce("B64-1")
			.mockResolvedValueOnce("B64-2");
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		type("stitch these three panels");
		selectFiles([
			imageFile("p0.png"),
			imageFile("p1.png"),
			imageFile("p2.png"),
		]);
		fireEvent.click(sendButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
		expect(body.images).toEqual([
			{ mediaType: "image/jpeg", data: "B64-0" },
			{ mediaType: "image/jpeg", data: "B64-1" },
			{ mediaType: "image/jpeg", data: "B64-2" },
		]);
		// The user turn records how many images were attached.
		expect(body.messages).toEqual([
			{ role: "user", content: "stitch these three panels" },
		]);
	});

	it("selects the image system prompt per turn, reverting to text on a text-only follow-up", async () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		// Turn 1: image-bearing.
		selectFiles([imageFile("panel1.png")]);
		fireEvent.click(sendButton());
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		// Turn 2: text-only follow-up.
		send("change the capo to 3");
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const first = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
		const second = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
		expect(first.system).toContain("You are a sheet-music parser");
		expect(second.system).toContain("You are a guitar tab parser");
	});

	it("displays an image count on the user turn that carried images", async () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		selectFiles([imageFile("p0.png"), imageFile("p1.png")]);
		fireEvent.click(sendButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByText(/2 images/i)).toBeInTheDocument();
	});

	it("surfaces an inline composer error and does not send when an image fails to decode", () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		mockedNormalize.mockReset().mockRejectedValue(new Error("undecodable"));
		renderForm();

		selectFiles([imageFile("broken.png")]);
		fireEvent.click(sendButton());

		return waitFor(() => {
			expect(
				screen.getByText(/cannot read "broken\.png"/i),
			).toBeInTheDocument();
		}).then(() => {
			expect(fetchMock).not.toHaveBeenCalled();
			// The offending image stays attached and removable.
			expect(
				screen.getByRole("button", { name: /remove broken\.png/i }),
			).toBeInTheDocument();
		});
	});

	it("surfaces a size error and does not send when an image stays over the cap after retry", () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		// Every base64 pass exceeds MAX_IMAGE_BASE64_LENGTH (40), so the retry also fails.
		mockedToBase64.mockReset().mockResolvedValue("X".repeat(60));
		renderForm();

		selectFiles([imageFile("huge.png")]);
		fireEvent.click(sendButton());

		return waitFor(() => {
			expect(
				screen.getByText(/"huge\.png" is too large to send/i),
			).toBeInTheDocument();
		}).then(() => {
			expect(fetchMock).not.toHaveBeenCalled();
			expect(
				screen.getByRole("button", { name: /remove huge\.png/i }),
			).toBeInTheDocument();
		});
	});

	it("clears attachments after a successful send", async () => {
		const fetchMock = vi.fn(async () =>
			proxyResponse(JSON.stringify(extracted)),
		);
		vi.stubGlobal("fetch", fetchMock);
		renderForm();

		type("here is a panel");
		selectFiles([imageFile("panel1.png")]);
		fireEvent.click(sendButton());

		await waitFor(() =>
			expect(screen.getByText(/use this result/i)).toBeInTheDocument(),
		);
		expect(thumbnailRemoveButtons()).toHaveLength(0);
	});

	it("clears attachments even when the send errors at the proxy", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		renderForm();

		type("here is a panel");
		selectFiles([imageFile("panel1.png")]);
		fireEvent.click(sendButton());

		await waitFor(() =>
			expect(
				screen.getByText(/AI service is not running/i),
			).toBeInTheDocument(),
		);
		expect(thumbnailRemoveButtons()).toHaveLength(0);
	});
});
