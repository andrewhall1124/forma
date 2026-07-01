import { Activity, Footprints, Bike, Dumbbell, Waves, type LucideIcon } from "lucide-react";

export const MI = 1609.34;

export const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  run: { label: "Run", icon: Activity },
  walk: { label: "Walk", icon: Footprints },
  ride: { label: "Ride", icon: Bike },
  strength: { label: "Strength", icon: Dumbbell },
  swim: { label: "Swim", icon: Waves },
  other: { label: "Activity", icon: Activity },
};

export function meta(type: string | null) {
  return TYPE_META[type ?? "other"] ?? TYPE_META.other;
}

export function toMiles(meters: number) {
  return meters / MI;
}

export function formatPace(secsPerKm: number) {
  const secsPerMile = Math.round(secsPerKm * 1.60934);
  const mins = Math.floor(secsPerMile / 60);
  const secs = secsPerMile % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
}

export function formatSpeed(meters: number, secs: number) {
  const mph = meters / MI / (secs / 3600);
  return `${mph.toFixed(1)} mph`;
}

export function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Laps are short, so show mm:ss (or h:mm:ss) precision.
export function formatDurationPrecise(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
