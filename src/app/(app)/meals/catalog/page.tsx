"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Check } from "lucide-react";
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

export default function CatalogPage() {
  const today = localDateStr();
  const [meals, setMeals] = useState<Meal[]>([]);
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
      const res = await fetch("/api/meals?catalog=1");
      setMeals(res.ok ? await res.json() : []);
      setLoading(false);
    })();
  }, []);

  const dayLabel = relativeDayLabel(date, today);

  const filtered = meals.filter((m) =>
    m.name.toLowerCase().includes(query.trim().toLowerCase())
  );

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
      }),
    });
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

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meals…"
          className="w-full rounded-xl bg-neutral-900 border border-neutral-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
        />
      </div>

      {loading ? (
        <p className="text-center text-neutral-500 text-sm py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-neutral-500 text-sm py-12">
          {meals.length === 0 ? "No meals logged yet" : "No meals match your search"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((meal) => {
            const added = addedNames.has(meal.name);
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
                <button
                  onClick={() => addToDay(meal)}
                  disabled={added}
                  className={
                    added
                      ? "flex items-center gap-1.5 rounded-full bg-green-600/20 text-green-400 px-3 py-2 text-xs font-medium shrink-0"
                      : "flex items-center gap-1.5 rounded-full bg-accent-500 text-neutral-950 px-3 py-2 text-xs font-medium hover:bg-accent-400 active:bg-accent-600 shrink-0"
                  }
                >
                  {added ? <><Check size={14} /> Added</> : <><Plus size={14} /> {dayLabel}</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
