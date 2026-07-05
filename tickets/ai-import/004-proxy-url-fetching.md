# Ticket: AI Proxy — Server-Side URL Fetching

**Feature:** ai-import
**Status:** Done
**Priority:** P1
**Estimate:** M
**Related:** ADR-0006 (Section 5 "Phase 2 (URL)", Section 6 "Error Handling")

## Context

Tickets 001 and 002 shipped Phase 1 of ADR-0006: pasted-text import. Phase 2 adds URL import — the user provides a link instead of pasted text, and the AI extracts the song from the fetched page.

ADR-0006 Section 5 decides **Option B**: the proxy fetches the URL server-side, not the browser. Rationale: the proxy is a Node process with unrestricted network access, so there are no CORS issues and no need for a separate CORS proxy or Next.js API route. The contract between client and proxy stays simple — the client sends a single user message whose content starts with the literal prefix `URL: ` followed by the link, e.g. `"URL: https://tabs.example.com/song"`. The proxy detects this prefix, fetches the page, converts the HTML to plain text, and substitutes the page text into the prompt before spawning `claude -p`. The Phase 2 system prompt is identical to Phase 1 (Section 5: "The AI sees text, not HTML").

The current proxy (`scripts/ai-proxy.ts`) has no URL-awareness — `buildPrompt` treats every single-message request as a literal prompt string. This ticket adds detection, fetching, and HTML-to-text conversion, plus the error contract for fetch failures (ADR Section 6: "Could not fetch the URL. Check the link and try again.").

This ticket is proxy-only and has no dependency on the multi-instrument work (ADR-0005) happening in parallel — it does not touch `src/`, the schema, or any route.

## Goal

Add URL-fetching to the AI proxy: detect a `URL: <url>` message, fetch the page, convert it to text, and feed that text into the existing `claude -p` prompt flow, with a distinct error response when the fetch fails.

## Acceptance Criteria

- [x] A new file `scripts/url-import.ts` exports the following **pure** functions (no network I/O, no file system access):
  - [x] `extractUrlFromMessage(content: string): string | null` — detects the `URL:` prefix and returns the normalized URL, or `null` if the message is not a URL-import request
  - [x] `htmlToText(html: string): string` — converts raw HTML into plain text
  - [x] `buildFetchedPageMessage(url: string, pageText: string): string` — builds the string that replaces the raw `URL: ...` content before it is handed to `buildPrompt`
- [x] `extractUrlFromMessage` behavior:
  - [x] `"URL: https://example.com/tab"` → returns `"https://example.com/tab"`
  - [x] Leading/trailing whitespace and newlines around the prefix or the URL are trimmed → still returns the clean URL
  - [x] Detection is case-insensitive on the `URL:` prefix (`"url: https://example.com"` also matches) — the client always sends the exact-case prefix, but the proxy is lenient
  - [x] Plain pasted text with no `URL:` prefix (Phase 1 messages) → returns `null`
  - [x] `"URL: not a real url"` (prefix present, invalid URL) → returns `null`
  - [x] `"URL: ftp://example.com/file"` (non-http/https protocol) → returns `null`
  - [x] Empty string or whitespace-only content → returns `null`
- [x] `htmlToText` behavior:
  - [x] Removes `<script>...</script>` and `<style>...</style>` blocks, including their contents, entirely
  - [x] Strips all remaining HTML tags, leaving only text content
  - [x] Decodes the common entities `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`
  - [x] Collapses 3 or more consecutive newlines down to a single blank line (max one empty line between text blocks)
  - [x] Trims leading and trailing whitespace from the result
  - [x] Empty string input → returns empty string
- [x] `buildFetchedPageMessage` returns a string that includes both the source URL and the full page text (exact format is an implementation detail — document the chosen format in the function's JSDoc)
- [x] A new function `fetchUrlAsText(url: string, timeoutMs?: number): Promise<string>` is added to `scripts/url-import.ts` (or a sibling file) that:
  - [x] Fetches `url` using Node's global `fetch`
  - [x] Applies a request timeout via `AbortController`, defaulting to 15000ms, configurable via the `timeoutMs` parameter
  - [x] Throws an `Error` if the fetch rejects (network failure), the response status is not OK (2xx), or the request times out
  - [x] On success, returns `htmlToText(bodyText)`
- [x] `scripts/ai-proxy.ts` is updated so that when the request has exactly one message and `extractUrlFromMessage(data.messages[0].content)` returns a URL:
  - [x] The proxy calls `fetchUrlAsText` **before** spawning the `claude` CLI process
  - [x] On fetch success, the proxy builds the prompt using `buildFetchedPageMessage(url, pageText)` as the effective message content (in place of the raw `URL: ...` string), then proceeds with the existing `buildPrompt` → `spawn("claude", ...)` flow unchanged (same system prompt passthrough, same default model `claude-sonnet-4-5`)
  - [x] On fetch failure, the proxy responds immediately — **without spawning `claude`** — with HTTP status `502` and body `{ "error": { "message": "Could not fetch the URL. Check the link and try again." } }`
- [x] Requests where `extractUrlFromMessage` returns `null` (including all existing Phase 1 pasted-text requests and multi-message requests) are handled exactly as before — no change to `buildPrompt` or the spawn flow for non-URL requests
- [x] `pnpm test` passes, including new tests in `scripts/url-import.test.ts` covering every behavior listed above for `extractUrlFromMessage`, `htmlToText`, and `buildFetchedPageMessage`
- [x] `pnpm lint` passes on all changed files
- [x] `pnpm build` compiles without errors
- [x] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- Any change to `src/components/ImportForm.tsx` or any other UI — that is ticket 005
- Image/camera input (Phase 3 of ADR-0006)
- Headless-browser rendering (e.g. Puppeteer) for JavaScript-rendered tab sites — ADR-0006 explicitly defers this ("Neutral" consequences section) as a future enhancement, not a Phase 2 requirement
- Adding a new HTML-parsing dependency (e.g. `cheerio`). ADR-0006 allows it, but a hand-rolled `htmlToText` is sufficient for stripping tags and keeps the dev-only proxy dependency-free
- Caching or retrying fetched pages
- Any change to `createSongLogic`, `src/db/schema.ts`, `src/db/queries.ts`, or any route
- Any change to the multi-instrument worktree (ADR-0005) — this ticket does not touch `src/`

## Notes

**Detection contract:** The client (ticket 005) will send `{ messages: [{ role: "user", content: "URL: https://..." }], system: SYSTEM_PROMPT, model: "claude-sonnet-4-5" }` — a single message, exact-case `URL: ` prefix. Case-insensitive detection on the server side is defensive, not a documented client behavior.

**Why 502 for fetch failure:** The existing proxy uses `400` for malformed request JSON and `500` for `claude` CLI spawn/process failures. `502 Bad Gateway` cleanly signals "the proxy could not reach an upstream resource," which is semantically accurate (the upstream here is the target URL, not the AI) and gives the client (ticket 005) an unambiguous status code to branch on without string-matching the error message.

**Timeout separation:** `fetchUrlAsText`'s timeout (default 15s) is independent of and shorter than the existing 120s `claude` process timeout — a slow or hanging tab site should fail fast rather than eating into the AI call's time budget.

**Manual verification:** Because this ticket's proxy-level integration involves live network fetches and spawning the real `claude` CLI, it is not practical to unit test the full `ai-proxy.ts` request handler in CI. After implementation, manually verify with `pnpm dev:ai` running and a `curl` request such as:

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"URL: https://example.com"}]}'
```

and one with an unreachable/malformed URL to confirm the `502` response. Document the manual check result in the PR description or commit message.

**Existing test suite:** `scripts/ai-proxy.ts` currently has zero automated tests (it is a Node HTTP server that spawns child processes). This ticket does not change that — only the newly extracted pure functions in `scripts/url-import.ts` get unit tests, per the project convention of testing observable, side-effect-free logic.

## Implementation Plan

1. Create `scripts/url-import.ts` with the three pure functions — `extractUrlFromMessage` (case-insensitive `URL:` prefix, `new URL` validation, http/https only), `htmlToText` (drop script/style blocks, convert `<br>`/block-closing tags to newlines, strip remaining tags, decode the six common entities, collapse 3+ newlines, trim), `buildFetchedPageMessage` (`Content fetched from <url>:\n\n<pageText>`, documented in JSDoc) — plus `fetchUrlAsText` (global `fetch` with a 15s `AbortController` timeout, throws on rejection/non-2xx/timeout, returns `htmlToText` of the body).
2. Write `scripts/url-import.test.ts` covering every acceptance-criteria behavior for the pure functions, plus mocked-fetch tests for `fetchUrlAsText` (success, non-OK status, network rejection).
3. Update `scripts/ai-proxy.ts`: make the request handler async; when the request has exactly one message and `extractUrlFromMessage` matches, call `fetchUrlAsText` before spawning `claude` — on failure respond `502` with the exact ADR error message and return; on success replace the message content via `buildFetchedPageMessage` and fall through to the unchanged `buildPrompt` → `spawn` flow. Non-URL and multi-message requests are untouched.
4. Run `pnpm test` / `pnpm lint` / `pnpm build`.
5. Manual verification against the live proxy (run on port 3457 via `AI_PROXY_PORT` since a pre-change instance held 3456): unreachable host → `502` + exact error body without spawning `claude`; 404 page → `502`; `URL: https://example.com` → page fetched, converted, Claude answered from page text (HTTP 200); plain-text message → Phase 1 passthrough unchanged (HTTP 200). All four passed on 2026-07-02.

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
