"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

export default function SyncButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");

  async function handleSync() {
    if (state === "syncing") return;
    setState("syncing");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <button
      onClick={handleSync}
      title="Sync Garmin data"
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
        state === "idle" && "text-neutral-400 hover:text-white hover:bg-neutral-800",
        state === "syncing" && "text-blue-400",
        state === "done" && "text-green-400",
        state === "error" && "text-red-400"
      )}
    >
      <RefreshCw
        size={16}
        className={cn(state === "syncing" && "animate-spin")}
      />
    </button>
  );
}
