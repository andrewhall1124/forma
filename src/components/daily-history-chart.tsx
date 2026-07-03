"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export type DailyPoint = {
  // MM-DD label for the x-axis
  date: string;
  value: number;
};

export function DailyHistoryChart({
  data,
  color,
  unit,
  label,
  goal,
  goalLabel,
}: {
  data: DailyPoint[];
  color: string;
  unit: string;
  label: string;
  goal?: number;
  goalLabel?: string;
}) {
  return (
    <div className="h-48 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#737373" }}
            width={36}
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
            cursor={{ fill: "rgba(115, 115, 115, 0.15)" }}
            formatter={(v) => [`${Math.round(Number(v) * 10) / 10}${unit}`, label]}
          />
          {goal != null && (
            <ReferenceLine
              y={goal}
              // Without this, recharts discards the line whenever the goal
              // sits above every bar (the axis auto-domain stops at dataMax).
              ifOverflow="extendDomain"
              stroke="#6b7280"
              strokeDasharray="4 3"
              label={{ value: goalLabel, position: "insideTopRight", fontSize: 10, fill: "#6b7280" }}
            />
          )}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
