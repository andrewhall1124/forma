export const dynamic = "force-dynamic";

import { db } from "@/db";
import { meals, waterLogs, sleepLogs, runs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDist(m: number) {
  return (m / 1000).toFixed(1) + " km";
}

function formatSleep(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export default async function Dashboard() {
  const today = todayStr();

  const [[calorieRow], [waterRow], [lastSleep], [lastRun]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${meals.calories}), 0)` })
      .from(meals)
      .where(eq(meals.date, today)),
    db
      .select({ total: sql<number>`coalesce(sum(${waterLogs.amountMl}), 0)` })
      .from(waterLogs)
      .where(eq(waterLogs.date, today)),
    db.select().from(sleepLogs).orderBy(desc(sleepLogs.date)).limit(1),
    db.select().from(runs).orderBy(desc(runs.date)).limit(1),
  ]);

  const calories = calorieRow?.total ?? 0;
  const waterMl = waterRow?.total ?? 0;

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm font-medium text-neutral-400">
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Calories"
          value={Math.round(calories)}
          unit="kcal"
          sub="today"
        />
        <StatCard
          label="Water"
          value={waterMl >= 1000 ? (waterMl / 1000).toFixed(1) : waterMl}
          unit={waterMl >= 1000 ? "L" : "mL"}
          sub="today"
        />
        <StatCard
          label="Sleep"
          value={lastSleep?.totalSleepSeconds ? formatSleep(lastSleep.totalSleepSeconds) : "—"}
          unit=""
          sub={lastSleep ? `score ${lastSleep.sleepScore ?? "—"} · ${lastSleep.date}` : "no data"}
        />
        <StatCard
          label="Last Run"
          value={lastRun?.distanceMeters ? formatDist(lastRun.distanceMeters) : "—"}
          unit=""
          sub={lastRun?.date ?? "no data"}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string | number;
  unit: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {unit && <span className="text-sm font-normal text-neutral-400 ml-1">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}
