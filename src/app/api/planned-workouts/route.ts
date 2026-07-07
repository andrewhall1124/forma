import { NextRequest } from "next/server";
import { db } from "@/db";
import { plannedWorkouts } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { resolveSubjectUserId } from "@/lib/access";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const { subjectUserId } = await resolveSubjectUserId(params.get("athlete"));
  if (!subjectUserId) return Response.json([], { status: 401 });

  const filters = [eq(plannedWorkouts.athleteUserId, subjectUserId)];
  const start = params.get("start");
  const end = params.get("end");
  if (start) filters.push(gte(plannedWorkouts.date, start));
  if (end) filters.push(lte(plannedWorkouts.date, end));

  const rows = await db
    .select()
    .from(plannedWorkouts)
    .where(and(...filters))
    .orderBy(asc(plannedWorkouts.date), asc(plannedWorkouts.id));
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, subjectUserId } = await resolveSubjectUserId(body.athleteUserId ?? null);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!subjectUserId) return Response.json({ error: "Not your athlete" }, { status: 403 });

  const [row] = await db
    .insert(plannedWorkouts)
    .values({
      athleteUserId: subjectUserId,
      // Self-planned workouts have no coach.
      coachUserId: subjectUserId === userId ? null : userId,
      date: body.date,
      activityType: body.activityType ?? null,
      title: body.title,
      description: body.description ?? null,
      durationSeconds: body.durationSeconds ?? null,
      distanceMeters: body.distanceMeters ?? null,
    })
    .returning();
  return Response.json(row, { status: 201 });
}
