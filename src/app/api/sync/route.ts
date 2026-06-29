import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const syncUrl = process.env.GARMIN_SYNC_URL;
  if (!syncUrl) {
    return Response.json({ error: "GARMIN_SYNC_URL not configured" }, { status: 503 });
  }

  const [conn] = await db
    .select()
    .from(garminConnections)
    .where(eq(garminConnections.userId, userId));

  if (!conn) {
    return Response.json({ error: "Garmin not connected" }, { status: 400 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const res = await fetch(`${syncUrl}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: conn.email, password: conn.password, userId, days }),
    signal: AbortSignal.timeout(120_000),
  });

  const body = await res.json();
  return Response.json(body, { status: res.status });
}
