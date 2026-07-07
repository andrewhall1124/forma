import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workoutTemplates } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";

// Templates are personal (keyed to the caller, not the athlete being
// coached), so these use auth() directly rather than resolveViewer().
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });

  const rows = await db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.ownerUserId, userId))
    .orderBy(desc(workoutTemplates.lastUsedAt), asc(workoutTemplates.title));
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const values = {
    ownerUserId: userId,
    activityType: body.activityType ?? null,
    title: body.title,
    description: body.description ?? null,
    durationSeconds: body.durationSeconds ?? null,
    distanceMeters: body.distanceMeters ?? null,
  };
  const [row] = await db
    .insert(workoutTemplates)
    .values(values)
    .onConflictDoUpdate({
      target: [workoutTemplates.ownerUserId, workoutTemplates.title],
      set: {
        activityType: values.activityType,
        description: values.description,
        durationSeconds: values.durationSeconds,
        distanceMeters: values.distanceMeters,
      },
    })
    .returning();
  return Response.json(row, { status: 201 });
}
