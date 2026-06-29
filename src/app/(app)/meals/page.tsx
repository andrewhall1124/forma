"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Plus, X, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

type Meal = {
  id: number;
  date: string;
  mealType: string | null;
  name: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
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
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"photo" | "analyzing" | "confirm">("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mealType, setMealType] = useState<string>("lunch");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadMeals() {
    const res = await fetch(`/api/meals?date=${todayStr()}`);
    setMealList(await res.json());
  }

  useEffect(() => { loadMeals(); }, []);

  const totalCalories = mealList.reduce((sum, m) => sum + (m.calories ?? 0), 0);

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
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr(),
          mealType,
          name: analysis.name,
          description: analysis.description,
          calories: analysis.calories,
          proteinG: analysis.proteinG,
          carbsG: analysis.carbsG,
          fatG: analysis.fatG,
          fiberG: analysis.fiberG,
        }),
      });
      await loadMeals();
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setStep("photo");
    setPreview(null);
    setAnalysis(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
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
          {mealList.map((meal) => (
            <div key={meal.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{meal.name}</p>
                  {meal.mealType && (
                    <p className="text-xs text-neutral-400 capitalize mt-0.5">{meal.mealType}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-neutral-200 ml-3 shrink-0">
                  {meal.calories != null ? `${Math.round(meal.calories)} kcal` : "—"}
                </p>
              </div>
              {(meal.proteinG != null || meal.carbsG != null || meal.fatG != null) && (
                <div className="flex gap-3 mt-2 text-xs text-neutral-400">
                  {meal.proteinG != null && <span>P {Math.round(meal.proteinG)}g</span>}
                  {meal.carbsG != null && <span>C {Math.round(meal.carbsG)}g</span>}
                  {meal.fatG != null && <span>F {Math.round(meal.fatG)}g</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div className="relative rounded-t-2xl bg-neutral-900 border-t border-neutral-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {step === "photo" ? "Log Meal" : step === "analyzing" ? "Analyzing…" : "Confirm Meal"}
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
                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}
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
                <div className="flex gap-3">
                  {preview && (
                    <img
                      src={preview}
                      alt="meal preview"
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div>
                    <p className="font-semibold">{analysis.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{analysis.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "kcal", value: Math.round(analysis.calories) },
                    { label: "protein", value: `${Math.round(analysis.proteinG)}g` },
                    { label: "carbs", value: `${Math.round(analysis.carbsG)}g` },
                    { label: "fat", value: `${Math.round(analysis.fatG)}g` },
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
                  <button
                    onClick={() => { setStep("photo"); setPreview(null); setAnalysis(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-neutral-700 py-3 text-sm text-neutral-300 hover:bg-neutral-800"
                  >
                    <RotateCcw size={14} /> Retake
                  </button>
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
      )}
    </div>
  );
}
