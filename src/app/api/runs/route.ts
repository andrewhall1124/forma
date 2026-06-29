import { NextRequest } from "next/server";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const rows = await db.select().from(runs).orderBy(desc(runs.date)).limit(limit);
  return Response.json(rows);
}
