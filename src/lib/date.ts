// A "day" in Forma is the user's local calendar day, not UTC. Using
// toISOString() would bucket logs by the UTC date, which rolls over hours
// early/late depending on the user's offset (e.g. 5pm PST is already the next
// UTC day).
//
// en-CA formats dates as YYYY-MM-DD. With no `timeZone`, Intl uses the
// runtime's local zone — in the browser that's the user's current zone, which
// is exactly what we want for client components.

// Fallback used for server rendering before the client has reported its zone
// via the `tz` cookie (see components/timezone-sync.tsx).
export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function localDateStr(timeZone?: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
