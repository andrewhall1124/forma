import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
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
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const [row] = await db.insert(waterLogs).values({ ...body, userId }).returning();
  return Response.json(row, { status: 201 });
}
