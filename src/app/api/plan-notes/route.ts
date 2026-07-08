import { NextRequest } from "next/server";
import { db } from "@/db";
import { planNotes } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

// Day notes for the athlete in an optional [start, end] date window, so the
// plan can load a whole month in one request.
export async function GET(req: NextRequest) {
  const { subjectUserId } = await resolveViewer();
  if (!subjectUserId) return Response.json([], { status: 401 });

  const params = req.nextUrl.searchParams;
  const filters = [eq(planNotes.athleteUserId, subjectUserId)];
  const start = params.get("start");
  const end = params.get("end");
  if (start) filters.push(gte(planNotes.date, start));
  if (end) filters.push(lte(planNotes.date, end));

  const rows = await db
    .select()
    .from(planNotes)
    .where(and(...filters))
    .orderBy(asc(planNotes.date), asc(planNotes.id));
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId, subjectUserId, coachView } = await resolveViewer();
  if (!userId || !subjectUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.date || !body.body?.trim()) {
    return Response.json({ error: "date and body required" }, { status: 400 });
  }
  const [row] = await db
    .insert(planNotes)
    .values({
      athleteUserId: subjectUserId,
      coachUserId: coachView ? userId : null,
      date: body.date,
      body: body.body.trim(),
    })
    .returning();
  return Response.json(row, { status: 201 });
}
