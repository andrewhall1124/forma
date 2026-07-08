import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { races } from "@/db/schema";
import { eq } from "drizzle-orm";
import { coachesAthlete } from "@/lib/access";

// The athlete and any active coach of theirs can modify a race.
async function canModify(id: number) {
  const { userId } = await auth();
  if (!userId) return { allowed: false, status: 401, row: null };
  const [row] = await db.select().from(races).where(eq(races.id, id)).limit(1);
  if (!row) return { allowed: false, status: 404, row: null };
  const allowed =
    row.athleteUserId === userId || (await coachesAthlete(userId, row.athleteUserId));
  return { allowed, status: allowed ? 200 : 403, row };
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/races/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  const body = await req.json();
  const updates: Partial<typeof races.$inferInsert> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return Response.json({ error: "name required" }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (typeof body.date === "string") updates.date = body.date;

  const [updated] = await db.update(races).set(updates).where(eq(races.id, id)).returning();
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/races/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  await db.delete(races).where(eq(races.id, id));
  return new Response(null, { status: 204 });
}
