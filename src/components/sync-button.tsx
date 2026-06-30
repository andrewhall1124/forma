"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

export default function SyncButton() {
  const router = useRouter();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/garmin/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  if (!connected) return null;

  async function handleSync() {
    if (state === "syncing") return;
    setState("syncing");
    setMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
        setMessage(`Synced ${data.runs ?? 0} runs · ${data.sleep ?? 0} nights`);
        // Refresh client data pages (Runs, Sleep) and server components (dashboard)
        // so freshly synced data appears without a manual reload.
        window.dispatchEvent(new CustomEvent("forma:synced", { detail: data }));
        router.refresh();
      } else {
        setState("error");
        setMessage(data.error ?? "Sync failed");
      }
    } catch {
      setState("error");
      setMessage("Sync failed. Check your connection.");
    } finally {
      setTimeout(() => {
        setState("idle");
        setMessage(null);
      }, 4000);
    }
  }

  return (
    <>
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
        <RefreshCw size={16} className={cn(state === "syncing" && "animate-spin")} />
      </button>

      {message && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-4 z-50 rounded-full px-4 py-2 text-xs font-medium shadow-lg",
            state === "error"
              ? "bg-red-950 text-red-300 border border-red-900"
              : "bg-neutral-800 text-neutral-100 border border-neutral-700"
          )}
        >
          {message}
        </div>
      )}
    </>
  );
}
