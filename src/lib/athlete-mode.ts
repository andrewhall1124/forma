"use client";

import { useEffect, useState } from "react";
import { ATHLETE_COOKIE, ATHLETE_NAME_COOKIE as NAME_COOKIE } from "@/lib/athlete-cookie";

// Coach mode: which linked athlete the signed-in user is currently viewing.
// Stored in cookies so client fetches and server components both see it;
// the server validates the link on every request (see lib/access.ts), so
// these cookies are a view preference, not an auth grant.

export type CoachMode = { athleteId: string; athleteName: string };

export function getCoachMode(): CoachMode | null {
  if (typeof document === "undefined") return null;
  const jar = new Map(
    document.cookie
      .split("; ")
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))] as const;
      }),
  );
  const athleteId = jar.get(ATHLETE_COOKIE);
  return athleteId ? { athleteId, athleteName: jar.get(NAME_COOKIE) ?? "Athlete" } : null;
}

// Full navigations (not router.push) so server components re-render with the
// new cookie state.
export function enterCoachMode(athleteId: string, athleteName: string) {
  const opts = "; path=/; max-age=31536000; samesite=lax";
  document.cookie = `${ATHLETE_COOKIE}=${encodeURIComponent(athleteId)}${opts}`;
  document.cookie = `${NAME_COOKIE}=${encodeURIComponent(athleteName)}${opts}`;
  window.location.href = "/";
}

export function exitCoachMode() {
  document.cookie = `${ATHLETE_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${NAME_COOKIE}=; path=/; max-age=0`;
  window.location.href = "/";
}

// Cookie is read in an effect so the server render (which can't see
// document.cookie) matches the first client render.
export function useCoachMode(): CoachMode | null {
  const [mode, setMode] = useState<CoachMode | null>(null);
  useEffect(() => {
    setMode(getCoachMode());
  }, []);
  return mode;
}
