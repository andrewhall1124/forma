import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { coachLinks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ATHLETE_COOKIE } from "@/lib/athlete-cookie";

// Resolves whose data this request is for. When the caller is in coach mode
// (athlete cookie set to a linked athlete), reads target that athlete's data;
// a stale or unlinked cookie silently falls back to the caller's own data.
// Mutating endpoints should reject when coachView is true unless they
// explicitly support coach edits (planned workouts do).
export async function resolveViewer(): Promise<{
  userId: string | null;
  subjectUserId: string | null;
  coachView: boolean;
}> {
  const { userId } = await auth();
  if (!userId) return { userId: null, subjectUserId: null, coachView: false };

  const athlete = (await cookies()).get(ATHLETE_COOKIE)?.value;
  if (!athlete || athlete === userId) {
    return { userId, subjectUserId: userId, coachView: false };
  }
  const linked = await coachesAthlete(userId, athlete);
  return linked
    ? { userId, subjectUserId: athlete, coachView: true }
    : { userId, subjectUserId: userId, coachView: false };
}

export async function coachesAthlete(coachUserId: string, athleteUserId: string) {
  const [link] = await db
    .select({ id: coachLinks.id })
    .from(coachLinks)
    .where(
      and(
        eq(coachLinks.coachUserId, coachUserId),
        eq(coachLinks.athleteUserId, athleteUserId),
        eq(coachLinks.status, "active"),
      ),
    )
    .limit(1);
  return !!link;
}
