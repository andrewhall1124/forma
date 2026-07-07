"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
  BedDouble,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { localDateStr } from "@/lib/date";
import { TYPE_META, MI, formatDuration } from "@/lib/activity";
import { useCoachMode } from "@/lib/athlete-mode";

type PlannedWorkout = {
  id: number;
  athleteUserId: string;
  coachUserId: string | null;
  date: string;
  activityType: string | null;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  status: "planned" | "completed" | "skipped";
};

type WorkoutTemplate = {
  id: number;
  activityType: string | null;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

const PLAN_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  ...TYPE_META,
  rest: { label: "Rest", icon: BedDouble },
  // TYPE_META labels this "Activity"; in a prescription picker "Other" is clearer.
  other: { ...TYPE_META.other, label: "Other" },
};

const TYPE_OPTIONS = ["run", "walk", "ride", "strength", "swim", "rest", "other"] as const;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(dateStr, -((dow + 6) % 7));
}

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function weekLabel(monday: string): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`;
}

type FormState = {
  id: number | null; // null = creating
  date: string;
  activityType: string;
  title: string;
  description: string;
  durationMin: string;
  distanceMi: string;
};

export default function PlanPage() {
  // Coach mode (which athlete's plan this is) comes from the global cookie;
  // the API resolves it server-side, so requests need no athlete param.
  const coachMode = useCoachMode();
  const [monday, setMonday] = useState(() => mondayOf(localDateStr()));
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/workout-templates");
    if (res.ok) setTemplates(await res.json());
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: monday, end: addDays(monday, 6) });
      const res = await fetch(`/api/planned-workouts?${params}`);
      setWorkouts(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [monday]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  const today = localDateStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const viewingSelf = coachMode === null;

  function openCreate(date: string) {
    setForm({
      id: null,
      date,
      activityType: "run",
      title: "",
      description: "",
      durationMin: "",
      distanceMi: "",
    });
  }

  function openEdit(w: PlannedWorkout) {
    setForm({
      id: w.id,
      date: w.date,
      activityType: w.activityType ?? "other",
      title: w.title,
      description: w.description ?? "",
      durationMin: w.durationSeconds ? String(Math.round(w.durationSeconds / 60)) : "",
      distanceMi: w.distanceMeters ? (w.distanceMeters / MI).toFixed(2) : "",
    });
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        activityType: form.activityType,
        title: form.title,
        description: form.description || null,
        durationSeconds: form.durationMin ? Math.round(Number(form.durationMin) * 60) : null,
        distanceMeters: form.distanceMi ? Number(form.distanceMi) * MI : null,
      };
      await fetch(
        form.id === null ? "/api/planned-workouts" : `/api/planned-workouts/${form.id}`,
        {
          method: form.id === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setForm(null);
      await loadWorkouts();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(w: PlannedWorkout, status: PlannedWorkout["status"]) {
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadWorkouts();
  }

  async function remove(w: PlannedWorkout) {
    if (!confirm(`Delete "${w.title}"?`)) return;
    await fetch(`/api/planned-workouts/${w.id}`, { method: "DELETE" });
    await loadWorkouts();
  }

  // Catalog membership is keyed by title, so the bookmark stays lit across
  // days and reloads for every workout that matches a saved template.
  function catalogEntry(w: PlannedWorkout) {
    return templates.find((t) => t.title === w.title);
  }

  async function toggleCatalog(w: PlannedWorkout) {
    const existing = catalogEntry(w);
    if (existing) {
      await fetch(`/api/workout-templates/${existing.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: w.activityType,
          title: w.title,
          description: w.description,
          durationSeconds: w.durationSeconds,
          distanceMeters: w.distanceMeters,
        }),
      });
    }
    await loadTemplates();
  }

  async function removeTemplate(t: WorkoutTemplate) {
    if (!confirm(`Remove "${t.title}" from catalog?`)) return;
    await fetch(`/api/workout-templates/${t.id}`, { method: "DELETE" });
    await loadTemplates();
  }

  function applyTemplate(t: WorkoutTemplate) {
    if (!form) return;
    setForm({
      ...form,
      activityType: t.activityType ?? "other",
      title: t.title,
      description: t.description ?? "",
      durationMin: t.durationSeconds ? String(Math.round(t.durationSeconds / 60)) : "",
      distanceMi: t.distanceMeters ? (t.distanceMeters / MI).toFixed(2) : "",
    });
  }

  return (
    <div className="flex-1 p-4 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Training Plan</h1>
        <p className="text-sm text-neutral-400 mt-1">
          {viewingSelf
            ? "Your prescribed workouts"
            : `Prescribing for ${coachMode.athleteName}`}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonday(addDays(monday, -7))}
          className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setMonday(mondayOf(today))}
          className="text-sm font-medium hover:text-accent-400 transition-colors"
        >
          {weekLabel(monday)}
        </button>
        <button
          onClick={() => setMonday(addDays(monday, 7))}
          className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {days.map((date) => {
            const dayWorkouts = workouts.filter((w) => w.date === date);
            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "text-xs font-medium uppercase tracking-wider",
                      date === today ? "text-accent-400" : "text-neutral-400",
                    )}
                  >
                    {dayLabel(date)}
                    {date === today && " · Today"}
                  </p>
                  <button
                    onClick={() => openCreate(date)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                {dayWorkouts.length === 0 ? (
                  <p className="text-xs text-neutral-600 px-1">Nothing planned</p>
                ) : (
                  dayWorkouts.map((w) => {
                    const { label, icon: Icon } =
                      PLAN_TYPE_META[w.activityType ?? "other"] ?? PLAN_TYPE_META.other;
                    const metaBits = [
                      w.durationSeconds ? formatDuration(w.durationSeconds) : null,
                      w.distanceMeters ? `${(w.distanceMeters / MI).toFixed(1)} mi` : null,
                    ].filter(Boolean);
                    return (
                      <div
                        key={w.id}
                        className={cn(
                          "rounded-xl border bg-neutral-900 p-4 space-y-2",
                          w.status === "completed"
                            ? "border-green-900/60"
                            : w.status === "skipped"
                            ? "border-neutral-800 opacity-60"
                            : "border-neutral-800",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <Icon size={18} className="text-accent-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  w.status === "skipped" && "line-through",
                                )}
                              >
                                {w.title}
                              </p>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {[label, ...metaBits].join(" · ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {w.status === "completed" && (
                              <span className="flex items-center gap-1 text-xs text-green-400 mr-1">
                                <Check size={12} /> Done
                              </span>
                            )}
                            <button
                              onClick={() => toggleCatalog(w)}
                              className={cn(
                                "p-1.5 transition-colors",
                                catalogEntry(w)
                                  ? "text-accent-400 hover:text-accent-300"
                                  : "text-neutral-500 hover:text-accent-400",
                              )}
                              aria-label={
                                catalogEntry(w) ? "Remove from catalog" : "Save to catalog"
                              }
                              title={
                                catalogEntry(w)
                                  ? "In catalog — tap to remove"
                                  : "Save to catalog"
                              }
                            >
                              {catalogEntry(w) ? (
                                <BookmarkCheck size={14} />
                              ) : (
                                <BookmarkPlus size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => openEdit(w)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => remove(w)}
                              className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {w.description && (
                          <p className="text-xs text-neutral-400 whitespace-pre-wrap">
                            {w.description}
                          </p>
                        )}
                        {viewingSelf && w.activityType !== "rest" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() =>
                                setStatus(w, w.status === "completed" ? "planned" : "completed")
                              }
                              className={cn(
                                "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                                w.status === "completed"
                                  ? "border-green-700 bg-green-500/10 text-green-400"
                                  : "border-neutral-700 text-neutral-300 hover:border-green-700 hover:text-green-400",
                              )}
                            >
                              {w.status === "completed" ? "Completed ✓" : "Mark complete"}
                            </button>
                            <button
                              onClick={() =>
                                setStatus(w, w.status === "skipped" ? "planned" : "skipped")
                              }
                              className={cn(
                                "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                                w.status === "skipped"
                                  ? "border-neutral-600 bg-neutral-800 text-neutral-300"
                                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800",
                              )}
                            >
                              {w.status === "skipped" ? "Skipped" : "Skip"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-20 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <form
            onSubmit={saveForm}
            className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">
                {form.id === null ? "Add workout" : "Edit workout"} · {dayLabel(form.date)}
              </p>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            {form.id === null && templates.length > 0 && (
              <div>
                <label className="text-xs text-neutral-400">From catalog</label>
                <div className="mt-1 max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {templates.map((t) => {
                    const { label } = PLAN_TYPE_META[t.activityType ?? "other"] ?? PLAN_TYPE_META.other;
                    const bits = [
                      label,
                      t.durationSeconds ? formatDuration(t.durationSeconds) : null,
                      t.distanceMeters ? `${(t.distanceMeters / MI).toFixed(1)} mi` : null,
                    ].filter(Boolean);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800"
                      >
                        <button
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="flex-1 min-w-0 px-3 py-2 text-left hover:bg-neutral-700/60 rounded-l-lg transition-colors"
                        >
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-xs text-neutral-500">{bits.join(" · ")}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTemplate(t)}
                          className="p-2 shrink-0 text-neutral-600 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${t.title} from catalog`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-neutral-400">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                placeholder="Long Run - 75-80 mins"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-neutral-400">Type</label>
                <select
                  value={form.activityType}
                  onChange={(e) => setForm({ ...form, activityType: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {PLAN_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-400">Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                  placeholder="40"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400">Miles</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.distanceMi}
                  onChange={(e) => setForm({ ...form, distanceMi: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                  placeholder="4.75"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400">Notes</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                placeholder="Warmup, workout structure, focus points…"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-neutral-950 py-2.5 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {form.id === null ? "Add workout" : "Save changes"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
