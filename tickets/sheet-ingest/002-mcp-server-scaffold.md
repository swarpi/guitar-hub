# Ticket: Local MCP Server Scaffold — add_sheet, list_sheets, update_sheet

**Feature:** sheet-ingest
**Status:** Open
**Priority:** P1
**Estimate:** M
**Related:** ADR-0007 (Decision §1 "Architecture", tool table)
**Depends on:** sheet-ingest/001

## Context

ADR-0007's architecture moves the center of gravity for rich-media ingestion out of the browser and into Claude Code, connected to a local MCP (Model Context Protocol) server that exposes the collection as tools. This ticket builds the server process and its first three tools — `add_sheet`, `list_sheets`, `update_sheet` — leaving the fourth tool, `validate_notation`, to ticket 003.

The ADR is explicit about the write path: `add_sheet` must call the same `createSongLogic` function the web form uses (ADR-0006, constraint 2; carried into ADR-0007 §1), against the local dev database. No second write path, no schema divergence. The server is local-only infrastructure — it is never deployed (ADR-0007 §6) — and connects to the local SQLite dev database the same way `pnpm dev` and `pnpm seed` already do.

**Hard dependency:** `add_sheet`'s metadata (difficulty, key, source_url) and its instrument-aware call into `createSongLogic` depend on both the multi-instrument schema (branch `worktree-multi-instrument-001`, unmerged) and ticket 001 of this feature (the metadata columns). This ticket is **blocked until the multi-instrument branch merges to master and sheet-ingest ticket 001 is done.**

## Goal

A runnable local MCP server exposing `add_sheet`, `list_sheets`, and `update_sheet` as tools, each a thin adapter over the existing query/action layer against the local dev D1/SQLite database.

## Acceptance Criteria

- [ ] `@modelcontextprotocol/sdk` (or the current standard MCP TypeScript SDK) is added as a `devDependency` — the server is local tooling, not shipped to the edge build
- [ ] A new script `scripts/mcp-sheet-server.ts` starts an MCP server over stdio transport, runnable via a new `pnpm dev:mcp` script (mirroring the existing `pnpm dev:ai` pattern)
- [ ] The server connects to the local dev SQLite database using the same connection approach as `pnpm seed` (`better-sqlite3`), never inside code that could be bundled for the edge — consistent with the CLAUDE.md rule "production code never imports `better-sqlite3`"
- [ ] Tool `add_sheet`:
  - [ ] Accepts `title`, `artist`, `instrument` (`guitar` | `piano`), `content`, and optional `capo`, `notes`, `difficulty`, `key`, `sourceUrl`
  - [ ] Builds a `FormData`-equivalent input and calls `createSongLogic` from `src/app/actions.ts` unchanged — no reimplementation of validation, slug generation, or duplicate detection
  - [ ] On success, returns the created song's artist slug, song slug, and instrument
  - [ ] On failure (validation error, duplicate), returns the `{ error }` message from `createSongLogic` as the tool result, not a thrown exception
- [ ] Tool `list_sheets`:
  - [ ] Accepts optional `instrument` and optional `artist` filters
  - [ ] Returns an array of songs (id, title, artist, instrument, slug, difficulty, key) for duplicate detection and context — no full `content` field in the list response to keep tool output small
- [ ] Tool `update_sheet`:
  - [ ] Accepts a song `id` and the same optional fields as `add_sheet`
  - [ ] Calls `updateSongLogic` from `src/app/actions.ts` unchanged
  - [ ] Returns the same success/error shape pattern as `add_sheet`
- [ ] A README or top-of-file comment in `scripts/mcp-sheet-server.ts` documents how to register the server with Claude Code (the `.mcp.json` or `claude mcp add` invocation)
- [ ] Unit tests cover the three tool handlers against an in-memory `better-sqlite3` database, following the pattern in `src/app/actions.test.ts` (mock `@cloudflare/next-on-pages`, use `better-sqlite3` in-memory DB) — one success and one failure case per tool
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass (the MCP server script is excluded from the Next.js/edge build the same way `scripts/ai-proxy.ts` is)
- [ ] **`/ticket-verifier` invoked and approved** — do NOT check this box manually. Only the ticket-verifier agent marks this criterion.

## Out of Scope

- `validate_notation` — ticket 003 (ABC) and ticket 004 (MusicXML)
- Any media pipeline tooling (`yt-dlp`, `ffmpeg`, OMR, `basic-pitch`, `music21`) — tickets 005–007
- Writing to production D1 — the ADR's open question 2 assumes local-dev-only writes; production is reached via the normal deploy/seed path, not this server
- Auth/transport hardening beyond stdio — ADR-0007's open question 1 assumes a local stdio server, single user, no auth
- The `sheet-ingest/SKILL.md` skill content — ticket 008

## Notes

- Keep the adapter thin. If a tool handler starts reimplementing validation or slug logic instead of delegating to `createSongLogic`/`updateSongLogic`, that is a sign the boundary is wrong — stop and call the existing function.
- `list_sheets` intentionally omits `content` from its response to keep tool call payloads small when Claude is just checking for duplicates or browsing context, not reading a full song.
- The MCP TypeScript SDK's stdio transport is the simplest option for a single local user and matches the ADR's assumption (open question 1). If the chosen SDK version has a different recommended pattern by the time this ticket starts, prefer the SDK's documented approach over inventing one.

## Implementation Plan

_To be filled in before starting work._

1. Step 1
2. Step 2
3. Step 3

## Post-Implementation

> The last acceptance criterion (`/ticket-verifier` invoked and approved) is a hard gate. When implementation is complete and all other checks pass, invoke `/ticket-verifier` with this ticket. The ticket-verifier — not you — checks that box. A ticket is not Done until the ticket-verifier approves it.
