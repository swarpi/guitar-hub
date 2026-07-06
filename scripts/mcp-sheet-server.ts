// Local MCP server exposing the Music Hub collection as tools (ADR-0007):
//   add_sheet    — insert a song via createSongLogic (same path as the web form)
//   list_sheets  — query existing songs for duplicate detection and context
//   update_sheet — edit a song's content or metadata via updateSongLogic
//
// Local-only infrastructure — never deployed. Talks to the local dev SQLite
// database (the same file `pnpm dev` and `pnpm seed` use) over better-sqlite3.
//
// Run it:
//   pnpm dev:mcp                       # stdio transport, waits for a client
//   DB_PATH=/path/to.sqlite pnpm dev:mcp   # point at a different local db
//
// Register with Claude Code (from the repo root):
//   claude mcp add music-hub-sheets -- pnpm dev:mcp
//
// ...or add to .mcp.json:
//   {
//     "mcpServers": {
//       "music-hub-sheets": {
//         "command": "pnpm",
//         "args": ["dev:mcp"]
//       }
//     }
//   }
//
// The dev:mcp script runs tsx with tsconfig.mcp.json, which shims
// `@cloudflare/next-on-pages` so src/app/actions.ts imports cleanly outside
// the Next.js runtime (see scripts/next-on-pages-shim.ts).

import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";

import * as schema from "../src/db/schema";
import {
  addSheet,
  type Db,
  listSheets,
  type SheetWriteResult,
  updateSheet,
} from "./mcp-sheet-tools";

// Same default as src/db/seed.ts: the miniflare D1 object for the local dev db.
const DB_PATH =
  process.env.DB_PATH ??
  resolve(
    import.meta.dirname,
    "../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/3c9bc9ebbf8d47b6582e4d8b0a036070724f940ae907dc856bcd6db3600bc2d6.sqlite",
  );

let sqlite: Database.Database;
try {
  sqlite = new Database(DB_PATH, { fileMustExist: true });
} catch {
  console.error(
    `No local dev database at ${DB_PATH}.\n` +
      "Run `pnpm dev` once to create it (and `pnpm seed` to populate it), " +
      "or set DB_PATH to an existing SQLite file.",
  );
  process.exit(1);
}

// better-sqlite3's Drizzle client is API-compatible with the D1 one for the
// query shapes the logic layer uses — same cast the test suite makes.
const db = drizzle(sqlite, { schema }) as unknown as Db;

const server = new McpServer({
  name: "music-hub-sheets",
  version: "0.1.0",
});

const instrumentSchema = z.enum(["guitar", "piano"]);

// Optional metadata shared by add_sheet and update_sheet. Values are still
// validated by createSongLogic/updateSongLogic — these zod schemas exist to
// document the tool interface, not to replace that validation.
const sheetMetadataFields = {
  capo: z.number().int().min(0).max(12).optional().describe("Capo fret (guitar)"),
  notes: z.string().optional().describe("Free-form performance notes"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  key: z.string().optional().describe("Musical key, e.g. 'G' or 'Am'"),
  sourceUrl: z
    .string()
    .optional()
    .describe("Provenance URL of the ingested content"),
};

function toToolResult(result: SheetWriteResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    isError: "error" in result,
  };
}

server.registerTool(
  "add_sheet",
  {
    description:
      "Add a song to the local Music Hub dev database. Uses the same " +
      "validation, slug generation, and duplicate detection as the web form. " +
      "Returns {instrument, artistSlug, songSlug} on success or {error}.",
    inputSchema: {
      title: z.string(),
      artist: z.string(),
      instrument: instrumentSchema,
      content: z.string().describe("Tab or notation content"),
      ...sheetMetadataFields,
    },
  },
  async (input) => toToolResult(await addSheet(db, input)),
);

server.registerTool(
  "list_sheets",
  {
    description:
      "List songs in the local Music Hub dev database, optionally filtered " +
      "by instrument and/or artist. Returns metadata only (no content) — " +
      "use it for duplicate detection and browsing context.",
    inputSchema: {
      instrument: instrumentSchema.optional(),
      artist: z
        .string()
        .optional()
        .describe("Artist name or slug, e.g. 'Sungha Jung' or 'sungha-jung'"),
    },
  },
  async (input) => {
    const sheets = await listSheets(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(sheets) }],
    };
  },
);

server.registerTool(
  "update_sheet",
  {
    description:
      "Update an existing song's content or metadata by id. Fields not " +
      "provided keep their current values; instrument cannot be changed. " +
      "Returns {instrument, artistSlug, songSlug} on success or {error}.",
    inputSchema: {
      id: z.string().describe("Song id (from list_sheets)"),
      title: z.string().optional(),
      artist: z.string().optional(),
      instrument: instrumentSchema
        .optional()
        .describe("Must match the song's existing instrument"),
      content: z.string().optional().describe("Tab or notation content"),
      ...sheetMetadataFields,
    },
  },
  async (input) => toToolResult(await updateSheet(db, input)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr, not stdout — stdout carries the MCP protocol stream.
  console.error(`music-hub-sheets MCP server running (db: ${DB_PATH})`);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
