import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { coachesAthlete } from "@/lib/access";

// The athlete and any active coach of theirs can modify a plan note.
async function canModify(id: number) {
  const { userId } = await auth();
  if (!userId) return { allowed: false, status: 401, row: null };
  const [row] = await db.select().from(planNotes).where(eq(planNotes.id, id)).limit(1);
  if (!row) return { allowed: false, status: 404, row: null };
  const allowed =
    row.athleteUserId === userId || (await coachesAthlete(userId, row.athleteUserId));
  return { allowed, status: allowed ? 200 : 403, row };
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/plan-notes/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  const body = await req.json();
  const updates: Partial<typeof planNotes.$inferInsert> = {};
  if (typeof body.body === "string") {
    if (!body.body.trim()) return Response.json({ error: "body required" }, { status: 400 });
    updates.body = body.body.trim();
  }
  if (typeof body.title === "string") updates.title = body.title.trim() || null;
  if (typeof body.date === "string") updates.date = body.date;

  const [updated] = await db
    .update(planNotes)
    .set(updates)
    .where(eq(planNotes.id, id))
    .returning();
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/plan-notes/[id]">) {
  const id = Number((await ctx.params).id);
  const { allowed, status } = await canModify(id);
  if (!allowed) return Response.json({ error: "Not allowed" }, { status });

  await db.delete(planNotes).where(eq(planNotes.id, id));
  return new Response(null, { status: 204 });
}
