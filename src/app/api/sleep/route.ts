import { NextRequest } from "next/server";
import { db } from "@/db";
import { sleepLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "14");
  const rows = await db
    .select()
    .from(sleepLogs)
    .where(eq(sleepLogs.userId, userId))
    .orderBy(desc(sleepLogs.date))
    .limit(limit);
  return Response.json(rows);
}
