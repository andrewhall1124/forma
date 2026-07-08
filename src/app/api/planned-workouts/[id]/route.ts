import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { activities, plannedWorkouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { coachesAthlete } from "@/lib/access";

// The athlete and any active coach of theirs can modify a planned workout.
async function canModify(id: number) {
  const { userId } = await auth();
  if (!userId) return { allowed: false, status: 401, row: null };
  const [row] = await db
    .select()
    .from(plannedWorkouts)
    .where(eq(plannedWorkouts.id, id))
    .limit(1);
  if (!row) return { allowed: false, status: 404, row: null };
  const allowed =
    row.athleteUserId === userId || (await coachesAthlete(userId, row.athleteUserId));
  return { allowed, status: allowed ? 200 : 403, row };
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/planned-workouts/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status, row } = await canModify(id);
  if (!allowed || !row) return Response.json({ error: "Not allowed" }, { status });

  const body = await req.json();
  const updates: Partial<typeof plannedWorkouts.$inferInsert> = {};
  for (const key of [
    "date",
    "activityType",
    "title",
    "description",
    "durationSeconds",
    "distanceMeters",
    "status",
    "skipReason",
    "linkedActivityId",
  ] as const) {
    if (key in body) updates[key] = body[key];
  }

  // A link must point at one of the athlete's own activities.
  if (updates.linkedActivityId != null) {
    const [act] = await db
      .select({ userId: activities.userId })
      .from(activities)
      .where(eq(activities.id, Number(updates.linkedActivityId)))
      .limit(1);
    if (!act || act.userId !== row.athleteUserId) {
      return Response.json({ error: "Activity not found for this athlete" }, { status: 400 });
    }
  }
  const [updated] = await db
    .update(plannedWorkouts)
    .set(updates)
    .where(eq(plannedWorkouts.id, id))
    .returning();
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/planned-workouts/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, id));
  return new Response(null, { status: 204 });
}
