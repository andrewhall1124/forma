export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { resolveViewer } from "@/lib/access";
import { db } from "@/db";
import { meals, waterLogs, sleepLogs, activities, dailySummaries } from "@/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { localDateStr, DEFAULT_TIME_ZONE } from "@/lib/date";

function formatDist(m: number) {
  return (m / 1609.34).toFixed(2) + " mi";
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSleep(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export default async function Dashboard() {
  const { subjectUserId: userId } = await resolveViewer();
  const tz = (await cookies()).get("tz")?.value || DEFAULT_TIME_ZONE;
  const today = localDateStr(tz);

  const [[macroRow], [waterRow], [lastSleep], [lastActivity], [todaySummary]] = await Promise.all([
    db
      .select({
        calories: sql<number>`coalesce(sum(coalesce(${meals.calories}, 0) * coalesce(${meals.servings}, 1)), 0)`,
        protein: sql<number>`coalesce(sum(coalesce(${meals.proteinG}, 0) * coalesce(${meals.servings}, 1)), 0)`,
        carbs: sql<number>`coalesce(sum(coalesce(${meals.carbsG}, 0) * coalesce(${meals.servings}, 1)), 0)`,
        fat: sql<number>`coalesce(sum(coalesce(${meals.fatG}, 0) * coalesce(${meals.servings}, 1)), 0)`,
      })
      .from(meals)
      .where(and(eq(meals.userId, userId!), eq(meals.date, today))),
    db
      .select({ total: sql<number>`coalesce(sum(${waterLogs.amountMl}), 0)` })
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, userId!), eq(waterLogs.date, today))),
    db.select().from(sleepLogs).where(eq(sleepLogs.userId, userId!)).orderBy(desc(sleepLogs.date)).limit(1),
    db.select().from(activities).where(eq(activities.userId, userId!)).orderBy(desc(activities.date)).limit(1),
    db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId!), eq(dailySummaries.date, today)))
      .limit(1)
      // The table is created by the first Garmin sync; render "no data"
      // instead of crashing the dashboard until then.
      .catch(() => []),
  ]);

  const calories = macroRow?.calories ?? 0;
  const protein = macroRow?.protein ?? 0;
  const carbs = macroRow?.carbs ?? 0;
  const fat = macroRow?.fat ?? 0;
  const waterMl = waterRow?.total ?? 0;
  const steps = todaySummary?.steps ?? 0;
  const stepGoal = todaySummary?.stepGoal ?? 10000;
  const floors = todaySummary?.floorsAscended ?? 0;
  const floorsGoal = todaySummary?.floorsGoal ?? 10;

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm font-medium text-neutral-400">
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <NutritionCard
          calories={calories}
          protein={protein}
          carbs={carbs}
          fat={fat}
        />
        <StatCard
          label="Water"
          value={waterMl >= 1000 ? (waterMl / 1000).toFixed(1) : waterMl}
          unit={waterMl >= 1000 ? "L" : "mL"}
          sub={`${Math.round(Math.min(100, (waterMl / 2500) * 100))}% of 2.5L goal`}
          progress={waterMl / 2500}
          progressColor="bg-blue-500"
        />
        <StatCard
          label="Steps"
          value={todaySummary ? steps.toLocaleString() : "—"}
          unit=""
          sub={
            todaySummary
              ? `${Math.round(Math.min(100, (steps / stepGoal) * 100))}% of ${stepGoal.toLocaleString()} goal`
              : "no data"
          }
          progress={todaySummary ? steps / stepGoal : undefined}
          progressColor="bg-green-500"
        />
        <StatCard
          label="Floors"
          value={todaySummary ? floors : "—"}
          unit={todaySummary ? "floors" : ""}
          sub={todaySummary ? `${Math.round(Math.min(100, (floors / floorsGoal) * 100))}% of ${floorsGoal} goal` : "no data"}
          progress={todaySummary ? floors / floorsGoal : undefined}
          progressColor="bg-[#b08a5a]"
        />
        <StatCard
          label="Sleep"
          value={lastSleep?.totalSleepSeconds ? formatSleep(lastSleep.totalSleepSeconds) : "—"}
          unit=""
          sub={lastSleep ? `score ${lastSleep.sleepScore ?? "—"} · ${lastSleep.date}` : "no data"}
          progress={lastSleep?.totalSleepSeconds ? lastSleep.totalSleepSeconds / (8 * 3600) : undefined}
          progressColor="bg-[#a98fb0]"
        />
        <StatCard
          label="Last Activity"
          value={
            lastActivity?.distanceMeters
              ? formatDist(lastActivity.distanceMeters)
              : lastActivity?.durationSeconds
              ? formatDuration(lastActivity.durationSeconds)
              : "—"
          }
          unit=""
          sub={
            lastActivity
              ? [lastActivity.activityType, lastActivity.date].filter(Boolean).join(" · ")
              : "no data"
          }
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
  progress,
  progressColor = "bg-blue-500",
}: {
  label: string;
  value: string | number;
  unit: string;
  sub: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {unit && <span className="text-sm font-normal text-neutral-400 ml-1">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function MacroRow({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-neutral-400">{label}</span>
        <span className="text-xs">
          <span className="text-neutral-200 font-medium">{Math.round(value)}</span>
          <span className="text-neutral-500">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NutritionCard({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  return (
    <div className="col-span-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-neutral-400">Nutrition</p>
        <p className="text-xs text-neutral-500">today</p>
      </div>
      <MacroRow label="Calories" value={calories} target={3400} unit="kcal" color="bg-[#dd9f57]" />
      <MacroRow label="Carbs" value={carbs} target={462} unit="g" color="bg-[#e7b86a]" />
      <MacroRow label="Protein" value={protein} target={165} unit="g" color="bg-[#c47a52]" />
      <MacroRow label="Fat" value={fat} target={90} unit="g" color="bg-[#9a9b63]" />
    </div>
  );
}
