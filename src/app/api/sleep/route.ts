import { NextRequest } from "next/server";
import { db } from "@/db";
import { sleepLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "14");
  const rows = await db.select().from(sleepLogs).orderBy(desc(sleepLogs.date)).limit(limit);
  return Response.json(rows);
}
