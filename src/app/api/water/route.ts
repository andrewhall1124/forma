import { NextRequest } from "next/server";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const rows = await db
      .select()
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)))
      .orderBy(desc(waterLogs.loggedAt));
    return Response.json(rows);
  }
  const rows = await db
    .select()
    .from(waterLogs)
    .where(eq(waterLogs.userId, userId))
    .orderBy(desc(waterLogs.loggedAt))
    .limit(50);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const body = await req.json();
  const [row] = await db.insert(waterLogs).values({ ...body, userId }).returning();
  return Response.json(row, { status: 201 });
}
