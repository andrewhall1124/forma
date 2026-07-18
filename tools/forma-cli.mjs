#!/usr/bin/env node
// forma CLI — quick read-only access to Andrew's Forma data from the terminal.
//
//   node tools/forma-cli.mjs <command> [--flag value ...]
//
// Examples:
//   node tools/forma-cli.mjs today
//   node tools/forma-cli.mjs activities --days 14 --type run
//   node tools/forma-cli.mjs activity --id 12345678901
//   node tools/forma-cli.mjs query --sql "select date, weight_kg from body_composition order by date desc limit 5"
//
// Prints JSON to stdout. Config lives in tools/.env (see tools/README.md).
import { TOOLS, close } from "./forma-data.mjs";

function usage() {
  const lines = ["forma — read-only Forma data\n", "Commands:"];
  const width = Math.max(...Object.keys(TOOLS).map((k) => k.length));
  for (const [name, def] of Object.entries(TOOLS)) {
    lines.push(`  ${name.padEnd(width)}  ${def.summary}`);
    for (const [arg, desc] of Object.entries(def.args)) {
      lines.push(`  ${" ".repeat(width)}    --${arg}: ${desc}`);
    }
  }
  lines.push("\nOutput is JSON. Add --pretty for indented JSON.");
  return lines.join("\n");
}

// Parse `--key value` and boolean `--flag` pairs into an options object.
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      opts[key] = true;
    } else {
      opts[key] = next;
      i++;
    }
  }
  return opts;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(usage());
    return;
  }
  const def = TOOLS[cmd];
  if (!def) {
    console.error(`Unknown command: ${cmd}\n`);
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const opts = parseArgs(rest);
  const pretty = opts.pretty === true;
  delete opts.pretty;
  const result = await def.fn(opts);
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
}

main()
  .catch((err) => {
    console.error(err?.message ?? String(err));
    process.exitCode = 1;
  })
  .finally(close);
