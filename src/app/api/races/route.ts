import { NextRequest } from "next/server";
import { db } from "@/db";
import { races } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

// Races for the athlete. With no window, returns all (the plan lists upcoming
// races for its countdown); with start/end, only races in that range (calendar
// markers).
export async function GET(req: NextRequest) {
  const { subjectUserId } = await resolveViewer();
  if (!subjectUserId) return Response.json([], { status: 401 });

  const params = req.nextUrl.searchParams;
  const filters = [eq(races.athleteUserId, subjectUserId)];
  const start = params.get("start");
  const end = params.get("end");
  if (start) filters.push(gte(races.date, start));
  if (end) filters.push(lte(races.date, end));

  const rows = await db
    .select()
    .from(races)
    .where(and(...filters))
    .orderBy(asc(races.date), asc(races.id));
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId, subjectUserId, coachView } = await resolveViewer();
  if (!userId || !subjectUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.date || !body.name?.trim()) {
    return Response.json({ error: "date and name required" }, { status: 400 });
  }
  const [row] = await db
    .insert(races)
    .values({
      athleteUserId: subjectUserId,
      coachUserId: coachView ? userId : null,
      date: body.date,
      name: body.name.trim(),
      distanceMeters: body.distanceMeters ?? null,
      notes: body.notes?.trim() || null,
    })
    .returning();
  return Response.json(row, { status: 201 });
}
