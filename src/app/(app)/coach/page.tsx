"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Users } from "lucide-react";
import { enterCoachMode, useCoachMode } from "@/lib/athlete-mode";

type CoachLink = {
  id: number;
  athleteUserId: string;
  athleteName: string | null;
};

export default function CoachPage() {
  const [athletes, setAthletes] = useState<CoachLink[] | null>(null);
  const mode = useCoachMode();

  useEffect(() => {
    fetch("/api/coach/links")
      .then((res) => res.json())
      .then((data) => setAthletes(data.asCoach ?? []))
      .catch(() => setAthletes([]));
  }, []);

  return (
    <div className="flex-1 p-4 space-y-4 max-w-md">
      <div>
        <h1 className="text-xl font-bold">Coach</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Choose an athlete to view their data and manage their plan
        </p>
      </div>

      {athletes === null ? (
        <div className="flex justify-center py-12 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center space-y-2">
          <Users size={24} className="mx-auto text-neutral-600" />
          <p className="text-sm font-medium">No athletes yet</p>
          <p className="text-xs text-neutral-400">
            Ask your athlete to generate an invite code under Settings → Coaching, then redeem
            it in your own{" "}
            <Link href="/settings" className="text-accent-400 hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {athletes.map((a) => {
            const active = mode?.athleteId === a.athleteUserId;
            return (
              <button
                key={a.athleteUserId}
                onClick={() => enterCoachMode(a.athleteUserId, a.athleteName ?? "Athlete")}
                className="w-full flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3.5 hover:border-neutral-700 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{a.athleteName ?? "Athlete"}</p>
                  {active && <p className="text-xs text-accent-400 mt-0.5">Currently viewing</p>}
                </div>
                <ChevronRight size={16} className="text-neutral-500" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
