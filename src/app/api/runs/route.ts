import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const rows = await db
    .select()
    .from(runs)
    .where(eq(runs.userId, userId))
    .orderBy(desc(runs.date))
    .limit(limit);
  return Response.json(rows);
}
