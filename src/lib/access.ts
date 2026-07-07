import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { coachLinks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Resolves which user's data a request is for. Coaches pass ?athlete=<id> to
// act on a linked athlete; otherwise the caller acts on their own data.
// Returns subjectUserId null when the caller is unauthenticated or not an
// active coach of the requested athlete.
export async function resolveSubjectUserId(athleteParam: string | null): Promise<{
  userId: string | null;
  subjectUserId: string | null;
}> {
  const { userId } = await auth();
  if (!userId) return { userId: null, subjectUserId: null };
  if (!athleteParam || athleteParam === userId) {
    return { userId, subjectUserId: userId };
  }
  const coaches = await coachesAthlete(userId, athleteParam);
  return { userId, subjectUserId: coaches ? athleteParam : null };
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
