"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Unlink, RefreshCw } from "lucide-react";
import CoachingSettings from "@/components/coaching-settings";
import MacroGoalsSettings from "@/components/macro-goals-settings";

type GarminStatus = { connected: boolean; email: string | null };

export default function SettingsPage() {
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/garmin/status");
    setStatus(await res.json());
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error();
      await loadStatus();
      setEmail("");
      setPassword("");
    } catch {
      setError("Failed to save credentials. Check your email and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    await fetch("/api/garmin/connect", { method: "DELETE" });
    await loadStatus();
    setSaving(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `Synced — ${data.activities ?? 0} activities, ${data.sleep ?? 0} sleep nights, ${data.body ?? 0} weigh-ins`,
        );
      } else {
        setSyncResult(`Error: ${data.error ?? "Sync failed"}`);
      }
    } catch {
      setSyncResult("Sync failed. Check your connection.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex-1 p-4 space-y-6 max-w-md">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage your integrations</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">Garmin Connect</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {status === null
                ? "Loading…"
                : status.connected
                ? `Connected as ${status.email}`
                : "Not connected"}
            </p>
          </div>
          {status?.connected && (
            <span className="flex items-center gap-1 text-xs text-green-400 mt-0.5">
              <Check size={12} /> Connected
            </span>
          )}
        </div>

        {status?.connected ? (
          <div className="space-y-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 w-full justify-center rounded-lg border border-neutral-700 py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            {syncResult && (
              <p className="text-xs text-center text-neutral-400">{syncResult}</p>
            )}
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              <Unlink size={12} />
              Disconnect Garmin
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400">Garmin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder-neutral-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Garmin Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-neutral-950 py-2.5 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Connect Garmin
            </button>
          </form>
        )}
      </div>

      <MacroGoalsSettings />

      <CoachingSettings />
    </div>
  );
}
