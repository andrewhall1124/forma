import { NextRequest } from "next/server";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const rows = await db
      .select()
      .from(waterLogs)
      .where(eq(waterLogs.date, date))
      .orderBy(desc(waterLogs.loggedAt));
    return Response.json(rows);
  }
  const rows = await db.select().from(waterLogs).orderBy(desc(waterLogs.loggedAt)).limit(50);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [row] = await db.insert(waterLogs).values(body).returning();
  return Response.json(row, { status: 201 });
}
