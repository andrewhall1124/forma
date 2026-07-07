import { NextRequest } from "next/server";
import { db } from "@/db";
import { activities, plannedWorkouts } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

// Returns the planned workouts in the window plus the athlete's synced
// activities for the same dates, so the client can show planned-vs-actual
// and suggest links without a second request.
export async function GET(req: NextRequest) {
  const { subjectUserId } = await resolveViewer();
  if (!subjectUserId) {
    return Response.json({ workouts: [], activities: [] }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const filters = [eq(plannedWorkouts.athleteUserId, subjectUserId)];
  const start = params.get("start");
  const end = params.get("end");
  if (start) filters.push(gte(plannedWorkouts.date, start));
  if (end) filters.push(lte(plannedWorkouts.date, end));

  const [workouts, acts] = await Promise.all([
    db
      .select()
      .from(plannedWorkouts)
      .where(and(...filters))
      .orderBy(asc(plannedWorkouts.date), asc(plannedWorkouts.id)),
    start && end
      ? db
          .select({
            id: activities.id,
            date: activities.date,
            activityType: activities.activityType,
            name: activities.name,
            distanceMeters: activities.distanceMeters,
            durationSeconds: activities.durationSeconds,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, subjectUserId),
              gte(activities.date, start),
              lte(activities.date, end),
            ),
          )
          .orderBy(asc(activities.date))
      : Promise.resolve([]),
  ]);

  return Response.json({ workouts, activities: acts });
}

export async function POST(req: NextRequest) {
  const { userId, subjectUserId, coachView } = await resolveViewer();
  if (!userId || !subjectUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const [row] = await db
    .insert(plannedWorkouts)
    .values({
      athleteUserId: subjectUserId,
      // Self-planned workouts have no coach.
      coachUserId: coachView ? userId : null,
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
