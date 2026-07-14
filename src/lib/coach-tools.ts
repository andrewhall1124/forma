import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  activities,
  bodyComposition,
  sleepLogs,
  meals,
  plannedWorkouts,
  races,
} from "@/db/schema";
import { and, asc, desc, eq, gte } from "drizzle-orm";

// Read-only data tools for the AI coach. Every tool is scoped to a single
// user id (the resolved subject) and only ever reads — the coach advises, it
// never writes to Forma. Payloads are kept compact (rounded numbers, only the
// columns that matter) to save tokens.

// All distances are metres, paces seconds-per-km, weights kilograms, durations
// seconds — the same units Garmin syncs into the DB. The system prompt tells
// the model to convert to imperial for the user.

function cutoff(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const round = (n: number | null, digits = 1): number | null =>
  n == null ? null : Number(n.toFixed(digits));

// Monday-based ISO week start for a YYYY-MM-DD date string.
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_body_composition",
    description:
      "The user's Garmin smart-scale history: weight (kg), body fat %, muscle mass (kg), body water %, and BMI, one row per weigh-in, oldest first. Use for weight and body-composition trends and goals.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to include. Default 120." },
      },
    },
  },
  {
    name: "get_training_summary",
    description:
      "Per-week running volume (number of runs, total distance in km, total moving time in minutes, and volume-weighted average pace in sec/km), most recent weeks last. The cheapest way to understand training load and consistency. Prefer this over listing every run.",
    input_schema: {
      type: "object",
      properties: {
        weeks: { type: "integer", description: "How many weeks back to include. Default 12." },
      },
    },
  },
  {
    name: "get_activities",
    description:
      "Individual workouts (Garmin). Each row has date, name, type, distance (m), duration (s), average pace (sec/km), avg/max heart rate, aerobic training effect, and cadence. Use to inspect specific sessions, quality workouts, or long runs.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to include. Default 30." },
        type: {
          type: "string",
          description: "Optional filter: run | walk | ride | strength | swim | other.",
        },
        limit: { type: "integer", description: "Max rows to return. Default 40." },
      },
    },
  },
  {
    name: "get_sleep",
    description:
      "Nightly sleep (Garmin): total, deep, REM sleep in seconds and a 0-100 sleep score, one row per night, oldest first. Use for recovery context.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to include. Default 14." },
      },
    },
  },
  {
    name: "get_nutrition",
    description:
      "Logged meals aggregated per day: meal count and total calories, protein, carbs, fat, fiber (grams). One row per day, oldest first. Note the user may not log every meal, so treat low days as possibly incomplete.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to include. Default 14." },
      },
    },
  },
  {
    name: "get_plan",
    description:
      "The user's forward-looking plan: upcoming planned/prescribed workouts (next several weeks) and any goal races with their dates. Use to align advice with what's already scheduled.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function runCoachTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "get_body_composition": {
      const days = Number(input.days ?? 120);
      const rows = await db
        .select({
          date: bodyComposition.date,
          weightKg: bodyComposition.weightKg,
          bodyFatPct: bodyComposition.bodyFatPct,
          muscleMassKg: bodyComposition.muscleMassKg,
          bodyWaterPct: bodyComposition.bodyWaterPct,
          bmi: bodyComposition.bmi,
        })
        .from(bodyComposition)
        .where(and(eq(bodyComposition.userId, userId), gte(bodyComposition.date, cutoff(days))))
        .orderBy(asc(bodyComposition.date));
      return { count: rows.length, rows };
    }

    case "get_training_summary": {
      const weeks = Number(input.weeks ?? 12);
      const rows = await db
        .select({
          date: activities.date,
          distanceMeters: activities.distanceMeters,
          durationSeconds: activities.durationSeconds,
          paceSecPerKm: activities.avgPaceSecondsPerKm,
        })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            eq(activities.activityType, "run"),
            gte(activities.date, cutoff(weeks * 7)),
          ),
        );

      const byWeek = new Map<
        string,
        { runs: number; meters: number; seconds: number }
      >();
      for (const r of rows) {
        const wk = weekStart(r.date);
        const acc = byWeek.get(wk) ?? { runs: 0, meters: 0, seconds: 0 };
        acc.runs += 1;
        acc.meters += r.distanceMeters ?? 0;
        acc.seconds += r.durationSeconds ?? 0;
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

    case "get_activities": {
      const days = Number(input.days ?? 30);
      const limit = Number(input.limit ?? 40);
      const type = typeof input.type === "string" ? input.type : null;
      const where = type
        ? and(
            eq(activities.userId, userId),
            eq(activities.activityType, type),
            gte(activities.date, cutoff(days)),
          )
        : and(eq(activities.userId, userId), gte(activities.date, cutoff(days)));
      const rows = await db
        .select({
          date: activities.date,
          name: activities.name,
          type: activities.activityType,
          distanceMeters: activities.distanceMeters,
          durationSeconds: activities.durationSeconds,
          paceSecPerKm: activities.avgPaceSecondsPerKm,
          avgHr: activities.avgHeartRate,
          maxHr: activities.maxHeartRate,
          aerobicTE: activities.aerobicTrainingEffect,
          cadence: activities.avgCadence,
        })
        .from(activities)
        .where(where)
        .orderBy(desc(activities.date))
        .limit(limit);
      return { count: rows.length, rows };
    }

    case "get_sleep": {
      const days = Number(input.days ?? 14);
      const rows = await db
        .select({
          date: sleepLogs.date,
          totalSleepSeconds: sleepLogs.totalSleepSeconds,
          deepSleepSeconds: sleepLogs.deepSleepSeconds,
          remSleepSeconds: sleepLogs.remSleepSeconds,
          sleepScore: sleepLogs.sleepScore,
        })
        .from(sleepLogs)
        .where(and(eq(sleepLogs.userId, userId), gte(sleepLogs.date, cutoff(days))))
        .orderBy(asc(sleepLogs.date));
      return { count: rows.length, rows };
    }

    case "get_nutrition": {
      const days = Number(input.days ?? 14);
      const rows = await db
        .select({
          date: meals.date,
          calories: meals.calories,
          proteinG: meals.proteinG,
          carbsG: meals.carbsG,
          fatG: meals.fatG,
          fiberG: meals.fiberG,
        })
        .from(meals)
        .where(and(eq(meals.userId, userId), gte(meals.date, cutoff(days))));

      const byDay = new Map<
        string,
        { meals: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }
      >();
      for (const m of rows) {
        const acc =
          byDay.get(m.date) ?? { meals: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
        acc.meals += 1;
        acc.calories += m.calories ?? 0;
        acc.proteinG += m.proteinG ?? 0;
        acc.carbsG += m.carbsG ?? 0;
        acc.fatG += m.fatG ?? 0;
        acc.fiberG += m.fiberG ?? 0;
        byDay.set(m.date, acc);
      }

      const daily = [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, a]) => ({
          date,
          meals: a.meals,
          calories: Math.round(a.calories),
          proteinG: Math.round(a.proteinG),
          carbsG: Math.round(a.carbsG),
          fatG: Math.round(a.fatG),
          fiberG: Math.round(a.fiberG),
        }));
      return { days: daily.length, daily };
    }

    case "get_plan": {
      const upcoming = await db
        .select({
          date: plannedWorkouts.date,
          type: plannedWorkouts.activityType,
          title: plannedWorkouts.title,
          description: plannedWorkouts.description,
          distanceMeters: plannedWorkouts.distanceMeters,
          durationSeconds: plannedWorkouts.durationSeconds,
          status: plannedWorkouts.status,
        })
        .from(plannedWorkouts)
        .where(
          and(eq(plannedWorkouts.athleteUserId, userId), gte(plannedWorkouts.date, today())),
        )
        .orderBy(asc(plannedWorkouts.date))
        .limit(40);
      const goalRaces = await db
        .select({ date: races.date, name: races.name })
        .from(races)
        .where(and(eq(races.athleteUserId, userId), gte(races.date, today())))
        .orderBy(asc(races.date));
      return { plannedWorkouts: upcoming, races: goalRaces };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
