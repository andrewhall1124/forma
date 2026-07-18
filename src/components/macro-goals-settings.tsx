"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  DEFAULT_MACRO_GOALS,
  MACRO_GOAL_KEYS,
  type MacroGoals,
} from "@/lib/macro-goals";

const FIELDS: { key: (typeof MACRO_GOAL_KEYS)[number]; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
];

export default function MacroGoalsSettings() {
  const [goals, setGoals] = useState<MacroGoals>(DEFAULT_MACRO_GOALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/macro-goals");
      if (res.ok) setGoals(await res.json());
      setLoading(false);
    })();
  }, []);

  // Derived so protein/carbs/fat always add up to the calories shown.
  const kcalFromMacros = goals.proteinG * 4 + goals.carbsG * 4 + goals.fatG * 9;

  function setField(key: (typeof MACRO_GOAL_KEYS)[number], raw: string) {
    setSaved(false);
    setGoals((g) => ({ ...g, [key]: Math.max(0, Math.round(Number(raw) || 0)) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/macro-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goals),
      });
      if (!res.ok) throw new Error();
      setGoals(await res.json());
      setSaved(true);
    } catch {
      setError("Failed to save goals. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-4"
    >
      <div>
        <p className="font-medium text-sm">Nutrition Goals</p>
        <p className="text-xs text-neutral-400 mt-0.5">
          Daily macro targets shown on your dashboard and meals history.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-neutral-400">
                  {f.label} <span className="text-neutral-600">({f.unit})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={goals[f.key]}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-neutral-500">
            Protein + carbs + fat ≈ <span className="text-neutral-300">{kcalFromMacros}</span> kcal
            {Math.abs(kcalFromMacros - goals.calories) > 50 && (
              <span className="text-amber-400/80">
                {" "}— doesn&apos;t match your {goals.calories} kcal target
              </span>
            )}
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-neutral-950 py-2.5 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saved && !saving && <Check size={14} />}
            {saved && !saving ? "Saved" : "Save Goals"}
          </button>
        </>
      )}
    </form>
  );
}
