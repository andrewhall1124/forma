"use client";

import { useState, useEffect } from "react";
import { Footprints } from "lucide-react";
import { localDateStr, lastNDateStrs } from "@/lib/date";
import { DailyHistoryChart } from "@/components/daily-history-chart";

type DailySummary = {
  id: number;
  date: string;
  steps: number | null;
  stepGoal: number | null;
  floorsAscended: number | null;
  floorsDescended: number | null;
  floorsGoal: number | null;
};

const HISTORY_DAYS = 30;
const DEFAULT_STEP_GOAL = 10000;
const DEFAULT_FLOORS_GOAL = 10;

export default function StepsPage() {
  const [days, setDays] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function loadDays() {
      fetch(`/api/steps?limit=${HISTORY_DAYS}`)
        .then((r) => r.json())
        .then(setDays)
        .finally(() => setLoading(false));
    }
    loadDays();
    window.addEventListener("forma:synced", loadDays);
    return () => window.removeEventListener("forma:synced", loadDays);
  }, []);

  const today = days.find((d) => d.date === localDateStr());
  // Garmin's auto goal varies day to day; use the most recent one as "the" goal.
  const stepGoal = days[0]?.stepGoal ?? DEFAULT_STEP_GOAL;
  const floorsGoal = days[0]?.floorsGoal ?? DEFAULT_FLOORS_GOAL;

  const steps = today?.steps ?? 0;
  const progress = Math.min(1, steps / stepGoal);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = lastNDateStrs(HISTORY_DAYS);
  const stepsData = dates.map((d) => ({
    date: d.slice(5),
    value: (byDate.get(d)?.steps ?? 0) / 1000,
  }));
  const floorsData = dates.map((d) => ({
    date: d.slice(5),
    value: byDate.get(d)?.floorsAscended ?? 0,
  }));

  const daysWithData = days.filter((d) => d.steps != null);
  const avgSteps =
    daysWithData.length > 0
      ? daysWithData.reduce((sum, d) => sum + (d.steps ?? 0), 0) / daysWithData.length
      : 0;

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading…</p>;
  }

  if (days.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400">No step data yet</p>
          <p className="text-xs text-neutral-500">Sync with Garmin to see your steps</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-6">
      {/* Today's ring — same hero pattern as the water page */}
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <div className="relative flex items-center justify-center w-44 h-44">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#262626" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#22c55e"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="text-center">
            <Footprints size={20} className="mx-auto text-green-400 mb-1" />
            <p className="text-2xl font-bold">{steps.toLocaleString()}</p>
            <p className="text-xs text-neutral-400">steps</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400">
          Goal: {stepGoal.toLocaleString()} · {Math.round(progress * 100)}% reached
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Steps · Last {HISTORY_DAYS} Days
          </p>
          <p className="text-xs text-neutral-500">
            avg {Math.round(avgSteps).toLocaleString()} on days synced
          </p>
        </div>
        <DailyHistoryChart
          data={stepsData}
          color="#6b9e78"
          unit="k"
          label="Steps"
          goal={stepGoal / 1000}
          goalLabel={`${(stepGoal / 1000).toFixed(1)}k goal`}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Floors Climbed
          </p>
          <p className="text-xs text-neutral-500">
            today {today?.floorsAscended ?? 0} · goal {floorsGoal}
          </p>
        </div>
        <DailyHistoryChart
          data={floorsData}
          color="#b08a5a"
          unit=""
          label="Floors"
          goal={floorsGoal}
          goalLabel={`${floorsGoal} goal`}
        />
      </div>
    </div>
  );
}
