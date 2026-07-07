import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { plannedWorkouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { coachesAthlete } from "@/lib/access";

// The athlete and any active coach of theirs can modify a planned workout.
async function canModify(id: number) {
  const { userId } = await auth();
  if (!userId) return { allowed: false, status: 401 };
  const [row] = await db
    .select()
    .from(plannedWorkouts)
    .where(eq(plannedWorkouts.id, id))
    .limit(1);
  if (!row) return { allowed: false, status: 404 };
  const allowed =
    row.athleteUserId === userId || (await coachesAthlete(userId, row.athleteUserId));
  return { allowed, status: allowed ? 200 : 403 };
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/planned-workouts/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

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
  ] as const) {
    if (key in body) updates[key] = body[key];
  }
  const [row] = await db
    .update(plannedWorkouts)
    .set(updates)
    .where(eq(plannedWorkouts.id, id))
    .returning();
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/planned-workouts/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, id));
  return new Response(null, { status: 204 });
}
