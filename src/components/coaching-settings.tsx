"use client";

import { useState, useEffect } from "react";
import { Copy, Loader2, UserMinus, X } from "lucide-react";

type Link = {
  id: number;
  athleteUserId: string;
  coachUserId: string | null;
  inviteCode: string | null;
  status: "pending" | "active";
  athleteName: string | null;
  coachName: string | null;
};

export default function CoachingSettings() {
  const [asAthlete, setAsAthlete] = useState<Link[]>([]);
  const [asCoach, setAsCoach] = useState<Link[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/coach/links");
    if (res.ok) {
      const data = await res.json();
      setAsAthlete(data.asAthlete ?? []);
      setAsCoach(data.asCoach ?? []);
    }
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    try {
      await fetch("/api/coach/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRedeemError(null);
    try {
      const res = await fetch("/api/coach/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code }),
      });
      if (!res.ok) {
        const data = await res.json();
        setRedeemError(data.error ?? "Failed to redeem code");
        return;
      }
      setCode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    await fetch(`/api/coach/links?id=${id}`, { method: "DELETE" });
    await load();
  }

  function copyCode(link: Link) {
    if (!link.inviteCode) return;
    navigator.clipboard.writeText(link.inviteCode);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const coaches = asAthlete.filter((l) => l.status === "active");
  const pendingCodes = asAthlete.filter((l) => l.status === "pending");

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-4">
      <div>
        <p className="font-medium text-sm">Coaching</p>
        <p className="text-xs text-neutral-400 mt-0.5">
          Share an invite code so a coach can plan workouts and see your data
        </p>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-2 text-neutral-500">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        <>
          {coaches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Your coaches</p>
              {coaches.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span>{l.coachName ?? "Coach"}</span>
                  <button
                    onClick={() => revoke(l.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <UserMinus size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {asCoach.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Your athletes</p>
              {asCoach.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span>{l.athleteName ?? "Athlete"}</span>
                  <button
                    onClick={() => revoke(l.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <UserMinus size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingCodes.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2"
            >
              <span className="font-mono text-sm tracking-widest">{l.inviteCode}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyCode(l)}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <Copy size={12} /> {copiedId === l.id ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => revoke(l.id)}
                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                  aria-label="Cancel invite"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={generate}
            disabled={busy}
            className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            Generate invite code
          </button>

          <form onSubmit={redeem} className="space-y-2">
            <label className="text-xs text-neutral-400">Coaching someone? Enter their code</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-mono tracking-widest outline-none focus:border-neutral-500 placeholder-neutral-600"
              />
              <button
                type="submit"
                disabled={busy || code.trim().length === 0}
                className="rounded-lg bg-accent-500 text-neutral-950 px-4 text-sm font-medium hover:bg-accent-400 disabled:opacity-50 transition-colors"
              >
                Link
              </button>
            </div>
            {redeemError && <p className="text-xs text-red-400">{redeemError}</p>}
          </form>
        </>
      )}
    </div>
  );
}
