"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Run = {
  id: number;
  date: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  avgPaceSecondsPerKm: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainMeters: number | null;
};

const MI = 1609.34;

function toMiles(meters: number) {
  return meters / MI;
}

function formatPace(secsPerKm: number) {
  const secsPerMile = Math.round(secsPerKm * 1.60934);
  const mins = Math.floor(secsPerMile / 60);
  const secs = secsPerMile % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function RunsPage() {
  const [runList, setRunList] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs?limit=20")
      .then((r) => r.json())
      .then(setRunList)
      .finally(() => setLoading(false));
  }, []);

  const chartData = [...runList]
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: r.date.slice(5),
      mi: r.distanceMeters ? parseFloat(toMiles(r.distanceMeters).toFixed(2)) : 0,
    }));

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-sm font-medium text-neutral-400">Runs</h2>

      {runList.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400">No runs yet</p>
          <p className="text-xs text-neutral-500">Sync with Garmin to see your running history</p>
        </div>
      ) : (
        <>
          <div className="h-48 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={20}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#737373" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#737373" }}
                  unit=" mi"
                  width={45}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e5e5e5" }}
                  formatter={(v) => [`${v} mi`, "Distance"]}
                />
                <Bar dataKey="mi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {runList.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">
                      {run.distanceMeters
                        ? `${toMiles(run.distanceMeters).toFixed(2)} mi`
                        : "—"}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {run.durationSeconds ? formatDuration(run.durationSeconds) : ""}
                      {run.avgPaceSecondsPerKm
                        ? ` · ${formatPace(run.avgPaceSecondsPerKm)}`
                        : ""}
                      {run.avgHeartRate ? ` · ${run.avgHeartRate} bpm` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">{run.date}</p>
                    {run.calories && (
                      <p className="text-xs text-neutral-500 mt-0.5">{run.calories} kcal</p>
                    )}
                    {run.elevationGainMeters != null && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        ↑ {Math.round(run.elevationGainMeters * 3.28084)} ft
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
