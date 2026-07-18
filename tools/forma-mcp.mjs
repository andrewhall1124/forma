#!/usr/bin/env node
// forma MCP server — exposes the read-only Forma data layer as MCP tools over
// stdio. Deliberately dependency-free: MCP's stdio transport is just
// newline-delimited JSON-RPC 2.0, which is a few dozen lines to speak directly.
// This keeps the Next app's dependency tree (and its Railway build) untouched.
//
// Registered via .mcp.json at the repo root; Claude Code launches it with
//   node tools/forma-mcp.mjs
// Config (DB url, user id) comes from tools/.env — see tools/README.md.
import { createInterface } from "node:readline";
import { TOOLS, close } from "./forma-data.mjs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "forma", version: "1.0.0" };

// Option keys that are numeric — surfaced as integers in the JSON schema so the
// client sends the right type. Everything else is a string.
const INTEGER_ARGS = new Set(["days", "weeks", "limit"]);
const REQUIRED_ARGS = { activity: ["id"], query: ["sql"] };

function toolList() {
  return Object.entries(TOOLS).map(([name, def]) => {
    const properties = {};
    for (const [arg, desc] of Object.entries(def.args)) {
      properties[arg] = {
        type: INTEGER_ARGS.has(arg) ? "integer" : "string",
        description: desc,
      };
    }
    return {
      name,
      description: def.summary,
      inputSchema: {
        type: "object",
        properties,
        ...(REQUIRED_ARGS[name] ? { required: REQUIRED_ARGS[name] } : {}),
      },
    };
  });
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      reply(id, {
        // Echo the client's protocol version when supplied, for compatibility.
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;

    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications: no response

    case "ping":
      reply(id, {});
      return;

    case "tools/list":
      reply(id, { tools: toolList() });
      return;

    case "tools/call": {
      const name = params?.name;
      const def = TOOLS[name];
      if (!def) {
        replyError(id, -32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const result = await def.fn(params?.arguments ?? {});
        reply(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: Boolean(result && result.error),
        });
      } catch (err) {
        reply(id, {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (!isNotification) replyError(id, -32601, `Method not found: ${method}`);
  }
}

// Track in-flight handlers so a stdin close (e.g. piped input ending) drains
// pending DB calls before we tear down the connection and exit.
const pending = new Set();

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore unparseable lines
  }
  const p = handle(msg)
    .catch((err) => {
      if (msg?.id != null) replyError(msg.id, -32603, err?.message ?? String(err));
    })
    .finally(() => pending.delete(p));
  pending.add(p);
});
rl.on("close", async () => {
  await Promise.allSettled([...pending]);
  await close();
  process.exit(0);
});
