import { NextRequest } from "next/server";
import { db } from "@/db";
import { bodyComposition } from "@/db/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  // Filter by a day window rather than a row count: with several weigh-ins per
  // day a count limit would silently shrink the visible date range.
  const days = Number(req.nextUrl.searchParams.get("days") ?? "90");
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(bodyComposition)
    .where(and(eq(bodyComposition.userId, userId), gte(bodyComposition.date, start)))
    // Newest weigh-in first, so records[0] is the latest reading of the day.
    .orderBy(desc(bodyComposition.measuredAt), desc(bodyComposition.date))
    // The table is populated by the first Garmin sync; return an empty
    // history instead of a 500 until then.
    .catch(() => []);
  return Response.json(rows);
}
