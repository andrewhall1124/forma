"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, relativeDayLabel } from "@/lib/date";
import { cn } from "@/lib/cn";

// Prev/next day stepper with a relative label. `today` caps forward paging so
// the user can browse history but not the future. Tapping the label jumps back
// to today when viewing a past day.
export function DateNav({
  value,
  today,
  onChange,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const atToday = value >= today;
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onChange(addDays(value, -1))}
        className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => onChange(today)}
        disabled={atToday}
        className={cn(
          "text-sm font-medium transition-colors",
          atToday ? "text-neutral-300" : "hover:text-accent-400",
        )}
      >
        {relativeDayLabel(value, today)}
      </button>
      <button
        onClick={() => onChange(addDays(value, 1))}
        disabled={atToday}
        className="rounded-lg border border-neutral-800 p-2 hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next day"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
