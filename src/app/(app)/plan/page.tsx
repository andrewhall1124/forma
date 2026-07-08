"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  LibraryBig,
  Link2,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
  BedDouble,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { localDateStr, addDays } from "@/lib/date";
import { TYPE_META, MI, formatDuration, formatDurationPrecise } from "@/lib/activity";
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
  linkedActivityId: number | null;
};

type ActivitySummary = {
  id: number;
  date: string;
  activityType: string | null;
  name: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
};

type WorkoutTemplate = {
  id: number;
  activityType: string | null;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  lastUsedAt: string | null;
};

type PlanNote = {
  id: number;
  date: string;
  body: string;
};

type Race = {
  id: number;
  date: string;
  name: string;
  distanceMeters: number | null;
  notes: string | null;
};

const PLAN_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  ...TYPE_META,
  rest: { label: "Rest", icon: BedDouble },
  // TYPE_META labels this "Activity"; in a prescription picker "Other" is clearer.
  other: { ...TYPE_META.other, label: "Other" },
};

const TYPE_OPTIONS = ["run", "walk", "ride", "strength", "swim", "rest", "other"] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(dateStr, -((dow + 6) % 7));
}

function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function addMonths(monthStart: string, n: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}-01`;
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

function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Whole weeks + leftover days between today and a future date. Returns null
// when the date is in the past.
function raceCountdown(dateStr: string, today: string): { weeks: number; days: number } | null {
  const diff = Math.round(
    (Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (diff < 0) return null;
  return { weeks: Math.floor(diff / 7), days: diff % 7 };
}

function countdownLabel(c: { weeks: number; days: number }): string {
  if (c.weeks === 0 && c.days === 0) return "Today";
  const parts = [];
  if (c.weeks > 0) parts.push(`${c.weeks} wk${c.weeks === 1 ? "" : "s"}`);
  if (c.days > 0) parts.push(`${c.days} day${c.days === 1 ? "" : "s"}`);
  return parts.join(" ");
}

type FormState = {
  id: number | null; // null = creating
  date: string;
  activityType: string;
  title: string;
  description: string;
  durationMin: string;
  distanceMi: string;
  // Template the form was filled from, so saving can bump its lastUsedAt.
  templateId: number | null;
};

type NoteForm = { id: number | null; date: string; body: string };
type RaceForm = {
  id: number | null;
  date: string;
  name: string;
  distanceMi: string;
  notes: string;
};

// Catalog picker filters: "recent", "all", or an activity type.
const RECENT_LIMIT = 8;

export default function PlanPage() {
  // Coach mode (which athlete's plan this is) comes from the global cookie;
  // the API resolves it server-side, so requests need no athlete param.
  const coachMode = useCoachMode();
  const today = localDateStr();
  const [monthStart, setMonthStart] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [rangeActivities, setRangeActivities] = useState<ActivitySummary[]>([]);
  const [notes, setNotes] = useState<PlanNote[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  // Suggestion strips dismissed this session, and the workout whose manual
  // link picker is open.
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [linkPickerFor, setLinkPickerFor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [noteForm, setNoteForm] = useState<NoteForm | null>(null);
  const [raceForm, setRaceForm] = useState<RaceForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  // null = catalog picker closed; otherwise the active filter.
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);

  // The visible calendar is a 6-week (42-day) grid starting on the Monday
  // on/before the first of the month.
  const gridStart = mondayOf(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const gridEnd = gridDays[41];

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/workout-templates");
    if (res.ok) setTemplates(await res.json());
  }, []);

  const loadRaces = useCallback(async () => {
    const res = await fetch("/api/races");
    if (res.ok) setRaces(await res.json());
  }, []);

  useEffect(() => {
    loadTemplates();
    loadRaces();
  }, [loadTemplates, loadRaces]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: gridStart, end: gridEnd });
      const [pwRes, notesRes] = await Promise.all([
        fetch(`/api/planned-workouts?${params}`),
        fetch(`/api/plan-notes?${params}`),
      ]);
      const data = pwRes.ok ? await pwRes.json() : { workouts: [], activities: [] };
      setWorkouts(data.workouts ?? []);
      setRangeActivities(data.activities ?? []);
      setNotes(notesRes.ok ? await notesRes.json() : []);
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const viewingSelf = coachMode === null;

  const dayWorkouts = workouts.filter((w) => w.date === selectedDate);
  const dayNotes = notes.filter((n) => n.date === selectedDate);
  const dayRaces = races.filter((r) => r.date === selectedDate);
  const upcomingRaces = races
    .filter((r) => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Per-day markers for the calendar grid.
  const workoutsByDate = new Set(workouts.map((w) => w.date));
  const notesByDate = new Set(notes.map((n) => n.date));
  const racesByDate = new Set(races.map((r) => r.date));

  function openCreate(date: string) {
    setForm({
      id: null,
      date,
      activityType: "run",
      title: "",
      description: "",
      durationMin: "",
      distanceMi: "",
      templateId: null,
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
      templateId: null,
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
      // Bump recency only when the workout is actually saved, not on pick,
      // so abandoned forms don't pollute "Recent".
      if (form.id === null && form.templateId !== null) {
        await fetch(`/api/workout-templates/${form.templateId}`, { method: "PATCH" });
        loadTemplates();
      }
      setForm(null);
      await loadPlan();
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteForm || saving || !noteForm.body.trim()) return;
    setSaving(true);
    try {
      await fetch(
        noteForm.id === null ? "/api/plan-notes" : `/api/plan-notes/${noteForm.id}`,
        {
          method: noteForm.id === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: noteForm.date, body: noteForm.body }),
        },
      );
      setNoteForm(null);
      await loadPlan();
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(n: PlanNote) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/plan-notes/${n.id}`, { method: "DELETE" });
    await loadPlan();
  }

  async function saveRace(e: React.FormEvent) {
    e.preventDefault();
    if (!raceForm || saving || !raceForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        date: raceForm.date,
        name: raceForm.name,
        distanceMeters: raceForm.distanceMi ? Number(raceForm.distanceMi) * MI : null,
        notes: raceForm.notes || null,
      };
      await fetch(raceForm.id === null ? "/api/races" : `/api/races/${raceForm.id}`, {
        method: raceForm.id === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRaceForm(null);
      await loadRaces();
    } finally {
      setSaving(false);
    }
  }

  async function removeRace(r: Race) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    await fetch(`/api/races/${r.id}`, { method: "DELETE" });
    await loadRaces();
  }

  async function setStatus(w: PlannedWorkout, status: PlannedWorkout["status"]) {
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadPlan();
  }

  async function remove(w: PlannedWorkout) {
    if (!confirm(`Delete "${w.title}"?`)) return;
    await fetch(`/api/planned-workouts/${w.id}`, { method: "DELETE" });
    await loadPlan();
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

  // Activities already claimed by a workout in the range can't be suggested twice.
  const claimedActivityIds = new Set(
    workouts.map((w) => w.linkedActivityId).filter(Boolean),
  );

  function linkCandidates(w: PlannedWorkout, sameTypeOnly: boolean) {
    return rangeActivities.filter(
      (a) =>
        a.date === w.date &&
        !claimedActivityIds.has(a.id) &&
        (!sameTypeOnly || a.activityType === w.activityType),
    );
  }

  async function linkActivity(w: PlannedWorkout, a: ActivitySummary) {
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedActivityId: a.id, status: "completed" }),
    });
    setLinkPickerFor(null);
    await loadPlan();
  }

  async function unlinkActivity(w: PlannedWorkout) {
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedActivityId: null }),
    });
    await loadPlan();
  }

  function activityLine(a: ActivitySummary) {
    return [
      a.durationSeconds ? formatDurationPrecise(a.durationSeconds) : null,
      a.distanceMeters ? `${(a.distanceMeters / MI).toFixed(2)} mi` : null,
    ]
      .filter(Boolean)
      .join(" · ");
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
      templateId: t.id,
    });
    setCatalogFilter(null);
  }

  // Only offer type filters for types that exist in the catalog, in the
  // same order they appear in the form's type dropdown.
  const catalogTypes = TYPE_OPTIONS.filter((t) =>
    templates.some((tpl) => (tpl.activityType ?? "other") === t),
  );

  // Templates arrive from the API most-recently-used first.
  const filteredTemplates =
    catalogFilter === "recent"
      ? templates.slice(0, RECENT_LIMIT)
      : catalogFilter === "all"
      ? [...templates].sort((a, b) => a.title.localeCompare(b.title))
      : templates.filter((t) => (t.activityType ?? "other") === catalogFilter);

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

      {/* Upcoming races with countdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 uppercase tracking-wider">
            <Flag size={13} /> Races
          </p>
          <button
            onClick={() =>
              setRaceForm({ id: null, date: selectedDate, name: "", distanceMi: "", notes: "" })
            }
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
          >
            <Plus size={12} /> Add race
          </button>
        </div>
        {upcomingRaces.length === 0 ? (
          <p className="text-xs text-neutral-600 px-1">No upcoming races</p>
        ) : (
          upcomingRaces.map((r) => {
            const c = raceCountdown(r.date, today)!;
            const bits = [
              dayLabel(r.date),
              r.distanceMeters ? `${(r.distanceMeters / MI).toFixed(1)} mi` : null,
            ].filter(Boolean);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{bits.join(" · ")}</p>
                  {r.notes && (
                    <p className="text-xs text-neutral-400 mt-1 whitespace-pre-wrap">{r.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right mr-1">
                    <p className="text-sm font-bold text-accent-400 tabular-nums">
                      {countdownLabel(c)}
                    </p>
                    <p className="text-[11px] text-neutral-500">to go</p>
                  </div>
                  <button
                    onClick={() =>
                      setRaceForm({
                        id: r.id,
                        date: r.date,
                        name: r.name,
                        distanceMi: r.distanceMeters ? (r.distanceMeters / MI).toFixed(2) : "",
                        notes: r.notes ?? "",
                      })
                    }
                    className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                    aria-label="Edit race"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => removeRace(r)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    aria-label="Delete race"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Month calendar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthStart(addMonths(monthStart, -1))}
            className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              setMonthStart(startOfMonth(today));
              setSelectedDate(today);
            }}
            className="text-sm font-medium hover:text-accent-400 transition-colors"
          >
            {monthLabel(monthStart)}
          </button>
          <button
            onClick={() => setMonthStart(addMonths(monthStart, 1))}
            className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-neutral-500 py-1">
              {d}
            </div>
          ))}
          {gridDays.map((date) => {
            const inMonth = date.slice(0, 7) === monthStart.slice(0, 7);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors",
                  isSelected
                    ? "border-accent-500 bg-accent-500/10 text-white"
                    : "border-transparent hover:bg-neutral-800",
                  !inMonth && "text-neutral-600",
                  inMonth && !isSelected && "text-neutral-200",
                )}
              >
                <span className={cn("tabular-nums", isToday && "font-bold text-accent-400")}>
                  {Number(date.slice(8, 10))}
                </span>
                <span className="flex items-center gap-0.5 h-1.5">
                  {workoutsByDate.has(date) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                  )}
                  {notesByDate.has(date) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  )}
                  {racesByDate.has(date) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
          <p
            className={cn(
              "text-sm font-medium",
              selectedDate === today ? "text-accent-400" : "text-neutral-200",
            )}
          >
            {dayLabel(selectedDate)}
            {selectedDate === today && " · Today"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNoteForm({ id: null, date: selectedDate, body: "" })}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
            >
              <StickyNote size={12} /> Note
            </button>
            <button
              onClick={() => openCreate(selectedDate)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
            >
              <Plus size={12} /> Workout
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-neutral-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Race markers on this day */}
            {dayRaces.map((r) => (
              <div
                key={`race-${r.id}`}
                className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-500/5 p-4"
              >
                <Flag size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {[
                      "Race day",
                      r.distanceMeters ? `${(r.distanceMeters / MI).toFixed(1)} mi` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ))}

            {/* Day notes */}
            {dayNotes.map((n) => (
              <div
                key={`note-${n.id}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <StickyNote size={16} className="text-neutral-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-neutral-200 whitespace-pre-wrap min-w-0">{n.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setNoteForm({ id: n.id, date: n.date, body: n.body })}
                    className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                    aria-label="Edit note"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => removeNote(n)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    aria-label="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {dayWorkouts.length === 0 && dayNotes.length === 0 && dayRaces.length === 0 && (
              <p className="text-xs text-neutral-600 px-1">Nothing planned</p>
            )}

            {dayWorkouts.map((w) => {
              const { label, icon: Icon } =
                PLAN_TYPE_META[w.activityType ?? "other"] ?? PLAN_TYPE_META.other;
              const metaBits = [
                w.durationSeconds ? formatDuration(w.durationSeconds) : null,
                w.distanceMeters ? `${(w.distanceMeters / MI).toFixed(1)} mi` : null,
              ].filter(Boolean);
              const linkedActivity = w.linkedActivityId
                ? rangeActivities.find((a) => a.id === w.linkedActivityId) ?? null
                : null;
              const pickerOpen = linkPickerFor === w.id;
              const linkable = !w.linkedActivityId && w.activityType !== "rest";
              const suggestions = !linkable
                ? []
                : pickerOpen
                ? linkCandidates(w, false)
                : w.status === "planned" && !dismissed.has(w.id)
                ? linkCandidates(w, true)
                : [];
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
                      {linkable && linkCandidates(w, false).length > 0 && (
                        <button
                          onClick={() => setLinkPickerFor(pickerOpen ? null : w.id)}
                          className={cn(
                            "p-1.5 transition-colors",
                            pickerOpen
                              ? "text-accent-400"
                              : "text-neutral-500 hover:text-accent-400",
                          )}
                          aria-label="Link a completed activity"
                          title="Link a completed activity"
                        >
                          <Link2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleCatalog(w)}
                        className={cn(
                          "p-1.5 transition-colors",
                          catalogEntry(w)
                            ? "text-accent-400 hover:text-accent-300"
                            : "text-neutral-500 hover:text-accent-400",
                        )}
                        aria-label={catalogEntry(w) ? "Remove from catalog" : "Save to catalog"}
                        title={
                          catalogEntry(w) ? "In catalog — tap to remove" : "Save to catalog"
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
                  {w.linkedActivityId && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-800/60 px-3 py-2">
                      <Link
                        href={`/activities/${w.linkedActivityId}`}
                        className="flex items-center gap-2 min-w-0 text-xs text-neutral-300 hover:text-accent-400 transition-colors"
                      >
                        <Link2 size={12} className="shrink-0 text-green-400" />
                        <span className="truncate">
                          {linkedActivity
                            ? `Actual: ${activityLine(linkedActivity) || linkedActivity.name || "activity"}`
                            : "View linked activity"}
                        </span>
                      </Link>
                      <button
                        onClick={() => unlinkActivity(w)}
                        className="p-1 shrink-0 text-neutral-600 hover:text-red-400 transition-colors"
                        aria-label="Unlink activity"
                        title="Unlink activity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {suggestions.length > 0 && (
                    <div className="rounded-lg border border-accent-500/30 bg-accent-500/5 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-accent-400">
                          {pickerOpen ? "Link a completed activity" : "Looks like you did this"}
                        </p>
                        <button
                          onClick={() =>
                            pickerOpen
                              ? setLinkPickerFor(null)
                              : setDismissed(new Set([...dismissed, w.id]))
                          }
                          className="p-0.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                          aria-label="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {suggestions.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => linkActivity(w, a)}
                          className="w-full flex items-center justify-between gap-2 rounded-md bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700 transition-colors"
                        >
                          <span className="text-xs font-medium truncate">
                            {a.name ?? "Activity"}
                          </span>
                          <span className="text-xs text-neutral-400 shrink-0">
                            {activityLine(a)}
                          </span>
                        </button>
                      ))}
                      <p className="text-[11px] text-neutral-500">
                        Tap to link — marks the workout complete.
                      </p>
                    </div>
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
            })}
          </>
        )}
      </div>

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
              <button
                type="button"
                onClick={() => setCatalogFilter("recent")}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2 text-sm font-medium text-neutral-300 hover:border-accent-500/60 hover:text-accent-400 transition-colors"
              >
                <LibraryBig size={14} /> Add from catalog
              </button>
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

      {noteForm && (
        <div className="fixed inset-0 z-20 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <form
            onSubmit={saveNote}
            className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium text-sm">
                <StickyNote size={15} className="text-accent-400" />
                {noteForm.id === null ? "Add note" : "Edit note"} · {dayLabel(noteForm.date)}
              </p>
              <button
                type="button"
                onClick={() => setNoteForm(null)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={noteForm.body}
              onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })}
              rows={4}
              autoFocus
              required
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600 resize-none"
              placeholder="Feeling, travel, cross-training, anything for this day…"
            />
            <button
              type="submit"
              disabled={saving || !noteForm.body.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-neutral-950 py-2.5 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {noteForm.id === null ? "Add note" : "Save changes"}
            </button>
          </form>
        </div>
      )}

      {raceForm && (
        <div className="fixed inset-0 z-20 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <form
            onSubmit={saveRace}
            className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium text-sm">
                <Flag size={15} className="text-red-400" />
                {raceForm.id === null ? "Add race" : "Edit race"}
              </p>
              <button
                type="button"
                onClick={() => setRaceForm(null)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="text-xs text-neutral-400">Race name</label>
              <input
                value={raceForm.name}
                onChange={(e) => setRaceForm({ ...raceForm, name: e.target.value })}
                required
                autoFocus
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                placeholder="Chicago Marathon"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-400">Date</label>
                <input
                  type="date"
                  value={raceForm.date}
                  onChange={(e) => setRaceForm({ ...raceForm, date: e.target.value })}
                  required
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400">Miles</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={raceForm.distanceMi}
                  onChange={(e) => setRaceForm({ ...raceForm, distanceMi: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                  placeholder="26.2"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400">Notes</label>
              <textarea
                value={raceForm.notes}
                onChange={(e) => setRaceForm({ ...raceForm, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600 resize-none"
                placeholder="Goal time, corral, logistics…"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !raceForm.name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-neutral-950 py-2.5 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {raceForm.id === null ? "Add race" : "Save changes"}
            </button>
          </form>
        </div>
      )}

      {form && catalogFilter !== null && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium text-sm">
                <LibraryBig size={16} className="text-accent-400" /> Add from catalog
              </p>
              <button
                type="button"
                onClick={() => setCatalogFilter(null)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close catalog"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "recent", label: "Recent" },
                { key: "all", label: "All" },
                ...catalogTypes.map((t) => ({ key: t, label: PLAN_TYPE_META[t].label })),
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCatalogFilter(key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    catalogFilter === key
                      ? "border-accent-500 bg-accent-500/10 text-accent-400"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
              {filteredTemplates.length === 0 ? (
                <p className="text-xs text-neutral-600 py-4 text-center">
                  Nothing in the catalog matches this filter.
                </p>
              ) : (
                filteredTemplates.map((t) => {
                  const { label, icon: TIcon } =
                    PLAN_TYPE_META[t.activityType ?? "other"] ?? PLAN_TYPE_META.other;
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
                        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-700/60 rounded-l-lg transition-colors"
                      >
                        <TIcon size={16} className="shrink-0 text-accent-400" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">{t.title}</span>
                          <span className="block text-xs text-neutral-500">{bits.join(" · ")}</span>
                        </span>
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
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
