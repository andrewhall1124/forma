import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workoutTemplates } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/workout-templates/[id]">,
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await db
    .delete(workoutTemplates)
    .where(
      and(eq(workoutTemplates.id, parseInt(id)), eq(workoutTemplates.ownerUserId, userId)),
    );
  return new Response(null, { status: 204 });
}
