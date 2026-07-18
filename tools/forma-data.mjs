// Shared read-only data layer for Forma's local tooling (CLI + MCP server).
//
// Talks straight to the Forma production Postgres over the `postgres` npm
// package that already ships with the app (this file must live inside the repo
// so that import resolves). Everything here is READ-ONLY: the tools exist so an
// assistant can look at Andrew's training/nutrition data, never mutate it.
//
// Units match what Garmin syncs into the DB: distances in metres, paces in
// seconds-per-km, weights in kilograms, durations in seconds. Callers convert
// to imperial for display.
//
// Config comes from tools/.env (gitignored) or the ambient environment:
//   FORMA_DATABASE_URL  — Railway Postgres DATABASE_PUBLIC_URL (ssl required)
//   FORMA_USER_ID       — the user_id to scope every query to. Optional: if
//                         unset and the DB has exactly one user, it's inferred.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader — avoids a runtime dependency on dotenv. Only sets keys
// that aren't already present in the environment.
function loadDotEnv() {
  let raw;
  try {
    raw = readFileSync(join(HERE, ".env"), "utf8");
  } catch {
    return; // no tools/.env — rely on the ambient environment
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const DATABASE_URL =
  process.env.FORMA_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "No database URL. Set FORMA_DATABASE_URL in tools/.env (see tools/README.md).",
  );
}

// Lazy singleton so importing this module doesn't open a connection until a
// query actually runs (keeps `--help` and arg-parsing instant).
let _sql = null;
function db() {
  if (!_sql) _sql = postgres(DATABASE_URL, { ssl: "require", max: 3 });
  return _sql;
}

export async function close() {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}

let _userId = process.env.FORMA_USER_ID || null;
// Resolve the user id once. Explicit config wins; otherwise infer it when the
// DB holds exactly one athlete (the common single-user case).
async function userId() {
  if (_userId) return _userId;
  const rows = await db()`SELECT DISTINCT user_id FROM activities WHERE user_id IS NOT NULL`;
  if (rows.length === 1) {
    _userId = rows[0].user_id;
    return _userId;
  }
  throw new Error(
    rows.length === 0
      ? "No users found in the database."
      : `Multiple users found; set FORMA_USER_ID. Candidates: ${rows.map((r) => r.user_id).join(", ")}`,
  );
}

const round = (n, digits = 1) =>
  n == null ? null : Number(Number(n).toFixed(digits));

function cutoff(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
// Monday-based ISO week start for a YYYY-MM-DD string.
function weekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// ── Query functions ────────────────────────────────────────────────────────
// Each returns a plain JSON-serialisable object. `opts` is a flat object of
// already-parsed options (see the CLI/MCP schemas for what each accepts).

export async function activities(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 30);
  const limit = Number(opts.limit ?? 40);
  const type = opts.type ?? null;
  const sql = db();
  const rows = await sql`
    SELECT garmin_activity_id AS id, date, name, activity_type AS type,
           distance_meters, duration_seconds,
           avg_pace_seconds_per_km AS pace_sec_per_km,
           avg_heart_rate AS avg_hr, max_heart_rate AS max_hr,
           aerobic_training_effect AS aerobic_te, avg_cadence AS cadence,
           calories, notes
    FROM activities
    WHERE user_id = ${uid}
      AND date >= ${cutoff(days)}
      ${type ? sql`AND activity_type = ${type}` : sql``}
    ORDER BY date DESC
    LIMIT ${limit}`;
  return { count: rows.length, rows };
}

export async function activity(opts = {}) {
  const uid = await userId();
  const id = String(opts.id ?? opts.garminActivityId ?? "");
  if (!id) return { error: "id (garminActivityId) is required" };
  const sql = db();
  const [row] = await sql`
    SELECT garmin_activity_id AS id, date, name, activity_type AS type,
           distance_meters, duration_seconds, moving_duration_seconds,
           avg_pace_seconds_per_km AS pace_sec_per_km,
           avg_heart_rate AS avg_hr, max_heart_rate AS max_hr,
           avg_cadence AS cadence, calories, elevation_gain_meters,
           avg_power_watts, aerobic_training_effect, anaerobic_training_effect,
           notes
    FROM activities WHERE user_id = ${uid} AND garmin_activity_id = ${id}`;
  if (!row) return { error: `No activity with id ${id}` };
  const laps = await sql`
    SELECT lap_index AS lap, distance_meters, duration_seconds,
           avg_pace_seconds_per_km AS pace_sec_per_km,
           avg_heart_rate AS avg_hr, max_heart_rate AS max_hr,
           avg_cadence AS cadence, calories, elevation_gain_meters
    FROM activity_laps
    WHERE user_id = ${uid} AND garmin_activity_id = ${id}
    ORDER BY lap_index ASC`;
  const [detail] = await sql`
    SELECT hr_zones, exercise_sets FROM activity_details
    WHERE user_id = ${uid} AND garmin_activity_id = ${id}`;
  return {
    activity: row,
    laps,
    hrZones: detail?.hr_zones ?? null,
    exerciseSets: detail?.exercise_sets ?? null,
  };
}

export async function trainingSummary(opts = {}) {
  const uid = await userId();
  const weeks = Number(opts.weeks ?? 12);
  const rows = await db()`
    SELECT date, distance_meters, duration_seconds
    FROM activities
    WHERE user_id = ${uid} AND activity_type = 'run'
      AND date >= ${cutoff(weeks * 7)}`;
  const byWeek = new Map();
  for (const r of rows) {
    const wk = weekStart(r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date));
    const acc = byWeek.get(wk) ?? { runs: 0, meters: 0, seconds: 0 };
    acc.runs += 1;
    acc.meters += r.distance_meters ?? 0;
    acc.seconds += r.duration_seconds ?? 0;
    byWeek.set(wk, acc);
  }
  const summary = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, a]) => ({
      weekStart: week,
      runs: a.runs,
      distanceKm: round(a.meters / 1000),
      durationMin: Math.round(a.seconds / 60),
      avgPaceSecPerKm: a.meters > 0 ? Math.round(a.seconds / (a.meters / 1000)) : null,
    }));
  return { weeks: summary.length, summary };
}

export async function sleep(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 14);
  const rows = await db()`
    SELECT date, total_sleep_seconds, deep_sleep_seconds, rem_sleep_seconds,
           light_sleep_seconds, awake_sleep_seconds, sleep_score
    FROM sleep_logs
    WHERE user_id = ${uid} AND date >= ${cutoff(days)}
    ORDER BY date ASC`;
  return { count: rows.length, rows };
}

export async function bodyComposition(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 120);
  const rows = await db()`
    SELECT date, weight_kg, body_fat_pct, muscle_mass_kg, body_water_pct, bmi
    FROM body_composition
    WHERE user_id = ${uid} AND date >= ${cutoff(days)}
    ORDER BY date ASC`;
  return { count: rows.length, rows };
}

// Per-day nutrition aggregates (one row per day). The user may not log every
// meal, so treat low days as possibly incomplete.
export async function nutrition(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 14);
  const rows = await db()`
    SELECT date,
           count(*)::int AS meals,
           round(sum(coalesce(calories,0)))::int AS calories,
           round(sum(coalesce(protein_g,0)))::int AS protein_g,
           round(sum(coalesce(carbs_g,0)))::int AS carbs_g,
           round(sum(coalesce(fat_g,0)))::int AS fat_g,
           round(sum(coalesce(fiber_g,0)))::int AS fiber_g
    FROM meals
    WHERE user_id = ${uid} AND date >= ${cutoff(days)}
    GROUP BY date ORDER BY date ASC`;
  return { days: rows.length, daily: rows };
}

// Individual meal rows for a single day (default today).
export async function meals(opts = {}) {
  const uid = await userId();
  const date = opts.date ?? todayStr();
  const rows = await db()`
    SELECT id, meal_type, name, description, servings,
           calories, protein_g, carbs_g, fat_g, fiber_g
    FROM meals
    WHERE user_id = ${uid} AND date = ${date}
    ORDER BY created_at ASC`;
  return { date, count: rows.length, rows };
}

// Daily Garmin wellness (steps, floors) with goals.
export async function steps(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 14);
  const rows = await db()`
    SELECT date, steps, step_goal, floors_ascended, floors_goal
    FROM daily_summaries
    WHERE user_id = ${uid} AND date >= ${cutoff(days)}
    ORDER BY date ASC`;
  return { count: rows.length, rows };
}

// Per-day water totals in ml.
export async function water(opts = {}) {
  const uid = await userId();
  const days = Number(opts.days ?? 14);
  const rows = await db()`
    SELECT date, sum(amount_ml)::int AS total_ml, count(*)::int AS entries
    FROM water_logs
    WHERE user_id = ${uid} AND date >= ${cutoff(days)}
    GROUP BY date ORDER BY date ASC`;
  return { count: rows.length, rows };
}

// Forward-looking plan: upcoming prescribed workouts + goal races.
export async function plan(opts = {}) {
  const uid = await userId();
  const sql = db();
  const upcoming = await sql`
    SELECT date, activity_type AS type, title, description,
           distance_meters, duration_seconds, status
    FROM planned_workouts
    WHERE athlete_user_id = ${uid} AND date >= ${todayStr()}
    ORDER BY date ASC LIMIT 40`;
  const goalRaces = await sql`
    SELECT date, name FROM races
    WHERE athlete_user_id = ${uid} AND date >= ${todayStr()}
    ORDER BY date ASC`;
  return { plannedWorkouts: upcoming, races: goalRaces };
}

// A single-day snapshot pulling the day's key numbers together. Great as a
// first call to understand "how is Andrew doing today?".
export async function today(opts = {}) {
  const uid = await userId();
  const date = opts.date ?? todayStr();
  const sql = db();

  const [goalsRow] = await sql`
    SELECT calories, protein_g, carbs_g, fat_g FROM nutrition_goals
    WHERE user_id = ${uid}`;
  const goals = goalsRow ?? { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 };

  const [mealTot] = await sql`
    SELECT count(*)::int AS meals,
           round(sum(coalesce(calories,0)))::int AS calories,
           round(sum(coalesce(protein_g,0)))::int AS protein_g,
           round(sum(coalesce(carbs_g,0)))::int AS carbs_g,
           round(sum(coalesce(fat_g,0)))::int AS fat_g
    FROM meals WHERE user_id = ${uid} AND date = ${date}`;

  const [waterRow] = await sql`
    SELECT coalesce(sum(amount_ml),0)::int AS total_ml
    FROM water_logs WHERE user_id = ${uid} AND date = ${date}`;

  const [stepsRow] = await sql`
    SELECT steps, step_goal FROM daily_summaries
    WHERE user_id = ${uid} AND date = ${date}`;

  // Sleep is recorded for the night that ends on `date`.
  const [sleepRow] = await sql`
    SELECT total_sleep_seconds, sleep_score FROM sleep_logs
    WHERE user_id = ${uid} AND date = ${date}`;

  const dayActivities = await sql`
    SELECT garmin_activity_id AS id, name, activity_type AS type,
           distance_meters, duration_seconds,
           avg_pace_seconds_per_km AS pace_sec_per_km, avg_heart_rate AS avg_hr
    FROM activities WHERE user_id = ${uid} AND date = ${date}
    ORDER BY created_at ASC`;

  const planned = await sql`
    SELECT activity_type AS type, title, description, status,
           distance_meters, duration_seconds
    FROM planned_workouts
    WHERE athlete_user_id = ${uid} AND date = ${date}
    ORDER BY created_at ASC`;

  return {
    date,
    nutrition: {
      goals,
      totals: mealTot,
      remaining: {
        calories: goals.calories - (mealTot?.calories ?? 0),
        protein_g: goals.protein_g - (mealTot?.protein_g ?? 0),
        carbs_g: goals.carbs_g - (mealTot?.carbs_g ?? 0),
        fat_g: goals.fat_g - (mealTot?.fat_g ?? 0),
      },
    },
    waterMl: waterRow?.total_ml ?? 0,
    steps: stepsRow ?? null,
    sleep: sleepRow ?? null,
    activities: dayActivities,
    plannedWorkouts: planned,
  };
}

// Guarded read-only SQL escape hatch. Only a single SELECT/WITH statement is
// allowed, and the plaintext-credential table is off-limits. This is the
// power-user path when a purpose-built tool above doesn't fit.
const BLOCKED_TABLES = ["garmin_connections"];
export async function query(opts = {}) {
  const text = String(opts.sql ?? "").trim();
  if (!text) return { error: "sql is required" };
  const lowered = text.toLowerCase();
  const firstWord = lowered.split(/\s+/)[0];
  if (firstWord !== "select" && firstWord !== "with") {
    return { error: "Only read-only SELECT / WITH queries are allowed." };
  }
  // Block stacked statements (allow a single trailing semicolon).
  if (text.replace(/;\s*$/, "").includes(";")) {
    return { error: "Only a single statement is allowed." };
  }
  const forbidden = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy)\b/;
  if (forbidden.test(lowered)) {
    return { error: "Query contains a forbidden keyword." };
  }
  for (const t of BLOCKED_TABLES) {
    if (new RegExp(`\\b${t}\\b`).test(lowered)) {
      return { error: `Access to '${t}' is not allowed.` };
    }
  }
  const limit = Number(opts.limit ?? 200);
  const rows = await db().unsafe(text);
  const capped = rows.slice(0, limit);
  return { count: capped.length, truncated: rows.length > capped.length, rows: capped };
}

// Registry consumed by both the CLI and the MCP server so tool definitions
// live in exactly one place.
export const TOOLS = {
  today: {
    fn: today,
    summary: "Single-day snapshot: nutrition vs goals, water, steps, sleep, activities, planned workouts.",
    args: { date: "YYYY-MM-DD (default today)" },
  },
  activities: {
    fn: activities,
    summary: "List synced workouts, newest first.",
    args: { days: "lookback days (default 30)", type: "run|walk|ride|strength|swim|other", limit: "max rows (default 40)" },
  },
  activity: {
    fn: activity,
    summary: "One activity in full: summary, per-lap splits, HR zones, strength sets.",
    args: { id: "garminActivityId (required)" },
  },
  "training-summary": {
    fn: trainingSummary,
    summary: "Weekly running volume: runs, km, minutes, avg pace.",
    args: { weeks: "lookback weeks (default 12)" },
  },
  sleep: {
    fn: sleep,
    summary: "Nightly sleep stages and score, oldest first.",
    args: { days: "lookback days (default 14)" },
  },
  "body-composition": {
    fn: bodyComposition,
    summary: "Smart-scale history: weight, body fat %, muscle mass, BMI.",
    args: { days: "lookback days (default 120)" },
  },
  nutrition: {
    fn: nutrition,
    summary: "Per-day nutrition totals (calories + macros).",
    args: { days: "lookback days (default 14)" },
  },
  meals: {
    fn: meals,
    summary: "Individual logged meals for one day.",
    args: { date: "YYYY-MM-DD (default today)" },
  },
  steps: {
    fn: steps,
    summary: "Daily steps and floors with goals.",
    args: { days: "lookback days (default 14)" },
  },
  water: {
    fn: water,
    summary: "Daily water intake totals (ml).",
    args: { days: "lookback days (default 14)" },
  },
  plan: {
    fn: plan,
    summary: "Upcoming prescribed workouts and goal races.",
    args: {},
  },
  query: {
    fn: query,
    summary: "Run a read-only SELECT against the Forma DB (single statement, no writes).",
    args: { sql: "a SELECT/WITH query (required)", limit: "max rows (default 200)" },
  },
};
