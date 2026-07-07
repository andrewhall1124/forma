import { NextRequest } from "next/server";
import { db } from "@/db";
import { activities, activityLaps, activityDetails } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

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
