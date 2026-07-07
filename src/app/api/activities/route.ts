import { NextRequest } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const type = req.nextUrl.searchParams.get("type");

  const where = type
    ? and(eq(activities.userId, userId), eq(activities.activityType, type))
    : eq(activities.userId, userId);

  const rows = await db
    .select()
    .from(activities)
    .where(where)
    .orderBy(desc(activities.date))
    .limit(limit);
  return Response.json(rows);
}
