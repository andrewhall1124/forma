"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/cn";
import { meta, toMiles, formatPace, formatSpeed, formatDuration } from "@/lib/activity";

type ActivityRow = {
  id: number;
  date: string;
  activityType: string | null;
  name: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  avgPaceSecondsPerKm: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainMeters: number | null;
};

// Filter chips — "all" plus the types we expect to see often.
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "run", label: "Runs" },
  { key: "walk", label: "Walks" },
  { key: "ride", label: "Rides" },
  { key: "strength", label: "Strength" },
];

export default function ActivitiesPage() {
  const [list, setList] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    function load() {
      fetch("/api/activities?limit=50")
        .then((r) => r.json())
        .then(setList)
        .finally(() => setLoading(false));
    }
    load();
    window.addEventListener("forma:synced", load);
    return () => window.removeEventListener("forma:synced", load);
  }, []);

  const filtered = filter === "all" ? list : list.filter((a) => a.activityType === filter);

  // Duration (minutes) is the one metric every activity type shares, so the
  // chart stays meaningful across runs, rides, lifting, etc.
  const chartData = [...filtered]
    .slice(0, 10)
    .reverse()
    .map((a) => ({
      date: a.date.slice(5),
      min: a.durationSeconds ? Math.round(a.durationSeconds / 60) : 0,
    }));

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-medium text-neutral-400">Activities</h2>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors",
              filter === f.key
                ? "border-accent-500 bg-accent-500/15 text-accent-300"
                : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400">No activities yet</p>
          <p className="text-xs text-neutral-500">Sync with Garmin to see your activity history</p>
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
                  unit=" min"
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
                  formatter={(v) => [`${v} min`, "Duration"]}
                />
                <Bar dataKey="min" fill="#dd9f57" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {filtered.map((a) => {
              const { label, icon: Icon } = meta(a.activityType);
              const hasDistance = a.distanceMeters != null && a.distanceMeters > 0;
              const isRide = a.activityType === "ride";

              // Distance-based activities lead with distance; everything else
              // (e.g. strength) leads with duration.
              const hero = hasDistance
                ? `${toMiles(a.distanceMeters!).toFixed(2)} mi`
                : a.durationSeconds
                ? formatDuration(a.durationSeconds)
                : "—";

              const detail = [
                hasDistance && a.durationSeconds ? formatDuration(a.durationSeconds) : null,
                hasDistance && isRide && a.durationSeconds
                  ? formatSpeed(a.distanceMeters!, a.durationSeconds)
                  : !isRide && a.avgPaceSecondsPerKm
                  ? formatPace(a.avgPaceSecondsPerKm)
                  : null,
                a.avgHeartRate ? `${a.avgHeartRate} bpm` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <Link
                  key={a.id}
                  href={`/activities/${a.id}`}
                  className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 min-w-0">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-accent-300">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-lg leading-tight">{hero}</p>
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">
                          {a.name?.trim() || label}
                        </p>
                        {detail && <p className="text-xs text-neutral-500 mt-0.5">{detail}</p>}
                      </div>
                    </div>
                    <div className="flex items-start gap-1 shrink-0 ml-3">
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">{a.date}</p>
                        {a.calories != null && (
                          <p className="text-xs text-neutral-500 mt-0.5">{a.calories} kcal</p>
                        )}
                        {a.elevationGainMeters != null && a.elevationGainMeters > 0 && (
                          <p className="text-xs text-neutral-500 mt-0.5">
                            ↑ {Math.round(a.elevationGainMeters * 3.28084)} ft
                          </p>
                        )}
                      </div>
                      <ChevronRight size={16} className="mt-0.5 text-neutral-600" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
