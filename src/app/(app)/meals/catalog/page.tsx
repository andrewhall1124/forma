"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Check, Trash2, BookOpen } from "lucide-react";
import { localDateStr, relativeDayLabel } from "@/lib/date";

type Ingredient = {
  name: string;
  amount: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type Meal = {
  id: number;
  mealType: string | null;
  name: string;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  ingredients: Ingredient[] | null;
  note?: string | null;
};

export default function CatalogPage() {
  const today = localDateStr();
  const [catalog, setCatalog] = useState<Meal[]>([]);
  const [history, setHistory] = useState<Meal[]>([]);
  const [mode, setMode] = useState<"catalog" | "add">("catalog");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  // The day meals are added to — passed from the meals page via ?date=.
  const [date, setDate] = useState(today);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d) setDate(d);
  }, []);

  useEffect(() => {
    (async () => {
      const [cRes, hRes] = await Promise.all([
        fetch("/api/meal-catalog"),
        fetch("/api/meals?catalog=1"),
      ]);
      setCatalog(cRes.ok ? await cRes.json() : []);
      setHistory(hRes.ok ? await hRes.json() : []);
      setLoading(false);
    })();
  }, []);

  const dayLabel = relativeDayLabel(date, today);
  const catalogNames = new Set(catalog.map((m) => m.name));

  const source = mode === "catalog" ? catalog : history;
  const filtered = source.filter((m) =>
    m.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Log a catalog meal to the current day.
  async function addToDay(meal: Meal) {
    setAddedNames((prev) => new Set(prev).add(meal.name));
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        mealType: meal.mealType,
        name: meal.name,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        fiberG: meal.fiberG,
        servings: 1,
        ingredients: meal.ingredients?.length ? meal.ingredients : null,
        note: meal.note ?? null,
      }),
    });
  }

  // Save a previously-logged meal into the catalog.
  async function addToCatalog(meal: Meal) {
    if (catalogNames.has(meal.name)) return;
    const res = await fetch("/api/meal-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealType: meal.mealType,
        name: meal.name,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        fiberG: meal.fiberG,
        ingredients: meal.ingredients?.length ? meal.ingredients : null,
        note: meal.note ?? null,
      }),
    });
    if (res.ok) {
      const saved: Meal = await res.json();
      setCatalog((prev) => [saved, ...prev.filter((m) => m.name !== saved.name)]);
    }
  }

  async function removeFromCatalog(meal: Meal) {
    setCatalog((prev) => prev.filter((m) => m.id !== meal.id));
    await fetch(`/api/meal-catalog/${meal.id}`, { method: "DELETE" });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/meals?date=${date}`}
          className="flex items-center justify-center w-9 h-9 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Meal Catalog</h1>
          <p className="text-xs text-neutral-400">Adding to {dayLabel}</p>
        </div>
      </div>

      {/* Browse the curated catalog, or add previously-logged meals to it. */}
      <div className="flex gap-2 rounded-xl bg-neutral-900 border border-neutral-800 p-1">
        <button
          onClick={() => { setMode("catalog"); setQuery(""); }}
          className={
            "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors " +
            (mode === "catalog" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200")
          }
        >
          <BookOpen size={15} /> Catalog
        </button>
        <button
          onClick={() => { setMode("add"); setQuery(""); }}
          className={
            "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors " +
            (mode === "add" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200")
          }
        >
          <Plus size={15} /> Add from history
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "catalog" ? "Search catalog…" : "Search your logged meals…"}
          className="w-full rounded-xl bg-neutral-900 border border-neutral-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
        />
      </div>

      {loading ? (
        <p className="text-center text-neutral-500 text-sm py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center text-neutral-500 text-sm py-12 space-y-3">
          {mode === "catalog" ? (
            query ? (
              <p>No catalog meals match your search</p>
            ) : (
              <>
                <p>Your catalog is empty.</p>
                <button
                  onClick={() => setMode("add")}
                  className="inline-flex items-center gap-2 rounded-full bg-accent-500 text-neutral-950 px-4 py-2 text-xs font-medium hover:bg-accent-400"
                >
                  <Plus size={14} /> Add from history
                </button>
              </>
            )
          ) : (
            <p>{history.length === 0 ? "No meals logged yet" : "No meals match your search"}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((meal) => {
            const inCatalog = catalogNames.has(meal.name);
            return (
              <div
                key={meal.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{meal.name}</p>
                  <div className="flex gap-3 text-xs text-neutral-400 mt-1">
                    <span className="text-neutral-200 font-semibold">
                      {meal.calories != null ? `${Math.round(meal.calories)} kcal` : "—"}
                    </span>
                    {meal.proteinG != null && <span>P {Math.round(meal.proteinG)}g</span>}
                    {meal.carbsG != null && <span>C {Math.round(meal.carbsG)}g</span>}
                    {meal.fatG != null && <span>F {Math.round(meal.fatG)}g</span>}
                  </div>
                </div>

                {mode === "catalog" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => addToDay(meal)}
                      disabled={addedNames.has(meal.name)}
                      className={
                        addedNames.has(meal.name)
                          ? "flex items-center gap-1.5 rounded-full bg-green-600/20 text-green-400 px-3 py-2 text-xs font-medium"
                          : "flex items-center gap-1.5 rounded-full bg-accent-500 text-neutral-950 px-3 py-2 text-xs font-medium hover:bg-accent-400 active:bg-accent-600"
                      }
                    >
                      {addedNames.has(meal.name) ? <><Check size={14} /> Added</> : <><Plus size={14} /> {dayLabel}</>}
                    </button>
                    <button
                      onClick={() => removeFromCatalog(meal)}
                      className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                      aria-label="Remove from catalog"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCatalog(meal)}
                    disabled={inCatalog}
                    className={
                      inCatalog
                        ? "flex items-center gap-1.5 rounded-full bg-green-600/20 text-green-400 px-3 py-2 text-xs font-medium shrink-0"
                        : "flex items-center gap-1.5 rounded-full bg-accent-500 text-neutral-950 px-3 py-2 text-xs font-medium hover:bg-accent-400 active:bg-accent-600 shrink-0"
                    }
                  >
                    {inCatalog ? <><Check size={14} /> In catalog</> : <><Plus size={14} /> Add</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
