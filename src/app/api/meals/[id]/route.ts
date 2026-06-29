import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { meals } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/meals/[id]">) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await db.delete(meals).where(and(eq(meals.id, parseInt(id)), eq(meals.userId, userId)));
  return new Response(null, { status: 204 });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/meals/[id]">) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const [row] = await db
    .update(meals)
    .set(body)
    .where(and(eq(meals.id, parseInt(id)), eq(meals.userId, userId)))
    .returning();
  return Response.json(row);
}
