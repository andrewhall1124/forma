"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Camera, Plus, X, Check, RotateCcw, Minus, Pencil, Trash2, ChevronDown, ChevronUp, Type, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { localDateStr } from "@/lib/date";

type Ingredient = {
  name: string;
  amount: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // In-form only: a quantity multiplier on the base (qty=1) macros above.
  // Baked into the macros + amount label on save; never persisted.
  qty?: number;
};

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
  ingredients: Ingredient[] | null;
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
  ingredients: Ingredient[];
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const MACRO_FIELDS = [
  { key: "calories", label: "kcal" },
  { key: "proteinG", label: "protein" },
  { key: "carbsG", label: "carbs" },
  { key: "fatG", label: "fat" },
] as const;

type MacroKey = (typeof MACRO_FIELDS)[number]["key"];

function todayStr() {
  return localDateStr();
}

export default function MealsPage() {
  const [mealList, setMealList] = useState<Meal[]>([]);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [expandedMealId, setExpandedMealId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [inputMode, setInputMode] = useState<"photo" | "text">("photo");
  const [textInput, setTextInput] = useState("");
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

  const totalCalories = mealList.reduce((sum, m) => sum + (m.calories ?? 0) * (m.servings ?? 1), 0);
  const totalProtein = mealList.reduce((sum, m) => sum + (m.proteinG ?? 0) * (m.servings ?? 1), 0);
  const totalCarbs = mealList.reduce((sum, m) => sum + (m.carbsG ?? 0) * (m.servings ?? 1), 0);
  const totalFat = mealList.reduce((sum, m) => sum + (m.fatG ?? 0) * (m.servings ?? 1), 0);

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
      ingredients: meal.ingredients ?? [],
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
      ingredients: meal.ingredients ?? [],
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

  async function handleText() {
    if (!textInput.trim()) return;
    setError(null);
    setStep("analyzing");
    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput.trim() }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const result: Analysis = await res.json();
      setAnalysis(result);
      setMealType(result.mealType || "lunch");
      setServings(1);
      setStep("confirm");
    } catch {
      setError("Couldn't analyze that description. Please try again.");
      setStep("photo");
    }
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
        // Bake each ingredient's quantity multiplier into its macros + amount
        // label so the stored shape stays {name, amount, ...macros} with no qty.
        ingredients: analysis.ingredients?.length
          ? analysis.ingredients.map((ing) => {
              const q = ing.qty ?? 1;
              return {
                name: ing.name,
                amount: q !== 1 ? `${ing.amount} ×${q}` : ing.amount,
                calories: ing.calories * q,
                proteinG: ing.proteinG * q,
                carbsG: ing.carbsG * q,
                fatG: ing.fatG * q,
              };
            })
          : null,
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
    setInputMode("photo");
    setTextInput("");
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

  // Inputs show the serving-scaled total; store the per-serving base value.
  function setMacro(key: MacroKey, total: number) {
    setAnalysis((a) => (a ? { ...a, [key]: servings ? total / servings : total } : a));
  }

  // Scale a single ingredient by a quantity multiplier and roll the change
  // into the meal totals (delta-based, so other manual edits are preserved).
  function adjustIngredientQty(index: number, delta: number) {
    setAnalysis((a) => {
      if (!a) return a;
      const ing = a.ingredients[index];
      const oldQty = ing.qty ?? 1;
      const newQty = Math.max(0.5, parseFloat((oldQty + delta).toFixed(1)));
      const f = newQty - oldQty;
      if (f === 0) return a;
      return {
        ...a,
        calories: a.calories + ing.calories * f,
        proteinG: a.proteinG + ing.proteinG * f,
        carbsG: a.carbsG + ing.carbsG * f,
        fatG: a.fatG + ing.fatG * f,
        ingredients: a.ingredients.map((x, i) => (i === index ? { ...x, qty: newQty } : x)),
      };
    });
  }

  function removeIngredient(index: number) {
    setAnalysis((a) => {
      if (!a) return a;
      const ing = a.ingredients[index];
      const q = ing.qty ?? 1;
      return {
        ...a,
        calories: a.calories - ing.calories * q,
        proteinG: a.proteinG - ing.proteinG * q,
        carbsG: a.carbsG - ing.carbsG * q,
        fatG: a.fatG - ing.fatG * q,
        ingredients: a.ingredients.filter((_, i) => i !== index),
      };
    });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-neutral-400">Today</p>
          <p className="text-3xl font-bold">{Math.round(totalCalories)}</p>
          <p className="text-xs text-neutral-400">kcal consumed</p>
          <div className="flex gap-3 mt-1.5 text-xs text-neutral-500">
            <span>P <span className="text-neutral-300 font-medium">{Math.round(totalProtein)}g</span></span>
            <span>C <span className="text-neutral-300 font-medium">{Math.round(totalCarbs)}g</span></span>
            <span>F <span className="text-neutral-300 font-medium">{Math.round(totalFat)}g</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/meals/catalog"
            className="flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700"
          >
            <BookOpen size={16} />
            Catalog
          </Link>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-full bg-accent-500 text-neutral-950 px-4 py-2.5 text-sm font-medium hover:bg-accent-400 active:bg-accent-600"
          >
            <Plus size={16} />
            Add Meal
          </button>
        </div>
      </div>

      {mealList.length === 0 ? (
        <p className="text-center text-neutral-500 text-sm py-12">No meals logged today</p>
      ) : (
        <div className="space-y-2">
          {mealList.map((meal) => {
            const s = meal.servings ?? 1;
            const isExpanded = expandedMealId === meal.id;
            const hasIngredients = meal.ingredients && meal.ingredients.length > 0;
            return (
              <div key={meal.id} className="rounded-xl border border-neutral-800 bg-neutral-900">
                {/* Card header — tappable to expand ingredients */}
                <div
                  className={cn("p-4", hasIngredients && "cursor-pointer")}
                  onClick={() => hasIngredients && setExpandedMealId(isExpanded ? null : meal.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{meal.name}</p>
                      <p className="text-xs text-neutral-400 capitalize mt-0.5">
                        {[meal.mealType, s !== 1 ? `${s} serving${s !== 1 ? "s" : ""}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <p className="text-sm font-semibold text-neutral-200 mr-1">
                        {meal.calories != null ? `${Math.round(meal.calories * s)} kcal` : "—"}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(meal); }}
                        className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(meal); }}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {(meal.proteinG != null || meal.carbsG != null || meal.fatG != null) && (
                      <div className="flex gap-3 text-xs text-neutral-400">
                        {meal.proteinG != null && <span>P {Math.round(meal.proteinG * s)}g</span>}
                        {meal.carbsG != null && <span>C {Math.round(meal.carbsG * s)}g</span>}
                        {meal.fatG != null && <span>F {Math.round(meal.fatG * s)}g</span>}
                      </div>
                    )}
                    {hasIngredients && (
                      <span className="text-xs text-neutral-500 ml-auto flex items-center gap-1">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {meal.ingredients!.length} ingredients
                      </span>
                    )}
                  </div>
                </div>

                {/* Ingredient breakdown */}
                {isExpanded && hasIngredients && (
                  <div className="border-t border-neutral-800 px-4 pb-3 pt-2 space-y-1.5">
                    {meal.ingredients!.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-neutral-200 truncate">{ing.name}</span>
                          <span className="text-neutral-500 ml-2 text-xs">{ing.amount}</span>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-neutral-300 text-xs">{Math.round(ing.calories * s)} kcal</span>
                          <span className="text-neutral-500 text-xs ml-2">
                            P{Math.round(ing.proteinG * s)} C{Math.round(ing.carbsG * s)} F{Math.round(ing.fatG * s)}
                          </span>
                        </div>
                      </div>
                    ))}
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
                            ? "border-accent-500 bg-accent-500/20 text-accent-300"
                            : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Input mode toggle */}
                  <div className="flex gap-2 rounded-xl bg-neutral-800 p-1">
                    <button
                      onClick={() => setInputMode("photo")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                        inputMode === "photo"
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      )}
                    >
                      <Camera size={15} /> Photo
                    </button>
                    <button
                      onClick={() => setInputMode("text")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                        inputMode === "text"
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      )}
                    >
                      <Type size={15} /> Describe
                    </button>
                  </div>

                  {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                  {inputMode === "photo" ? (
                    <>
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
                        className="hidden"
                        onChange={handleFile}
                      />
                    </>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleText(); } }}
                        placeholder="e.g. 2.5 bowls of cinnamon toast crunch with whole milk"
                        rows={3}
                        className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
                      />
                      <button
                        onClick={handleText}
                        disabled={!textInput.trim()}
                        className="w-full rounded-xl bg-accent-500 text-neutral-950 py-3 text-sm font-medium hover:bg-accent-400 disabled:opacity-40 transition-colors"
                      >
                        Analyze
                      </button>
                    </div>
                  )}

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

                  <div className="space-y-1.5">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">
                      Nutrition{" "}
                      <span className="normal-case tracking-normal text-neutral-600">· tap to adjust</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {MACRO_FIELDS.map(({ key, label }) => (
                        <div key={key} className="rounded-lg bg-neutral-800 p-3 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={Math.round(analysis[key] * servings)}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setMacro(key, Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-transparent text-center text-lg font-bold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <p className="text-xs text-neutral-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {analysis.ingredients && analysis.ingredients.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-neutral-500 uppercase tracking-wide">
                        Ingredients{" "}
                        <span className="normal-case tracking-normal text-neutral-600">· adjust quantity</span>
                      </p>
                      <div className="rounded-xl bg-neutral-800 divide-y divide-neutral-700">
                        {analysis.ingredients.map((ing, i) => {
                          const q = ing.qty ?? 1;
                          return (
                            <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-neutral-200 truncate">{ing.name}</p>
                                <p className="text-xs text-neutral-500 truncate">
                                  {ing.amount}
                                  {q !== 1 ? ` ×${q}` : ""} · {Math.round(ing.calories * q * servings)} kcal
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => adjustIngredientQty(i, -0.5)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 transition-colors"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-sm font-semibold w-7 text-center tabular-nums">{q}</span>
                                <button
                                  onClick={() => adjustIngredientQty(i, 0.5)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 transition-colors"
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  onClick={() => removeIngredient(i)}
                                  className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setMealType(t)}
                        className={cn(
                          "rounded-lg py-2 text-xs capitalize font-medium border transition-colors",
                          mealType === t
                            ? "border-accent-500 bg-accent-500/20 text-accent-300"
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
                      className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-accent-500 text-neutral-950 py-3 text-sm font-medium hover:bg-accent-400 disabled:opacity-50"
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
