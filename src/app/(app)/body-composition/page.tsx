"use client";

import { useState, useEffect } from "react";
import { Scale } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type BodyComposition = {
  id: number;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  boneMassKg: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
};

const HISTORY_DAYS = 90;
const KG_TO_LB = 2.20462;

function toLb(kg: number | null | undefined) {
  return kg == null ? null : kg * KG_TO_LB;
}

// A sparse line chart over actual weigh-ins. Unlike steps/sleep we don't
// zero-fill missing days: body composition is only recorded when you step on
// the scale, so a gap should skip, not drop the line to zero.
function TrendChart({
  data,
  color,
  unit,
  label,
  decimals = 1,
}: {
  data: { date: string; value: number }[];
  color: string;
  unit: string;
  label: string;
  decimals?: number;
}) {
  return (
    <div className="h-48 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#737373" }}
            width={40}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v) => Number(v).toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #262626",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e5e5e5" }}
            cursor={{ stroke: "#404040" }}
            formatter={(v) => [`${Number(v).toFixed(decimals)}${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {value}
        {unit && <span className="text-sm font-normal text-neutral-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function BodyCompositionPage() {
  const [records, setRecords] = useState<BodyComposition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      fetch(`/api/body-composition?limit=${HISTORY_DAYS}`)
        .then((r) => r.json())
        .then(setRecords)
        .finally(() => setLoading(false));
    }
    load();
    window.addEventListener("forma:synced", load);
    return () => window.removeEventListener("forma:synced", load);
  }, []);

  // API returns newest-first; charts read oldest-first.
  const latest = records[0];
  const chrono = [...records].reverse();

  const weightSeries = chrono
    .filter((r) => r.weightKg != null)
    .map((r) => ({ date: r.date.slice(5), value: toLb(r.weightKg)! }));
  const fatSeries = chrono
    .filter((r) => r.bodyFatPct != null)
    .map((r) => ({ date: r.date.slice(5), value: r.bodyFatPct! }));

  // Net weight change across the loaded window (oldest → newest weigh-in).
  const firstWeight = weightSeries[0]?.value;
  const lastWeight = weightSeries[weightSeries.length - 1]?.value;
  const weightDelta =
    firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null;

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading…</p>;
  }

  if (records.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400">No body composition data yet</p>
          <p className="text-xs text-neutral-500">
            Weigh in on your Garmin scale, then sync to see your trends
          </p>
        </div>
      </div>
    );
  }

  const latestLb = toLb(latest?.weightKg);

  return (
    <div className="flex-1 flex flex-col p-4 gap-6">
      {/* Hero: latest weight + trend over the window */}
      <div className="flex flex-col items-center justify-center gap-1 py-4">
        <Scale size={20} className="text-accent-300 mb-1" />
        <p className="text-4xl font-bold">
          {latestLb != null ? latestLb.toFixed(1) : "—"}
          <span className="text-lg font-normal text-neutral-400 ml-1">lb</span>
        </p>
        <p className="text-sm text-neutral-400">
          {latest?.weightKg != null ? `${latest.weightKg.toFixed(1)} kg · ` : ""}
          {latest?.date}
        </p>
        {weightDelta != null && Math.abs(weightDelta) >= 0.05 && (
          <p
            className={`text-xs ${weightDelta < 0 ? "text-green-400" : "text-amber-400"}`}
          >
            {weightDelta > 0 ? "+" : ""}
            {weightDelta.toFixed(1)} lb over last {HISTORY_DAYS} days
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Body Fat"
          value={latest?.bodyFatPct != null ? latest.bodyFatPct.toFixed(1) : "—"}
          unit="%"
        />
        <MetricCard
          label="Body Water"
          value={latest?.bodyWaterPct != null ? latest.bodyWaterPct.toFixed(1) : "—"}
          unit="%"
        />
        <MetricCard
          label="Muscle Mass"
          value={
            latest?.muscleMassKg != null ? toLb(latest.muscleMassKg)!.toFixed(1) : "—"
          }
          unit="lb"
        />
        <MetricCard
          label="Bone Mass"
          value={latest?.boneMassKg != null ? toLb(latest.boneMassKg)!.toFixed(1) : "—"}
          unit="lb"
        />
        <MetricCard
          label="BMI"
          value={latest?.bmi != null ? latest.bmi.toFixed(1) : "—"}
          unit=""
        />
      </div>

      {weightSeries.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Weight · Last {HISTORY_DAYS} Days
          </p>
          <TrendChart data={weightSeries} color="#6b9e78" unit=" lb" label="Weight" />
        </div>
      )}

      {fatSeries.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Body Fat · Last {HISTORY_DAYS} Days
          </p>
          <TrendChart data={fatSeries} color="#c47a52" unit="%" label="Body Fat" />
        </div>
      )}
    </div>
  );
}
