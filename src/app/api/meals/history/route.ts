import { NextRequest } from "next/server";
import { db } from "@/db";
import { meals } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

// Daily nutrition totals (serving-scaled) from `start` (YYYY-MM-DD, the
// user's local date) onward.
export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const start = req.nextUrl.searchParams.get("start");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return Response.json({ error: "start (YYYY-MM-DD) required" }, { status: 400 });
  }

  const rows = await db
    .select({
      date: meals.date,
      calories: sql<number>`sum(coalesce(${meals.calories}, 0) * coalesce(${meals.servings}, 1))`.mapWith(Number),
      proteinG: sql<number>`sum(coalesce(${meals.proteinG}, 0) * coalesce(${meals.servings}, 1))`.mapWith(Number),
      carbsG: sql<number>`sum(coalesce(${meals.carbsG}, 0) * coalesce(${meals.servings}, 1))`.mapWith(Number),
      fatG: sql<number>`sum(coalesce(${meals.fatG}, 0) * coalesce(${meals.servings}, 1))`.mapWith(Number),
    })
    .from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.date, start)))
    .groupBy(meals.date)
    .orderBy(meals.date);
  return Response.json(rows);
}
