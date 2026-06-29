import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password } = await req.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }

  await db
    .insert(garminConnections)
    .values({ userId, email, password })
    .onConflictDoUpdate({
      target: garminConnections.userId,
      set: { email, password },
    });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(garminConnections).where(eq(garminConnections.userId, userId));
  return Response.json({ ok: true });
}
