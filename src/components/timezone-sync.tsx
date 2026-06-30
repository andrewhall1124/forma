"use client";

import { useEffect } from "react";

// Reports the browser's current time zone to the server via a cookie so server
// components (e.g. the dashboard) can render the user's local calendar day.
// Updates automatically if the user travels to a new zone.
export default function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && !document.cookie.split("; ").includes(`tz=${tz}`)) {
      document.cookie = `tz=${tz}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
