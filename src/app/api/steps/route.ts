import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { dailySummaries } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "30");
  const rows = await db
    .select()
    .from(dailySummaries)
    .where(eq(dailySummaries.userId, userId))
    .orderBy(desc(dailySummaries.date))
    .limit(limit)
    // The table is created by the first Garmin sync; return an empty
    // history instead of a 500 until then.
    .catch(() => []);
  return Response.json(rows);
}
