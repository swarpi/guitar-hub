import { createServer } from "node:http";
import { spawn } from "node:child_process";

import {
  buildFetchedPageMessage,
  extractUrlFromMessage,
  fetchUrlAsText,
} from "./url-import";
import { runImageExtraction } from "./image-import";

const PORT = Number(process.env.AI_PROXY_PORT) || 3456;
const URL_FETCH_ERROR = "Could not fetch the URL. Check the link and try again.";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
  system?: string;
  model?: string;
  max_tokens?: number;
  instrument?: "guitar" | "piano";
  /** Legacy single-image field (ADR-0009). Superseded by `images`. */
  image?: { mediaType: string; data: string };
  /** Multi-image field (ADR-0010). Takes precedence over `image`. */
  images?: Array<{ mediaType: string; data: string }>;
}

createServer((req, res) => {
  // CORS for browser access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, anthropic-version, anthropic-dangerous-allow-browser"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/v1/messages") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Not found" } }));
    return;
  }

  let body = "";
  req.on("data", (chunk: Buffer) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body) as RequestBody;

      // Image mode (ADR-0009, multi-image + multi-turn per ADR-0010): when the
      // request carries base64 image data — legacy singular `image` or plural
      // `images` — write temp files, point `claude -p` at those paths with the
      // conversation history threaded in, and return the same envelope.
      // Checked BEFORE URL detection (ADR-0009 §5).
      if (data.image || data.images) {
        const count = data.images?.length ?? 1;
        console.log(
          `-> image import (${count} image${count === 1 ? "" : "s"}, instrument: ${data.instrument ?? "guitar"})`
        );
        const result = await runImageExtraction({
          image: data.image,
          images: data.images,
          messages: data.messages,
          instrument: data.instrument,
          system: data.system,
          model: data.model,
        });
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
        return;
      }

      // Phase 2 (ADR-0006): a single "URL: <url>" message means the proxy
      // fetches the page itself and prompts Claude with the page text.
      const url =
        data.messages.length === 1
          ? extractUrlFromMessage(data.messages[0].content)
          : null;
      if (url) {
        console.log(`-> fetching ${url}`);
        let pageText: string;
        try {
          pageText = await fetchUrlAsText(url);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error(`  x url fetch failed: ${reason.substring(0, 200)}`);
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: URL_FETCH_ERROR } }));
          return;
        }
        data.messages = [
          { role: "user", content: buildFetchedPageMessage(url, pageText) },
        ];
      }

      const prompt = buildPrompt(data);
      const args = [
        "-p",
        prompt,
        "--output-format",
        "text",
        "--model",
        data.model ?? "claude-sonnet-4-5",
      ];
      if (data.system) {
        args.push("--system-prompt", data.system);
      }

      console.log(
        `-> claude -p "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}" (model: ${data.model ?? "claude-sonnet-4-5"})`
      );

      const child = spawn("claude", args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

      child.on("close", (code) => {
        if (code !== 0) {
          console.error(`  x exit ${code}: ${stderr.substring(0, 200)}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: {
                message: stderr.trim() || `Process exited with code ${code}`,
              },
            })
          );
          return;
        }

        const text = stdout.trim();
        console.log(
          `  ok ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}`
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            content: [{ type: "text", text }],
            model: data.model ?? "claude-sonnet-4-5",
            role: "assistant",
          })
        );
      });

      child.on("error", (err) => {
        console.error(`  x spawn error: ${err.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: err.message } }));
      });
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Invalid JSON" } }));
    }
  });
}).listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}`);
  console.log(`Routes: POST /v1/messages -> claude -p`);
  console.log(`Press Ctrl+C to stop\n`);
});

function buildPrompt(data: RequestBody): string {
  if (data.messages.length === 1) {
    return data.messages[0].content;
  }
  return data.messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}
