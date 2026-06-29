"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const SLEEP_GOAL_HOURS = 8;
const SLEEP_GOAL_SECONDS = SLEEP_GOAL_HOURS * 3600;

type SleepLog = {
  id: number;
  date: string;
  totalSleepSeconds: number | null;
  deepSleepSeconds: number | null;
  remSleepSeconds: number | null;
  lightSleepSeconds: number | null;
  awakeSleepSeconds: number | null;
  sleepScore: number | null;
};

function formatHours(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function secsToHours(secs: number | null) {
  if (!secs) return 0;
  return parseFloat((secs / 3600).toFixed(1));
}

export default function SleepPage() {
  const [sleepList, setSleepList] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sleep?limit=14")
      .then((r) => r.json())
      .then(setSleepList)
      .finally(() => setLoading(false));
  }, []);

  const chartData = [...sleepList]
    .reverse()
    .map((s) => ({
      date: s.date.slice(5),
      hours: secsToHours(s.totalSleepSeconds),
      score: s.sleepScore ?? 0,
    }));

  const avgScore =
    sleepList.length > 0
      ? Math.round(
          sleepList.reduce((sum, s) => sum + (s.sleepScore ?? 0), 0) / sleepList.length
        )
      : null;

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-400">Sleep</h2>
        {avgScore != null && (
          <span className="text-xs text-neutral-500">Avg score: {avgScore}</span>
        )}
      </div>

      {sleepList.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400">No sleep data yet</p>
          <p className="text-xs text-neutral-500">Sync with Garmin to see your sleep history</p>
        </div>
      ) : (
        <>
          <div className="h-48 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={18}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#737373" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#737373" }}
                  unit="h"
                  width={32}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e5e5e5" }}
                  formatter={(v) => [`${v}h`, "Sleep"]}
                />
                <ReferenceLine
                  y={SLEEP_GOAL_HOURS}
                  stroke="#6b7280"
                  strokeDasharray="4 3"
                  label={{ value: `${SLEEP_GOAL_HOURS}h goal`, position: "insideTopRight", fontSize: 10, fill: "#6b7280" }}
                />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {sleepList.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">
                      {s.totalSleepSeconds ? formatHours(s.totalSleepSeconds) : "—"}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                      {s.deepSleepSeconds != null && (
                        <span>Deep {formatHours(s.deepSleepSeconds)}</span>
                      )}
                      {s.remSleepSeconds != null && (
                        <span>REM {formatHours(s.remSleepSeconds)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">{s.date}</p>
                    {s.sleepScore != null && (
                      <p className="text-sm font-semibold mt-0.5 text-purple-400">
                        {s.sleepScore} pts
                      </p>
                    )}
                    {s.totalSleepSeconds != null && (
                      <p className="text-xs mt-0.5">
                        {s.totalSleepSeconds >= SLEEP_GOAL_SECONDS ? (
                          <span className="text-emerald-400">Goal met</span>
                        ) : (
                          <span className="text-neutral-500">
                            -{formatHours(SLEEP_GOAL_SECONDS - s.totalSleepSeconds)} short
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
