/**
 * Pure helpers for Phase 2 (URL import) of ADR-0006, plus the fetch wrapper.
 * The proxy detects a "URL: <url>" user message, fetches the page server-side,
 * and substitutes the page text into the prompt so the AI sees text, not HTML.
 */

const URL_PREFIX = /^url:\s*/i;

/**
 * Detects the "URL:" prefix and returns the trimmed URL, or null when the
 * message is not a URL-import request. Only http/https URLs are accepted;
 * anything unparseable or with another protocol falls through to null so the
 * message is treated as regular pasted text.
 */
export function extractUrlFromMessage(content: string): string | null {
  const trimmed = content.trim();
  if (!URL_PREFIX.test(trimmed)) {
    return null;
  }

  const candidate = trimmed.replace(URL_PREFIX, "").trim();
  if (candidate === "") {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return candidate;
}

/**
 * Converts raw HTML into plain text: drops <script>/<style> blocks entirely,
 * turns line-breaking tags into newlines, strips all remaining tags, decodes
 * the common entities, and collapses runs of 3+ newlines to a single blank
 * line.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|li|tr|h[1-6]|section|article|header|footer|pre|blockquote)\s*>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Builds the message content that replaces the raw "URL: ..." string before
 * it is handed to buildPrompt.
 *
 * Format: `Content fetched from <url>:\n\n<pageText>`
 */
export function buildFetchedPageMessage(url: string, pageText: string): string {
  return `Content fetched from ${url}:\n\n${pageText}`;
}

/**
 * Fetches a URL and returns its body as plain text via htmlToText. Throws on
 * network failure, non-2xx status, or timeout (default 15s, via
 * AbortController).
 */
export async function fetchUrlAsText(
  url: string,
  timeoutMs = 15_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    return htmlToText(await response.text());
  } finally {
    clearTimeout(timer);
  }
}
