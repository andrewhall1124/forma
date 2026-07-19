import { NextRequest } from "next/server";
import { db } from "@/db";
import { catalogMeals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/meal-catalog/[id]">) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const { id } = await ctx.params;
  await db
    .delete(catalogMeals)
    .where(and(eq(catalogMeals.id, parseInt(id)), eq(catalogMeals.userId, userId)));
  return new Response(null, { status: 204 });
}
