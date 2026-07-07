import { NextRequest } from "next/server";
import { db } from "@/db";
import { meals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/meals/[id]">) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const { id } = await ctx.params;
  await db.delete(meals).where(and(eq(meals.id, parseInt(id)), eq(meals.userId, userId)));
  return new Response(null, { status: 204 });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/meals/[id]">) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const [row] = await db
    .update(meals)
    .set(body)
    .where(and(eq(meals.id, parseInt(id)), eq(meals.userId, userId)))
    .returning();
  return Response.json(row);
}
