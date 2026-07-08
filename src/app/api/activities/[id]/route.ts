import { NextRequest } from "next/server";
import { db } from "@/db";
import { activities, activityLaps, activityDetails } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

// Edit user-authored fields on an activity (currently just notes). Only the
// owner can write; coaches viewing an athlete are read-only here.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  const { userId, subjectUserId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const [updated] = await db
    .update(activities)
    .set({ notes })
    .where(and(eq(activities.id, parseInt(id)), eq(activities.userId, subjectUserId!)))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, parseInt(id)), eq(activities.userId, userId)));

  if (!activity) return Response.json({ error: "Not found" }, { status: 404 });

  const laps = activity.garminActivityId
    ? await db
        .select()
        .from(activityLaps)
        .where(
          and(
            eq(activityLaps.garminActivityId, activity.garminActivityId),
            eq(activityLaps.userId, userId),
          ),
        )
        .orderBy(asc(activityLaps.lapIndex))
    : [];

  const [details] = activity.garminActivityId
    ? await db
        .select()
        .from(activityDetails)
        .where(eq(activityDetails.garminActivityId, activity.garminActivityId))
    : [];

  return Response.json({ activity, laps, details: details ?? null });
}
