# Forma tools — read-only data access for the terminal & AI agents

Two ways to look at Andrew's Forma data (training, nutrition, sleep, body
composition, the plan) from outside the web app, both over the **same
read-only** query layer in `forma-data.mjs`:

- **CLI** — `forma-cli.mjs`, for humans and shell scripts.
- **MCP server** — `forma-mcp.mjs`, so Claude Code (or any MCP client) can call
  the data as tools.

Everything is strictly read-only. There is no code path here that writes to the
database.

## Setup

Config lives in `tools/.env` (gitignored — it holds the DB credential):

```
FORMA_DATABASE_URL=postgresql://…@reseau.proxy.rlwy.net:50052/railway
FORMA_USER_ID=user_xxxxxxxxxxxxxxxxxxxxxxxxx
```

- `FORMA_DATABASE_URL` — the Railway Postgres **`DATABASE_PUBLIC_URL`** (SSL is
  required and set automatically). Pull it from the Railway dashboard or via the
  Railway MCP `list_variables` on the Postgres service.
- `FORMA_USER_ID` — the athlete to scope every query to. Optional: when the DB
  holds exactly one user it's inferred, but pinning it is clearer.

No install step — both scripts use the `postgres` package already vendored in
the app's `node_modules`, which is why they live inside the repo.

## CLI

```bash
node tools/forma-cli.mjs                 # list commands
node tools/forma-cli.mjs today           # today's snapshot (JSON)
node tools/forma-cli.mjs today --pretty  # indented
node tools/forma-cli.mjs activities --days 14 --type run --limit 5
node tools/forma-cli.mjs activity --id 23641843180        # splits, HR zones, sets
node tools/forma-cli.mjs training-summary --weeks 8
node tools/forma-cli.mjs body-composition --days 60
node tools/forma-cli.mjs query --sql "select date, weight_kg from body_composition order by date desc limit 5"
```

Output is JSON on stdout. Units are metric (metres, sec/km paces, kg, seconds)
— the same units Garmin syncs into the DB.

### Commands

| Command | What it returns |
| --- | --- |
| `today` | One-day snapshot: nutrition vs goals, water, steps, sleep, activities, planned workouts |
| `activities` | List of synced workouts, newest first |
| `activity` | One activity in full: summary, per-lap splits, HR zones, strength sets |
| `training-summary` | Weekly running volume (runs, km, minutes, avg pace) |
| `sleep` | Nightly sleep stages and score |
| `body-composition` | Smart-scale history (weight, body fat %, muscle mass, BMI) |
| `nutrition` | Per-day nutrition totals |
| `meals` | Individual meals for one day |
| `steps` | Daily steps and floors |
| `water` | Daily water intake |
| `plan` | Upcoming prescribed workouts and goal races |
| `query` | Read-only `SELECT`/`WITH` escape hatch (single statement, no writes) |

The `query` tool refuses anything that isn't a single `SELECT`/`WITH`, blocks
write/DDL keywords and stacked statements, and denies the `garmin_connections`
table (it stores plaintext Garmin credentials).

## MCP server

Registered for this repo in `../.mcp.json`, so Claude Code launches it
automatically as the **`forma`** server (approve it once when prompted). It
exposes every command above as an MCP tool with the same names and arguments.

It speaks MCP's stdio transport (newline-delimited JSON-RPC 2.0) directly with
no SDK dependency, so it adds nothing to the Next app's build. To sanity-check
it by hand:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"today","arguments":{}}}' \
  | node tools/forma-mcp.mjs
```
