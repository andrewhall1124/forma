import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ connected: false });

  const [conn] = await db
    .select({ email: garminConnections.email })
    .from(garminConnections)
    .where(eq(garminConnections.userId, userId));

  return Response.json({ connected: !!conn, email: conn?.email ?? null });
}
