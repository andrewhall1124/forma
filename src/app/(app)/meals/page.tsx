"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Plus, X, Check, RotateCcw, Minus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Meal = {
  id: number;
  date: string;
  mealType: string | null;
  name: string;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  servings: number | null;
  createdAt: string;
};

type Analysis = {
  name: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  description: string;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function MealsPage() {
  const [mealList, setMealList] = useState<Meal[]>([]);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [step, setStep] = useState<"photo" | "analyzing" | "confirm">("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mealType, setMealType] = useState<string>("lunch");
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadMeals() {
    const res = await fetch(`/api/meals?date=${todayStr()}`);
    setMealList(await res.json());
  }

  async function loadRecent() {
    const res = await fetch("/api/meals");
    const all: Meal[] = await res.json();
    const seen = new Set<string>();
    setRecentMeals(
      all
        .filter((m) => {
          if (seen.has(m.name)) return false;
          seen.add(m.name);
          return true;
        })
        .slice(0, 10)
    );
  }

  useEffect(() => {
    loadMeals();
    loadRecent();
  }, []);

  const totalCalories = mealList.reduce(
    (sum, m) => sum + (m.calories ?? 0) * (m.servings ?? 1),
    0
  );

  function handleEdit(meal: Meal) {
    setEditingMeal(meal);
    setAnalysis({
      name: meal.name,
      mealType: meal.mealType ?? "snack",
      calories: meal.calories ?? 0,
      proteinG: meal.proteinG ?? 0,
      carbsG: meal.carbsG ?? 0,
      fatG: meal.fatG ?? 0,
      fiberG: meal.fiberG ?? 0,
      description: meal.description ?? "",
    });
    setMealType(meal.mealType ?? "snack");
    setServings(meal.servings ?? 1);
    setStep("confirm");
    setIsOpen(true);
  }

  async function handleDelete(meal: Meal) {
    setMealList((prev) => prev.filter((m) => m.id !== meal.id));
    await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
    loadRecent();
  }

  function handleRecentMeal(meal: Meal) {
    setAnalysis({
      name: meal.name,
      mealType: meal.mealType ?? "snack",
      calories: meal.calories ?? 0,
      proteinG: meal.proteinG ?? 0,
      carbsG: meal.carbsG ?? 0,
      fatG: meal.fatG ?? 0,
      fiberG: meal.fiberG ?? 0,
      description: meal.description ?? "",
    });
    setMealType(meal.mealType ?? "snack");
    setServings(1);
    setStep("confirm");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setStep("analyzing");

      const [header, data] = dataUrl.split(",");
      const mediaType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";

      try {
        const res = await fetch("/api/meals/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: data, mediaType }),
        });
        if (!res.ok) throw new Error("Analysis failed");
        const result: Analysis = await res.json();
        setAnalysis(result);
        setMealType(result.mealType || "lunch");
        setServings(1);
        setStep("confirm");
      } catch {
        setError("Couldn't analyze the photo. Please try again.");
        setStep("photo");
        setPreview(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!analysis) return;
    setSaving(true);
    try {
      const payload = {
        mealType,
        name: analysis.name,
        description: analysis.description,
        calories: analysis.calories,
        proteinG: analysis.proteinG,
        carbsG: analysis.carbsG,
        fatG: analysis.fatG,
        fiberG: analysis.fiberG,
        servings,
      };

      if (editingMeal) {
        await fetch(`/api/meals/${editingMeal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/meals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, date: todayStr() }),
        });
      }

      await loadMeals();
      loadRecent();
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setEditingMeal(null);
    setStep("photo");
    setPreview(null);
    setAnalysis(null);
    setError(null);
    setServings(1);
    if (fileRef.current) fileRef.current.value = "";
  }

  function adjustServings(delta: number) {
    setServings((s) => Math.max(0.5, parseFloat((s + delta).toFixed(1))));
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-neutral-400">Today</p>
          <p className="text-3xl font-bold">{Math.round(totalCalories)}</p>
          <p className="text-xs text-neutral-400">kcal consumed</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 active:bg-blue-700"
        >
          <Plus size={16} />
          Add Meal
        </button>
      </div>

      {mealList.length === 0 ? (
        <p className="text-center text-neutral-500 text-sm py-12">No meals logged today</p>
      ) : (
        <div className="space-y-2">
          {mealList.map((meal) => {
            const s = meal.servings ?? 1;
            return (
              <div key={meal.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{meal.name}</p>
                    <p className="text-xs text-neutral-400 capitalize mt-0.5">
                      {[meal.mealType, s !== 1 ? `${s} serving${s !== 1 ? "s" : ""}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <p className="text-sm font-semibold text-neutral-200">
                      {meal.calories != null ? `${Math.round(meal.calories * s)} kcal` : "—"}
                    </p>
                    <button
                      onClick={() => handleEdit(meal)}
                      className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(meal)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {(meal.proteinG != null || meal.carbsG != null || meal.fatG != null) && (
                  <div className="flex gap-3 mt-2 text-xs text-neutral-400">
                    {meal.proteinG != null && <span>P {Math.round(meal.proteinG * s)}g</span>}
                    {meal.carbsG != null && <span>C {Math.round(meal.carbsG * s)}g</span>}
                    {meal.fatG != null && <span>F {Math.round(meal.fatG * s)}g</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-neutral-900 border-t border-neutral-800 flex flex-col max-h-[85vh]">
            <div className="overflow-y-auto overscroll-contain p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {step === "photo"
                    ? "Log Meal"
                    : step === "analyzing"
                    ? "Analyzing…"
                    : editingMeal
                    ? "Edit Meal"
                    : "Confirm Meal"}
                </h3>
                <button onClick={handleClose} className="text-neutral-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              {step === "photo" && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setMealType(t)}
                        className={cn(
                          "rounded-lg py-2 text-xs capitalize font-medium border transition-colors",
                          mealType === t
                            ? "border-blue-500 bg-blue-500/20 text-blue-300"
                            : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-700 p-10 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    <Camera size={32} />
                    <span className="text-sm">Take a photo or choose from library</span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFile}
                  />

                  {recentMeals.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-500 uppercase tracking-wide">Recent</p>
                      <div className="space-y-1.5">
                        {recentMeals.map((meal) => (
                          <button
                            key={meal.id}
                            onClick={() => handleRecentMeal(meal)}
                            className="w-full flex items-center justify-between rounded-xl bg-neutral-800 px-4 py-3 text-sm hover:bg-neutral-700 transition-colors text-left"
                          >
                            <span className="font-medium truncate">{meal.name}</span>
                            <span className="text-neutral-400 shrink-0 ml-3">
                              {meal.calories != null ? `${Math.round(meal.calories)} kcal` : "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === "analyzing" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  {preview && (
                    <img src={preview} alt="meal preview" className="w-48 h-48 object-cover rounded-xl" />
                  )}
                  <div className="flex items-center gap-2 text-neutral-400">
                    <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
                    <span className="text-sm">Claude is analyzing your meal…</span>
                  </div>
                </div>
              )}

              {step === "confirm" && analysis && (
                <>
                  {preview ? (
                    <div className="flex gap-3">
                      <img
                        src={preview}
                        alt="meal preview"
                        className="w-16 h-16 object-cover rounded-lg shrink-0"
                      />
                      <div>
                        <p className="font-semibold">{analysis.name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{analysis.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">{analysis.name}</p>
                      {analysis.description && (
                        <p className="text-xs text-neutral-400 mt-0.5">{analysis.description}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 rounded-xl bg-neutral-800 px-4 py-3">
                    <span className="text-sm flex-1">Servings</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => adjustServings(-0.5)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-lg font-bold w-10 text-center tabular-nums">{servings}</span>
                      <button
                        onClick={() => adjustServings(0.5)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "kcal", value: Math.round(analysis.calories * servings) },
                      { label: "protein", value: `${Math.round(analysis.proteinG * servings)}g` },
                      { label: "carbs", value: `${Math.round(analysis.carbsG * servings)}g` },
                      { label: "fat", value: `${Math.round(analysis.fatG * servings)}g` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-neutral-800 p-3 text-center">
                        <p className="text-lg font-bold">{value}</p>
                        <p className="text-xs text-neutral-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setMealType(t)}
                        className={cn(
                          "rounded-lg py-2 text-xs capitalize font-medium border transition-colors",
                          mealType === t
                            ? "border-blue-500 bg-blue-500/20 text-blue-300"
                            : "border-neutral-700 text-neutral-400"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {editingMeal ? (
                      <button
                        onClick={handleClose}
                        className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-neutral-700 py-3 text-sm text-neutral-300 hover:bg-neutral-800"
                      >
                        <X size={14} /> Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setStep("photo");
                          setPreview(null);
                          setAnalysis(null);
                          setServings(1);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-neutral-700 py-3 text-sm text-neutral-300 hover:bg-neutral-800"
                      >
                        <RotateCcw size={14} /> Retake
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <><Check size={16} /> Save Meal</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
