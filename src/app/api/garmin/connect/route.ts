import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { garminConnections, runs, sleepLogs, meals, waterLogs, bodyComposition } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";

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

  // Claim any existing unclaimed rows (e.g. historical Garmin imports before userId was added)
  await Promise.all([
    db.update(runs).set({ userId }).where(isNull(runs.userId)),
    db.update(sleepLogs).set({ userId }).where(isNull(sleepLogs.userId)),
    db.update(meals).set({ userId }).where(isNull(meals.userId)),
    db.update(waterLogs).set({ userId }).where(isNull(waterLogs.userId)),
    db.update(bodyComposition).set({ userId }).where(isNull(bodyComposition.userId)),
  ]);

  return Response.json({ ok: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(garminConnections).where(eq(garminConnections.userId, userId));
  return Response.json({ ok: true });
}
