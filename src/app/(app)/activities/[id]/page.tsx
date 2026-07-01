"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  meta,
  toMiles,
  formatPace,
  formatSpeed,
  formatDuration,
  formatDurationPrecise,
} from "@/lib/activity";

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

type Lap = {
  id: number;
  lapIndex: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  avgPaceSecondsPerKm: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
};

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "#171717",
    border: "1px solid #262626",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#e5e5e5" },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/activities/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        setActivity(data.activity);
        setLaps(data.laps ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-4 text-sm text-neutral-500">Loading…</p>;

  if (notFound || !activity) {
    return (
      <div className="p-4 space-y-3">
        <BackLink />
        <p className="text-sm text-neutral-400">Activity not found.</p>
      </div>
    );
  }

  const { label, icon: Icon } = meta(activity.activityType);
  const isRide = activity.activityType === "ride";
  const hasDistance = activity.distanceMeters != null && activity.distanceMeters > 0;

  const hero = hasDistance
    ? `${toMiles(activity.distanceMeters!).toFixed(2)} mi`
    : activity.durationSeconds
    ? formatDuration(activity.durationSeconds)
    : "—";

  // Per-lap chart series. Distance-based activities compare pace (or speed for
  // rides); everything shows heart rate when present.
  const paceData = laps
    .filter((l) => (isRide ? l.avgSpeedMps : l.avgPaceSecondsPerKm))
    .map((l) => ({
      lap: l.lapIndex,
      value: isRide
        ? Number((l.avgSpeedMps! * 2.23694).toFixed(1)) // mph
        : Math.round(l.avgPaceSecondsPerKm! * 1.60934), // sec/mile
    }));

  const hrData = laps
    .filter((l) => l.avgHeartRate)
    .map((l) => ({ lap: l.lapIndex, hr: l.avgHeartRate! }));

  return (
    <div className="p-4 space-y-4">
      <BackLink />

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-accent-300">
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight">{hero}</p>
          <p className="truncate text-sm text-neutral-400">
            {activity.name?.trim() || label} · {activity.date}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {activity.durationSeconds != null && (
          <Stat label="Duration" value={formatDurationPrecise(activity.durationSeconds)} />
        )}
        {!isRide && activity.avgPaceSecondsPerKm != null && (
          <Stat label="Avg pace" value={formatPace(activity.avgPaceSecondsPerKm)} />
        )}
        {isRide && hasDistance && activity.durationSeconds != null && (
          <Stat
            label="Avg speed"
            value={formatSpeed(activity.distanceMeters!, activity.durationSeconds)}
          />
        )}
        {activity.avgHeartRate != null && (
          <Stat label="Avg HR" value={`${activity.avgHeartRate} bpm`} />
        )}
        {activity.maxHeartRate != null && (
          <Stat label="Max HR" value={`${activity.maxHeartRate} bpm`} />
        )}
        {activity.calories != null && <Stat label="Calories" value={`${activity.calories} kcal`} />}
        {activity.elevationGainMeters != null && activity.elevationGainMeters > 0 && (
          <Stat
            label="Elevation"
            value={`↑ ${Math.round(activity.elevationGainMeters * 3.28084)} ft`}
          />
        )}
      </div>

      {laps.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center text-sm text-neutral-500">
          No lap data for this activity. Re-sync with Garmin to pull splits for
          recent activities.
        </p>
      ) : (
        <>
          {paceData.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-400">
                {isRide ? "Speed by lap" : "Pace by lap"}
              </h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paceData} barSize={20}>
                    <XAxis
                      dataKey="lap"
                      tick={{ fontSize: 11, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#737373" }}
                      width={48}
                      axisLine={false}
                      tickLine={false}
                      domain={isRide ? [0, "auto"] : ["auto", "auto"]}
                      tickFormatter={(v) =>
                        isRide ? `${v}` : formatPaceMile(v as number)
                      }
                    />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      formatter={(v) => [
                        isRide ? `${v} mph` : `${formatPaceMile(v as number)}/mi`,
                        isRide ? "Speed" : "Pace",
                      ]}
                      labelFormatter={(l) => `Lap ${l}`}
                    />
                    <Bar dataKey="value" fill="#dd9f57" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {hrData.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-400">Heart rate by lap</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hrData} barSize={20}>
                    <XAxis
                      dataKey="lap"
                      tick={{ fontSize: 11, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#737373" }}
                      width={40}
                      unit=""
                      domain={["dataMin - 5", "dataMax + 5"]}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      formatter={(v) => [`${v} bpm`, "Avg HR"]}
                      labelFormatter={(l) => `Lap ${l}`}
                    />
                    <Bar dataKey="hr" fill="#b45309" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-neutral-400">Laps</h3>
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Dist</th>
                    <th className="p-2 font-medium">Time</th>
                    <th className="p-2 font-medium">{isRide ? "Speed" : "Pace"}</th>
                    <th className="p-2 font-medium">HR</th>
                    <th className="p-2 font-medium">Elev</th>
                  </tr>
                </thead>
                <tbody>
                  {laps.map((l) => (
                    <tr key={l.id} className="border-b border-neutral-800/60 last:border-0">
                      <td className="p-2 text-neutral-400">{l.lapIndex}</td>
                      <td className="p-2">
                        {l.distanceMeters ? `${toMiles(l.distanceMeters).toFixed(2)} mi` : "—"}
                      </td>
                      <td className="p-2">
                        {l.durationSeconds ? formatDurationPrecise(l.durationSeconds) : "—"}
                      </td>
                      <td className="p-2">
                        {isRide
                          ? l.avgSpeedMps
                            ? `${(l.avgSpeedMps * 2.23694).toFixed(1)} mph`
                            : "—"
                          : l.avgPaceSecondsPerKm
                          ? formatPace(l.avgPaceSecondsPerKm)
                          : "—"}
                      </td>
                      <td className="p-2">{l.avgHeartRate ? `${l.avgHeartRate}` : "—"}</td>
                      <td className="p-2 text-neutral-400">
                        {l.elevationGainMeters && l.elevationGainMeters > 0
                          ? `↑${Math.round(l.elevationGainMeters * 3.28084)} ft`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// Format a raw seconds-per-mile value as mm:ss (chart axis/tooltip helper).
function formatPaceMile(secsPerMile: number) {
  const mins = Math.floor(secsPerMile / 60);
  const secs = Math.round(secsPerMile % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function BackLink() {
  return (
    <Link
      href="/activities"
      className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
    >
      <ArrowLeft size={16} /> Activities
    </Link>
  );
}
