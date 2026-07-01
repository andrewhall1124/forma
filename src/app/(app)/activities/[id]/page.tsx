"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
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
  MI,
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
  avgCadence: number | null;
  movingDurationSeconds: number | null;
  avgPowerWatts: number | null;
  aerobicTrainingEffect: number | null;
  anaerobicTrainingEffect: number | null;
  avgStrideLengthCm: number | null;
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

type HrZone = { zoneNumber: number; secsInZone: number; zoneLowBoundary: number | null };
type ExerciseSet = {
  exercise: string | null;
  category: string | null;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};
type Streams = {
  distance?: (number | null)[];
  hr?: (number | null)[];
  speed?: (number | null)[];
  elevation?: (number | null)[];
};
type Details = {
  hrZones: HrZone[] | null;
  exerciseSets: ExerciseSet[] | null;
  streams: Streams | null;
} | null;

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "#171717",
    border: "1px solid #262626",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#e5e5e5" },
};

// HR zones go calm → hot to read intensity at a glance.
const ZONE_COLORS = ["#60a5fa", "#22c55e", "#eab308", "#f97316", "#ef4444"];

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
  const [details, setDetails] = useState<Details>(null);
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
        setDetails(data.details ?? null);
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
  const isStrength = activity.activityType === "strength";
  const hasDistance = activity.distanceMeters != null && activity.distanceMeters > 0;
  const showLaps = !isStrength;

  const hero = hasDistance
    ? `${toMiles(activity.distanceMeters!).toFixed(2)} mi`
    : activity.durationSeconds
    ? formatDuration(activity.durationSeconds)
    : "—";

  // Per-lap pace/speed series (distance-based activities only).
  const paceData = laps
    .filter((l) => (isRide ? l.avgSpeedMps : l.avgPaceSecondsPerKm))
    .map((l) => ({
      lap: l.lapIndex,
      value: isRide
        ? Number((l.avgSpeedMps! * 2.23694).toFixed(1)) // mph
        : Math.round(l.avgPaceSecondsPerKm! * 1.60934), // sec/mile
    }));

  const zones = details?.hrZones?.filter((z) => z.secsInZone > 0) ?? [];
  const zoneTotal = zones.reduce((sum, z) => sum + z.secsInZone, 0);

  const sets = details?.exerciseSets ?? [];

  // Zip the time-series streams into rows keyed by cumulative distance (miles).
  const streams = details?.streams;
  const streamData =
    streams?.distance?.map((d, i) => ({
      mi: d != null ? Number((d / MI).toFixed(2)) : null,
      elevFt: streams.elevation?.[i] != null ? Math.round(streams.elevation[i]! * 3.28084) : null,
      hr: streams.hr?.[i] != null ? Math.round(streams.hr[i]!) : null,
    })) ?? [];
  const hasElevStream = streamData.some((p) => p.elevFt != null);
  const hasHrStream = streamData.some((p) => p.hr != null);

  // Fall back to per-lap HR bars only when there's no smooth HR stream.
  const hrLapData = laps.filter((l) => l.avgHeartRate).map((l) => ({ lap: l.lapIndex, hr: l.avgHeartRate! }));

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
        {activity.movingDurationSeconds != null &&
          activity.movingDurationSeconds !== activity.durationSeconds && (
            <Stat label="Moving" value={formatDurationPrecise(activity.movingDurationSeconds)} />
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
        {activity.avgCadence != null && activity.avgCadence > 0 && (
          <Stat label="Cadence" value={`${activity.avgCadence} ${isRide ? "rpm" : "spm"}`} />
        )}
        {activity.avgPowerWatts != null && activity.avgPowerWatts > 0 && (
          <Stat label="Avg power" value={`${Math.round(activity.avgPowerWatts)} W`} />
        )}
        {activity.avgStrideLengthCm != null && activity.avgStrideLengthCm > 0 && (
          <Stat label="Stride" value={`${(activity.avgStrideLengthCm / 100).toFixed(2)} m`} />
        )}
        {activity.aerobicTrainingEffect != null && activity.aerobicTrainingEffect > 0 && (
          <Stat label="Aerobic TE" value={activity.aerobicTrainingEffect.toFixed(1)} />
        )}
        {activity.anaerobicTrainingEffect != null && activity.anaerobicTrainingEffect > 0 && (
          <Stat label="Anaerobic TE" value={activity.anaerobicTrainingEffect.toFixed(1)} />
        )}
        {activity.calories != null && <Stat label="Calories" value={`${activity.calories} kcal`} />}
        {activity.elevationGainMeters != null && activity.elevationGainMeters > 0 && (
          <Stat
            label="Elevation"
            value={`↑ ${Math.round(activity.elevationGainMeters * 3.28084)} ft`}
          />
        )}
      </div>

      {zones.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-400">Heart rate zones</h3>
          <div className="space-y-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            {zones.map((z) => {
              const pct = zoneTotal > 0 ? (z.secsInZone / zoneTotal) * 100 : 0;
              const color = ZONE_COLORS[(z.zoneNumber ?? 1) - 1] ?? ZONE_COLORS[0];
              return (
                <div key={z.zoneNumber} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 text-neutral-400">Z{z.zoneNumber}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
                    <div
                      className="h-full rounded"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-neutral-400">
                    {formatDurationPrecise(z.secsInZone)} · {Math.round(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isStrength ? (
        sets.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-neutral-400">Sets</h3>
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Exercise</th>
                    <th className="p-2 font-medium">Reps</th>
                    <th className="p-2 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s, i) => (
                    <tr key={i} className="border-b border-neutral-800/60 last:border-0">
                      <td className="p-2 text-neutral-400">{i + 1}</td>
                      <td className="p-2">{prettyExercise(s.exercise, s.category)}</td>
                      <td className="p-2">{s.reps ?? "—"}</td>
                      <td className="p-2">
                        {s.weightKg ? `${Math.round(s.weightKg * 2.20462)} lb` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : (
        <>
          {paceData.length > 0 && (
            <ChartSection title={isRide ? "Speed by lap" : "Pace by lap"}>
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
                  tickFormatter={(v) => (isRide ? `${v}` : formatPaceMile(v as number))}
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
            </ChartSection>
          )}

          {hasElevStream && (
            <ChartSection title="Elevation">
              <AreaChart data={streamData}>
                <XAxis
                  dataKey="mi"
                  type="number"
                  domain={[0, "dataMax"]}
                  tick={{ fontSize: 11, fill: "#737373" }}
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                  unit=" mi"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#737373" }}
                  width={48}
                  unit=" ft"
                  domain={["dataMin - 20", "dataMax + 20"]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v) => [`${v} ft`, "Elevation"]}
                  labelFormatter={(l) => `${l} mi`}
                />
                <Area
                  type="monotone"
                  dataKey="elevFt"
                  stroke="#dd9f57"
                  fill="#dd9f57"
                  fillOpacity={0.2}
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ChartSection>
          )}

          {hasHrStream ? (
            <ChartSection title="Heart rate">
              <LineChart data={streamData}>
                <XAxis
                  dataKey="mi"
                  type="number"
                  domain={[0, "dataMax"]}
                  tick={{ fontSize: 11, fill: "#737373" }}
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                  unit=" mi"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#737373" }}
                  width={40}
                  domain={["dataMin - 5", "dataMax + 5"]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v) => [`${v} bpm`, "HR"]}
                  labelFormatter={(l) => `${l} mi`}
                />
                <Line type="monotone" dataKey="hr" stroke="#ef4444" dot={false} connectNulls />
              </LineChart>
            </ChartSection>
          ) : (
            hrLapData.length > 0 && (
              <ChartSection title="Heart rate by lap">
                <BarChart data={hrLapData} barSize={20}>
                  <XAxis
                    dataKey="lap"
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737373" }}
                    width={40}
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
              </ChartSection>
            )
          )}

          {showLaps && laps.length > 0 && (
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
          )}

          {showLaps && laps.length === 0 && !hasElevStream && !hasHrStream && (
            <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center text-sm text-neutral-500">
              No lap data for this activity. Re-sync with Garmin to pull splits
              for recent activities.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-400">{title}</h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// Format a raw seconds-per-mile value as mm:ss (chart axis/tooltip helper).
function formatPaceMile(secsPerMile: number) {
  const mins = Math.floor(secsPerMile / 60);
  const secs = Math.round(secsPerMile % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Garmin exercise names/categories are SCREAMING_SNAKE_CASE enums.
function prettyExercise(name: string | null, category: string | null) {
  const raw = name || category || "Exercise";
  return raw
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
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
