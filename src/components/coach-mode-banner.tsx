"use client";

import { Eye, X } from "lucide-react";
import { useCoachMode, exitCoachMode } from "@/lib/athlete-mode";

export default function CoachModeBanner() {
  const mode = useCoachMode();
  if (!mode) return null;
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-accent-500 text-neutral-950 px-4 py-2">
      <span className="flex items-center gap-2 min-w-0 text-sm font-medium">
        <Eye size={14} className="shrink-0" />
        <span className="truncate">Coaching {mode.athleteName} — viewing their data</span>
      </span>
      <button
        onClick={exitCoachMode}
        className="flex items-center gap-1 shrink-0 rounded-full bg-neutral-950/15 px-3 py-1 text-xs font-semibold hover:bg-neutral-950/25 transition-colors"
      >
        <X size={12} /> Exit
      </button>
    </div>
  );
}
