import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { nutritionGoals } from "@/db/schema";
import { resolveViewer } from "@/lib/access";
import { DEFAULT_MACRO_GOALS, MACRO_GOAL_KEYS, type MacroGoals } from "@/lib/macro-goals";
import { getMacroGoals } from "@/lib/macro-goals.server";

// The viewed user's daily nutrition targets (own goals, or the athlete's when
// a coach is viewing). Unauthenticated callers get the defaults so the UI can
// still render something sane.
export async function GET() {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json(DEFAULT_MACRO_GOALS, { status: 401 });
  return Response.json(await getMacroGoals(userId));
}

// Upsert the caller's own goals. Coaches can't edit an athlete's targets.
export async function PUT(req: NextRequest) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const values = {} as MacroGoals;
  for (const key of MACRO_GOAL_KEYS) {
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      return Response.json({ error: `Invalid ${key}` }, { status: 400 });
    }
    values[key] = Math.round(n);
  }

  const [row] = await db
    .insert(nutritionGoals)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: nutritionGoals.userId,
      set: { ...values, updatedAt: sql`now()` },
    })
    .returning();
  return Response.json(row);
}
