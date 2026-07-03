import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// Daily water totals from `start` (YYYY-MM-DD, the user's local date) onward.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });

  const start = req.nextUrl.searchParams.get("start");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return Response.json({ error: "start (YYYY-MM-DD) required" }, { status: 400 });
  }

  const rows = await db
    .select({
      date: waterLogs.date,
      totalMl: sql<number>`sum(${waterLogs.amountMl})`.mapWith(Number),
    })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), gte(waterLogs.date, start)))
    .groupBy(waterLogs.date)
    .orderBy(waterLogs.date);
  return Response.json(rows);
}
