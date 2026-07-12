import { NextRequest } from "next/server";
import { db } from "@/db";
import { bodyComposition } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET(req: NextRequest) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "90");
  const rows = await db
    .select()
    .from(bodyComposition)
    .where(eq(bodyComposition.userId, userId))
    .orderBy(desc(bodyComposition.date))
    .limit(limit)
    // The table is populated by the first Garmin sync; return an empty
    // history instead of a 500 until then.
    .catch(() => []);
  return Response.json(rows);
}
