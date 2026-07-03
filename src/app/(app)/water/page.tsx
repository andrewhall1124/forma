"use client";

import { useState, useEffect } from "react";
import { Droplets, Plus } from "lucide-react";
import { localDateStr, lastNDateStrs } from "@/lib/date";
import { DailyHistoryChart } from "@/components/daily-history-chart";

type WaterLog = {
  id: number;
  date: string;
  amountMl: number;
  loggedAt: string;
};

type WaterDay = {
  date: string;
  totalMl: number;
};

const QUICK_ADD = [250, 500, 750, 1000];
const DAILY_GOAL_ML = 2500;
const HISTORY_DAYS = 30;

function todayStr() {
  return localDateStr();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function WaterPage() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [history, setHistory] = useState<WaterDay[]>([]);
  const [adding, setAdding] = useState(false);

  async function loadLogs() {
    const res = await fetch(`/api/water?date=${todayStr()}`);
    setLogs(await res.json());
  }

  async function loadHistory() {
    const start = lastNDateStrs(HISTORY_DAYS)[0];
    const res = await fetch(`/api/water/history?start=${start}`);
    setHistory(await res.json());
  }

  useEffect(() => {
    loadLogs();
    loadHistory();
  }, []);

  const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
  const progress = Math.min(1, totalMl / DAILY_GOAL_ML);

  const mlByDate = new Map(history.map((d) => [d.date, d.totalMl]));
  const chartData = lastNDateStrs(HISTORY_DAYS).map((d) => ({
    date: d.slice(5),
    value: (mlByDate.get(d) ?? 0) / 1000,
  }));
  const daysLogged = history.length;
  const avgMl = daysLogged > 0
    ? history.reduce((sum, d) => sum + d.totalMl, 0) / daysLogged
    : 0;

  async function addWater(ml: number) {
    if (adding) return;
    setAdding(true);
    try {
      await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr(), amountMl: ml }),
      });
      await Promise.all([loadLogs(), loadHistory()]);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-6">
      {/* Ring — fills available vertical space and centers */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
        <div className="relative flex items-center justify-center w-44 h-44">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#262626" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="text-center">
            <Droplets size={20} className="mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold">
              {totalMl >= 1000 ? (totalMl / 1000).toFixed(1) : totalMl}
            </p>
            <p className="text-xs text-neutral-400">
              {totalMl >= 1000 ? "L" : "mL"}
            </p>
          </div>
        </div>
        <p className="text-sm text-neutral-400">
          Goal: {(DAILY_GOAL_ML / 1000).toFixed(1)} L · {Math.round(progress * 100)}% reached
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {QUICK_ADD.map((ml) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={adding}
            className="flex flex-col items-center gap-1 rounded-xl border border-neutral-700 bg-neutral-900 py-3 text-sm font-medium hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-300 active:scale-95 transition-all disabled:opacity-50"
          >
            <Plus size={14} />
            {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
          </button>
        ))}
      </div>

      {daysLogged > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Last {HISTORY_DAYS} Days
            </p>
            <p className="text-xs text-neutral-500">
              avg {(avgMl / 1000).toFixed(1)} L on days logged
            </p>
          </div>
          <DailyHistoryChart
            data={chartData}
            color="#5d83a4"
            unit=" L"
            label="Water"
            goal={DAILY_GOAL_ML / 1000}
            goalLabel={`${(DAILY_GOAL_ML / 1000).toFixed(1)}L goal`}
          />
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Today&apos;s Log</p>
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-blue-400">
                <Droplets size={14} />
                <span className="text-sm font-medium text-white">
                  {log.amountMl >= 1000 ? `${log.amountMl / 1000}L` : `${log.amountMl} mL`}
                </span>
              </div>
              <span className="text-xs text-neutral-500">{formatTime(log.loggedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
