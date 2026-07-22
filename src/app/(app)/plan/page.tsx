"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  LibraryBig,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Settings2,
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
  skipReason: string | null;
  linkedActivityId: number | null;
};

type ActivitySummary = {
  id: number;
  date: string;
  activityType: string | null;
  name: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  notes: string | null;
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
  title: string | null;
  body: string;
};

type Race = {
  id: number;
  date: string;
  name: string;
};

const PLAN_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  ...TYPE_META,
  rest: { label: "Rest", icon: BedDouble },
  // TYPE_META labels this "Activity"; in a prescription picker "Other" is clearer.
  other: { ...TYPE_META.other, label: "Other" },
};

const TYPE_OPTIONS = ["run", "walk", "ride", "strength", "swim", "rest", "other"] as const;

// Per-sport colour, tinted by completion status. Full class strings so Tailwind
// keeps them (no dynamic construction). `planned` is an outline, `completed` is
// filled; skipped is handled separately (muted, struck through).
const SPORT_STYLE: Record<
  string,
  { icon: string; dot: string; planned: string; completed: string }
> = {
  run: {
    icon: "text-emerald-400",
    dot: "bg-emerald-400",
    planned: "border-emerald-900/70 bg-emerald-500/5",
    completed: "border-emerald-600/70 bg-emerald-500/15",
  },
  walk: {
    icon: "text-amber-400",
    dot: "bg-amber-400",
    planned: "border-amber-900/70 bg-amber-500/5",
    completed: "border-amber-600/70 bg-amber-500/15",
  },
  ride: {
    icon: "text-sky-400",
    dot: "bg-sky-400",
    planned: "border-sky-900/70 bg-sky-500/5",
    completed: "border-sky-600/70 bg-sky-500/15",
  },
  strength: {
    icon: "text-violet-400",
    dot: "bg-violet-400",
    planned: "border-violet-900/70 bg-violet-500/5",
    completed: "border-violet-600/70 bg-violet-500/15",
  },
  swim: {
    icon: "text-cyan-400",
    dot: "bg-cyan-400",
    planned: "border-cyan-900/70 bg-cyan-500/5",
    completed: "border-cyan-600/70 bg-cyan-500/15",
  },
  rest: {
    icon: "text-neutral-400",
    dot: "bg-neutral-500",
    planned: "border-neutral-800 bg-neutral-800/30",
    completed: "border-neutral-700 bg-neutral-800/50",
  },
  other: {
    icon: "text-neutral-300",
    dot: "bg-neutral-400",
    planned: "border-neutral-800 bg-neutral-900",
    completed: "border-neutral-700 bg-neutral-800/50",
  },
};

function sportStyle(type: string | null) {
  return SPORT_STYLE[type ?? "other"] ?? SPORT_STYLE.other;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function monthDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function weekRangeLabel(weekStart: string): string {
  return `${monthDay(weekStart)} – ${monthDay(addDays(weekStart, 6))}`;
}

// Whole days from today to a future date, or null if it's in the past.
function daysUntil(dateStr: string, today: string): number | null {
  const diff = Math.round(
    (Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  return diff < 0 ? null : diff;
}

// A weeks-only countdown label, rounded to the nearest week.
function weeksLabel(days: number): string {
  if (days === 0) return "Today";
  const weeks = Math.round(days / 7);
  if (weeks === 0) return "This week";
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
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

type NoteForm = { id: number | null; date: string; title: string; body: string };
type RaceForm = {
  id: number | null;
  date: string;
  name: string;
};

// Catalog picker filters: "recent", "all", or an activity type.
const RECENT_LIMIT = 8;

export default function PlanPage() {
  // Coach mode (which athlete's plan this is) comes from the global cookie;
  // the API resolves it server-side, so requests need no athlete param.
  const coachMode = useCoachMode();
  const today = localDateStr();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [rangeActivities, setRangeActivities] = useState<ActivitySummary[]>([]);
  const [notes, setNotes] = useState<PlanNote[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  // The workout whose detail modal is open, and a single-workout copy buffer.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<PlannedWorkout | null>(null);
  // Drag-to-reschedule state (desktop grid).
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [noteForm, setNoteForm] = useState<NoteForm | null>(null);
  const [raceForm, setRaceForm] = useState<RaceForm | null>(null);
  const [manageRaces, setManageRaces] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline editors inside the detail modal, keyed by workout / activity id.
  const [skipEdit, setSkipEdit] = useState<{ id: number; draft: string } | null>(null);
  const [actNotesEdit, setActNotesEdit] = useState<{ id: number; draft: string } | null>(null);
  const [linkPickerFor, setLinkPickerFor] = useState<number | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  // null = catalog picker closed; otherwise the active filter.
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

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
      const params = new URLSearchParams({ start: weekStart, end: weekEnd });
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
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const viewingSelf = coachMode === null;

  const upcomingRaces = races
    .filter((r) => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  function goToWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelectedDate(next);
    setExpandedId(null);
  }

  function goToToday() {
    setWeekStart(mondayOf(today));
    setSelectedDate(today);
    setExpandedId(null);
  }

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
          body: JSON.stringify({ date: noteForm.date, title: noteForm.title, body: noteForm.body }),
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
    // Leaving the skipped state drops any reason that went with it.
    const body =
      status === "skipped" ? { status } : { status, skipReason: null };
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Newly skipped with no reason yet — open the editor so they can add one.
    if (status === "skipped" && !w.skipReason) {
      setSkipEdit({ id: w.id, draft: "" });
    } else if (status !== "skipped") {
      setSkipEdit((s) => (s?.id === w.id ? null : s));
    }
    await loadPlan();
  }

  async function saveSkipReason(w: PlannedWorkout) {
    if (!skipEdit || skipEdit.id !== w.id) return;
    setInlineSaving(true);
    try {
      await fetch(`/api/planned-workouts/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipReason: skipEdit.draft.trim() || null }),
      });
      setSkipEdit(null);
      await loadPlan();
    } finally {
      setInlineSaving(false);
    }
  }

  async function saveActivityNotes(activityId: number) {
    if (!actNotesEdit || actNotesEdit.id !== activityId) return;
    setInlineSaving(true);
    try {
      await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: actNotesEdit.draft }),
      });
      setActNotesEdit(null);
      await loadPlan();
    } finally {
      setInlineSaving(false);
    }
  }

  async function remove(w: PlannedWorkout) {
    if (!confirm(`Delete "${w.title}"?`)) return;
    await fetch(`/api/planned-workouts/${w.id}`, { method: "DELETE" });
    if (expandedId === w.id) setExpandedId(null);
    await loadPlan();
  }

  // Drag a card onto another day — optimistic move, then persist the new date.
  async function moveWorkout(w: PlannedWorkout, date: string) {
    if (w.date === date) return;
    setWorkouts((ws) => ws.map((x) => (x.id === w.id ? { ...x, date } : x)));
    await fetch(`/api/planned-workouts/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    await loadPlan();
  }

  function copyWorkout(w: PlannedWorkout) {
    setClipboard(w);
    setExpandedId(null);
  }

  async function pasteWorkout(date: string) {
    if (!clipboard) return;
    await fetch("/api/planned-workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        activityType: clipboard.activityType,
        title: clipboard.title,
        description: clipboard.description,
        durationSeconds: clipboard.durationSeconds,
        distanceMeters: clipboard.distanceMeters,
      }),
    });
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

  // Whether an unlinked, planned workout has a same-day, same-type activity it
  // probably corresponds to — surfaced as a subtle badge on the card.
  function hasSuggestion(w: PlannedWorkout) {
    return (
      w.status === "planned" &&
      !w.linkedActivityId &&
      w.activityType !== "rest" &&
      linkCandidates(w, true).length > 0
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

  const expanded = expandedId != null ? workouts.find((w) => w.id === expandedId) ?? null : null;

  function metaBits(w: PlannedWorkout) {
    return [
      w.durationSeconds ? formatDuration(w.durationSeconds) : null,
      w.distanceMeters ? `${(w.distanceMeters / MI).toFixed(1)} mi` : null,
    ].filter(Boolean);
  }

  // A compact, coloured workout card — used inside week-grid cells and in the
  // mobile day detail. Clicking opens the detail modal; dragging reschedules.
  function WorkoutChip({ w }: { w: PlannedWorkout }) {
    const { icon: Icon } = PLAN_TYPE_META[w.activityType ?? "other"] ?? PLAN_TYPE_META.other;
    const style = sportStyle(w.activityType);
    const skipped = w.status === "skipped";
    return (
      <button
        draggable
        onDragStart={() => setDragId(w.id)}
        onDragEnd={() => {
          setDragId(null);
          setDragOverDate(null);
        }}
        onClick={() => setExpandedId(w.id)}
        className={cn(
          "group w-full rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer",
          skipped
            ? "border-neutral-800 bg-neutral-900 opacity-60"
            : w.status === "completed"
            ? style.completed
            : style.planned,
          dragId === w.id && "opacity-40",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={cn("shrink-0", skipped ? "text-neutral-500" : style.icon)} />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs font-medium",
              skipped && "line-through text-neutral-500",
            )}
          >
            {w.title}
          </span>
          {w.status === "completed" && (
            <Check size={12} className="shrink-0 text-green-400" />
          )}
          {hasSuggestion(w) && (
            <Link2 size={11} className="shrink-0 text-accent-400" />
          )}
        </div>
        {metaBits(w).length > 0 && (
          <p className="mt-0.5 pl-[19px] text-[11px] text-neutral-500 tabular-nums">
            {metaBits(w).join(" · ")}
          </p>
        )}
      </button>
    );
  }

  // Cell contents shared by the desktop grid and (loosely) the mobile detail:
  // race chips, note chips, workout chips.
  function dayRaceChips(date: string) {
    return races
      .filter((r) => r.date === date)
      .map((r) => (
        <button
          key={`race-${r.id}`}
          onClick={() => setRaceForm({ id: r.id, date: r.date, name: r.name })}
          className="flex w-full items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-500/10 px-2 py-1.5 text-left transition-colors hover:bg-red-500/15"
        >
          <Flag size={12} className="shrink-0 text-red-400" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-red-200">{r.name}</span>
        </button>
      ));
  }

  function dayNoteChips(date: string) {
    return notes
      .filter((n) => n.date === date)
      .map((n) => (
        <button
          key={`note-${n.id}`}
          onClick={() => setNoteForm({ id: n.id, date: n.date, title: n.title ?? "", body: n.body })}
          className="flex w-full items-start gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left transition-colors hover:border-neutral-700"
        >
          <StickyNote size={12} className="mt-0.5 shrink-0 text-neutral-400" />
          <span className="min-w-0 flex-1">
            {n.title && <span className="block truncate text-xs font-medium">{n.title}</span>}
            <span className="block truncate text-[11px] text-neutral-400">{n.body}</span>
          </span>
        </button>
      ));
  }

  const dayWorkouts = (date: string) => workouts.filter((w) => w.date === date);

  return (
    <div className="flex-1 p-4 space-y-4 md:max-w-none max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Training Plan</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {viewingSelf
              ? "Your prescribed workouts"
              : `Prescribing for ${coachMode.athleteName}`}
          </p>
        </div>
        {clipboard && (
          <div className="flex items-center gap-1.5 rounded-full border border-accent-500/50 bg-accent-500/10 py-1 pl-3 pr-1 text-xs text-accent-300">
            <Copy size={12} />
            <span className="max-w-[10rem] truncate font-medium">Copied: {clipboard.title}</span>
            <button
              onClick={() => setClipboard(null)}
              className="rounded-full p-1 hover:bg-accent-500/20"
              aria-label="Clear copied workout"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Upcoming races with countdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 uppercase tracking-wider">
            <Flag size={13} /> Races
          </p>
          <button
            onClick={() => setManageRaces(true)}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
          >
            <Settings2 size={12} /> Manage races
          </button>
        </div>
        {upcomingRaces.length === 0 ? (
          <p className="text-xs text-neutral-600 px-1">No upcoming races</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {upcomingRaces.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{dayLabel(r.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-accent-400 tabular-nums">
                    {weeksLabel(daysUntil(r.date, today)!)}
                  </p>
                  <p className="text-[11px] text-neutral-500">to go</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToWeek(-1)}
            className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goToWeek(1)}
            className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            Today
          </button>
        </div>
        <p className="text-sm font-medium tabular-nums">{weekRangeLabel(weekStart)}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: 7-column week grid with cards inside each day cell. */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {weekDays.map((date) => {
              const isToday = date === today;
              const dow = WEEKDAYS[weekDays.indexOf(date)];
              return (
                <div
                  key={date}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDate(date);
                  }}
                  onDragLeave={() => setDragOverDate((d) => (d === date ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const w = workouts.find((x) => x.id === dragId);
                    if (w) moveWorkout(w, date);
                    setDragOverDate(null);
                    setDragId(null);
                  }}
                  className={cn(
                    "group flex min-h-[10rem] flex-col rounded-xl border p-1.5 transition-colors",
                    dragOverDate === date
                      ? "border-accent-500 bg-accent-500/5"
                      : "border-neutral-800 bg-neutral-900/40",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <span className="text-[11px] font-medium text-neutral-500">{dow}</span>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday ? "bg-accent-500 font-bold text-neutral-950" : "text-neutral-300",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1">
                    {dayRaceChips(date)}
                    {dayNoteChips(date)}
                    {dayWorkouts(date).map((w) => (
                      <WorkoutChip key={w.id} w={w} />
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openCreate(date)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-700 py-1 text-[11px] text-neutral-500 hover:border-accent-500/60 hover:text-accent-400 transition-colors"
                    >
                      <Plus size={11} /> Add
                    </button>
                    {clipboard && (
                      <button
                        onClick={() => pasteWorkout(date)}
                        className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-accent-500/50 px-2 py-1 text-[11px] text-accent-400 hover:bg-accent-500/10 transition-colors"
                        title={`Paste "${clipboard.title}"`}
                      >
                        <Copy size={11} /> Paste
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: swipeable week strip + tap-a-day detail. */}
          <div className="md:hidden space-y-4">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((date) => {
                const isToday = date === today;
                const isSelected = date === selectedDate;
                const dayTypes = Array.from(
                  new Set(dayWorkouts(date).map((w) => w.activityType ?? "other")),
                ).slice(0, 3);
                const hasRace = races.some((r) => r.date === date);
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-1.5 transition-colors",
                      isSelected
                        ? "border-accent-500 bg-accent-500/10"
                        : "border-transparent hover:bg-neutral-800",
                    )}
                  >
                    <span className="text-[10px] font-medium text-neutral-500">
                      {WEEKDAYS[weekDays.indexOf(date)]}
                    </span>
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        isToday ? "font-bold text-accent-400" : "text-neutral-200",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {hasRace && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                      {dayTypes.map((t) => (
                        <span
                          key={t}
                          className={cn("h-1.5 w-1.5 rounded-full", sportStyle(t).dot)}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected day detail */}
            <div className="space-y-3 border-t border-neutral-800 pt-3">
              <div className="flex items-center justify-between">
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
                  {clipboard && (
                    <button
                      onClick={() => pasteWorkout(selectedDate)}
                      className="flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors"
                    >
                      <Copy size={12} /> Paste
                    </button>
                  )}
                  <button
                    onClick={() => setNoteForm({ id: null, date: selectedDate, title: "", body: "" })}
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

              <div className="space-y-2">
                {dayRaceChips(selectedDate)}
                {dayNoteChips(selectedDate)}
                {dayWorkouts(selectedDate).map((w) => (
                  <WorkoutChip key={w.id} w={w} />
                ))}
                {dayWorkouts(selectedDate).length === 0 &&
                  notes.filter((n) => n.date === selectedDate).length === 0 &&
                  races.filter((r) => r.date === selectedDate).length === 0 && (
                    <p className="text-xs text-neutral-600 px-1">Nothing planned</p>
                  )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Workout detail modal (click-to-expand) */}
      {expanded && (
        <div className="fixed inset-0 z-20 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-neutral-800 bg-neutral-900 p-4 md:rounded-2xl">
            {(() => {
              const w = expanded;
              const { label, icon: Icon } =
                PLAN_TYPE_META[w.activityType ?? "other"] ?? PLAN_TYPE_META.other;
              const linkedActivity = w.linkedActivityId
                ? rangeActivities.find((a) => a.id === w.linkedActivityId) ?? null
                : null;
              const pickerOpen = linkPickerFor === w.id;
              const candidates = linkCandidates(w, pickerOpen ? false : true);
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Icon size={20} className={cn("mt-0.5 shrink-0", sportStyle(w.activityType).icon)} />
                      <div className="min-w-0">
                        <p className={cn("font-medium", w.status === "skipped" && "line-through")}>
                          {w.title}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {[label, ...metaBits(w)].join(" · ")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="p-1 text-neutral-500 hover:text-neutral-200"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {w.status === "completed" && (
                    <p className="flex items-center gap-1 text-xs font-medium text-green-400">
                      <Check size={13} /> Completed
                    </p>
                  )}

                  {w.description && (
                    <p className="whitespace-pre-wrap text-sm text-neutral-300">{w.description}</p>
                  )}

                  {/* Skip reason */}
                  {w.status === "skipped" &&
                    (skipEdit?.id === w.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={skipEdit.draft}
                          onChange={(e) => setSkipEdit({ ...skipEdit, draft: e.target.value })}
                          rows={2}
                          autoFocus
                          placeholder="Why did you skip this? (optional)"
                          className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs outline-none placeholder-neutral-600 focus:border-neutral-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSkipEdit(null)}
                            className="flex-1 rounded-lg border border-neutral-700 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveSkipReason(w)}
                            disabled={inlineSaving}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-500 py-1.5 text-xs font-medium text-neutral-950 hover:bg-accent-400 disabled:opacity-50"
                          >
                            {inlineSaving && <Loader2 size={12} className="animate-spin" />} Save
                          </button>
                        </div>
                      </div>
                    ) : w.skipReason ? (
                      <div className="flex items-start justify-between gap-2 rounded-lg bg-neutral-800/40 px-3 py-2">
                        <p className="flex min-w-0 items-start gap-1.5 text-xs text-neutral-300">
                          <StickyNote size={12} className="mt-0.5 shrink-0 text-neutral-500" />
                          <span className="whitespace-pre-wrap">{w.skipReason}</span>
                        </p>
                        {viewingSelf && (
                          <button
                            onClick={() => setSkipEdit({ id: w.id, draft: w.skipReason ?? "" })}
                            className="shrink-0 p-0.5 text-neutral-500 hover:text-accent-400 transition-colors"
                            aria-label="Edit skip reason"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    ) : viewingSelf ? (
                      <button
                        onClick={() => setSkipEdit({ id: w.id, draft: "" })}
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-accent-400 transition-colors"
                      >
                        <Plus size={12} /> Add a reason
                      </button>
                    ) : null)}

                  {/* Linked actual activity */}
                  {w.linkedActivityId && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-800/60 px-3 py-2">
                      <Link
                        href={`/activities/${w.linkedActivityId}`}
                        className="flex min-w-0 items-center gap-2 text-xs text-neutral-300 hover:text-accent-400 transition-colors"
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
                        className="shrink-0 p-1 text-neutral-600 hover:text-red-400 transition-colors"
                        aria-label="Unlink activity"
                        title="Unlink activity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Activity notes for the linked activity */}
                  {w.linkedActivityId && linkedActivity && (
                    <div className="space-y-1.5 rounded-lg bg-neutral-800/40 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                          <StickyNote size={11} /> Activity notes
                        </p>
                        {viewingSelf && actNotesEdit?.id !== w.linkedActivityId && (
                          <button
                            onClick={() =>
                              setActNotesEdit({
                                id: w.linkedActivityId!,
                                draft: linkedActivity.notes ?? "",
                              })
                            }
                            className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-accent-400 transition-colors"
                          >
                            <Pencil size={11} /> {linkedActivity.notes ? "Edit" : "Add"}
                          </button>
                        )}
                      </div>
                      {actNotesEdit?.id === w.linkedActivityId ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={actNotesEdit.draft}
                            onChange={(e) => setActNotesEdit({ ...actNotesEdit, draft: e.target.value })}
                            rows={3}
                            autoFocus
                            placeholder="How did it feel? Conditions, effort, injuries…"
                            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs outline-none placeholder-neutral-600 focus:border-neutral-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setActNotesEdit(null)}
                              className="flex-1 rounded-lg border border-neutral-700 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveActivityNotes(w.linkedActivityId!)}
                              disabled={inlineSaving}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-500 py-1.5 text-xs font-medium text-neutral-950 hover:bg-accent-400 disabled:opacity-50"
                            >
                              {inlineSaving && <Loader2 size={12} className="animate-spin" />} Save
                            </button>
                          </div>
                        </div>
                      ) : linkedActivity.notes ? (
                        <p className="whitespace-pre-wrap text-xs text-neutral-300">
                          {linkedActivity.notes}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-600">No notes yet.</p>
                      )}
                    </div>
                  )}

                  {/* Link a completed activity */}
                  {!w.linkedActivityId && w.activityType !== "rest" && candidates.length > 0 && (
                    <div className="space-y-1.5 rounded-lg border border-accent-500/30 bg-accent-500/5 p-2.5">
                      <p className="text-xs font-medium text-accent-400">
                        {pickerOpen ? "Link a completed activity" : "Looks like you did this"}
                      </p>
                      {candidates.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => linkActivity(w, a)}
                          className="flex w-full items-center justify-between gap-2 rounded-md bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700 transition-colors"
                        >
                          <span className="truncate text-xs font-medium">{a.name ?? "Activity"}</span>
                          <span className="shrink-0 text-xs text-neutral-400">{activityLine(a)}</span>
                        </button>
                      ))}
                      <p className="text-[11px] text-neutral-500">Tap to link — marks the workout complete.</p>
                      {!pickerOpen && (
                        <button
                          onClick={() => setLinkPickerFor(w.id)}
                          className="text-[11px] text-neutral-500 hover:text-accent-400 transition-colors"
                        >
                          Show all activities that day
                        </button>
                      )}
                    </div>
                  )}

                  {/* Status actions */}
                  {viewingSelf && w.activityType !== "rest" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStatus(w, w.status === "completed" ? "planned" : "completed")}
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
                        onClick={() => setStatus(w, w.status === "skipped" ? "planned" : "skipped")}
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

                  {/* Card tools */}
                  <div className="flex items-center gap-1 border-t border-neutral-800 pt-3">
                    <button
                      onClick={() => copyWorkout(w)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-accent-400 transition-colors"
                    >
                      <Copy size={13} /> Copy
                    </button>
                    <button
                      onClick={() => toggleCatalog(w)}
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-neutral-800",
                        catalogEntry(w)
                          ? "text-accent-400 hover:text-accent-300"
                          : "text-neutral-400 hover:text-accent-400",
                      )}
                    >
                      {catalogEntry(w) ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
                      {catalogEntry(w) ? "Saved" : "Save"}
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        openEdit(w);
                        setExpandedId(null);
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => remove(w)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
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
            <div className="grid grid-cols-2 gap-2">
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
                <label className="text-xs text-neutral-400">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
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
              <div className="flex items-center gap-1">
                {noteForm.id !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      const n = notes.find((x) => x.id === noteForm.id);
                      if (n) removeNote(n);
                      setNoteForm(null);
                    }}
                    className="p-1 text-neutral-500 hover:text-red-400"
                    aria-label="Delete note"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNoteForm(null)}
                  className="p-1 text-neutral-500 hover:text-neutral-200"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <input
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
              autoFocus
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500 placeholder-neutral-600"
              placeholder="Title (optional)"
            />
            <textarea
              value={noteForm.body}
              onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })}
              rows={4}
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
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
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

      {manageRaces && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium text-sm">
                <Flag size={16} className="text-red-400" /> Manage races
              </p>
              <button
                type="button"
                onClick={() => setManageRaces(false)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRaceForm({ id: null, date: selectedDate, name: "" })}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2 text-sm font-medium text-neutral-300 hover:border-accent-500/60 hover:text-accent-400 transition-colors"
            >
              <Plus size={14} /> Add race
            </button>
            <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
              {races.length === 0 ? (
                <p className="text-xs text-neutral-600 py-4 text-center">No races yet.</p>
              ) : (
                races.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800"
                  >
                    <div className="flex-1 min-w-0 px-3 py-2">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-neutral-500">{dayLabel(r.date)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRaceForm({ id: r.id, date: r.date, name: r.name })}
                      className="p-2 shrink-0 text-neutral-500 hover:text-neutral-200 transition-colors"
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRace(r)}
                      className="p-2 shrink-0 text-neutral-600 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
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
                        <TIcon size={16} className={cn("shrink-0", sportStyle(t.activityType).icon)} />
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
