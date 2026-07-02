import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildFetchedPageMessage,
  extractUrlFromMessage,
  fetchUrlAsText,
  htmlToText,
} from "./url-import";

describe("extractUrlFromMessage", () => {
  it("returns the URL for a well-formed URL: message", () => {
    expect(extractUrlFromMessage("URL: https://example.com/tab")).toBe(
      "https://example.com/tab"
    );
  });

  it("accepts http as well as https", () => {
    expect(extractUrlFromMessage("URL: http://example.com/tab")).toBe(
      "http://example.com/tab"
    );
  });

  it("trims whitespace and newlines around the prefix and the URL", () => {
    expect(
      extractUrlFromMessage("  \n URL: \n https://example.com/tab \n ")
    ).toBe("https://example.com/tab");
  });

  it("matches the prefix case-insensitively", () => {
    expect(extractUrlFromMessage("url: https://example.com")).toBe(
      "https://example.com"
    );
    expect(extractUrlFromMessage("Url: https://example.com")).toBe(
      "https://example.com"
    );
  });

  it("returns null for plain pasted text without the prefix", () => {
    expect(
      extractUrlFromMessage("Am  C  G\nDust in the wind...")
    ).toBeNull();
  });

  it("returns null when the prefix is present but the URL is invalid", () => {
    expect(extractUrlFromMessage("URL: not a real url")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(extractUrlFromMessage("URL: ftp://example.com/file")).toBeNull();
    expect(
      extractUrlFromMessage("URL: javascript:alert(1)")
    ).toBeNull();
  });

  it("returns null for empty or whitespace-only content", () => {
    expect(extractUrlFromMessage("")).toBeNull();
    expect(extractUrlFromMessage("   \n  ")).toBeNull();
  });

  it("returns null when the prefix has no URL after it", () => {
    expect(extractUrlFromMessage("URL:")).toBeNull();
    expect(extractUrlFromMessage("URL:   ")).toBeNull();
  });

  it("does not match a URL: prefix that is not at the start", () => {
    expect(
      extractUrlFromMessage("check this URL: https://example.com")
    ).toBeNull();
  });
});

describe("htmlToText", () => {
  it("removes script blocks including their contents", () => {
    expect(
      htmlToText('<p>Tab</p><script>window.ads = "buy";</script><p>G Em</p>')
    ).toBe("Tab\nG Em");
  });

  it("removes style blocks including their contents", () => {
    expect(htmlToText("<style>.tab { color: red; }</style><p>Am C</p>")).toBe(
      "Am C"
    );
  });

  it("strips all remaining HTML tags, leaving text content", () => {
    expect(htmlToText('<div class="x"><b>Dust</b> in the <i>Wind</i></div>')).toBe(
      "Dust in the Wind"
    );
  });

  it("decodes common HTML entities", () => {
    expect(
      htmlToText("Tom &amp; Jerry &lt;tab&gt; &quot;quoted&quot; it&#39;s here&nbsp;now")
    ).toBe('Tom & Jerry <tab> "quoted" it\'s here now');
  });

  it("collapses 3+ consecutive newlines to a single blank line", () => {
    expect(htmlToText("Verse 1\n\n\n\n\nChorus")).toBe("Verse 1\n\nChorus");
  });

  it("preserves single and double newlines", () => {
    expect(htmlToText("e|--0--|\nB|--1--|\n\nG|--2--|")).toBe(
      "e|--0--|\nB|--1--|\n\nG|--2--|"
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlToText("  \n <p>Am C G</p> \n ")).toBe("Am C G");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });

  it("converts <br> tags to newlines", () => {
    expect(htmlToText("Am<br>C<br/>G")).toBe("Am\nC\nG");
  });
});

describe("buildFetchedPageMessage", () => {
  it("includes both the source URL and the full page text", () => {
    const message = buildFetchedPageMessage(
      "https://example.com/tab",
      "Am C G\ntab body"
    );
    expect(message).toContain("https://example.com/tab");
    expect(message).toContain("Am C G\ntab body");
  });
});

describe("fetchUrlAsText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the page body converted to text on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<p>Am C G</p>",
      })) as unknown as typeof fetch
    );
    await expect(fetchUrlAsText("https://example.com")).resolves.toBe(
      "Am C G"
    );
  });

  it("throws when the response status is not OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => "not found",
      })) as unknown as typeof fetch
    );
    await expect(fetchUrlAsText("https://example.com")).rejects.toThrow(
      "404"
    );
  });

  it("throws when the fetch rejects with a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch
    );
    await expect(fetchUrlAsText("https://example.com")).rejects.toThrow(
      "fetch failed"
    );
  });
});
