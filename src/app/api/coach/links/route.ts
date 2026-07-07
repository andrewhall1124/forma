import { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { coachLinks } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { randomInt } from "crypto";

// No 0/O/1/I so codes survive being read aloud or handwritten.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

async function displayNames(userIds: string[]) {
  const names = new Map<string, string>();
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return names;
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ userId: unique });
  for (const u of data) {
    names.set(u.id, u.fullName ?? u.primaryEmailAddress?.emailAddress ?? "Unknown");
  }
  return names;
}

// All links involving the caller, as athlete and as coach, with display names.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const links = await db
    .select()
    .from(coachLinks)
    .where(
      and(
        or(eq(coachLinks.athleteUserId, userId), eq(coachLinks.coachUserId, userId)),
        inArray(coachLinks.status, ["pending", "active"]),
      ),
    );

  const names = await displayNames(
    links.flatMap((l) => [l.athleteUserId, l.coachUserId ?? ""]),
  );
  const withNames = links.map((l) => ({
    ...l,
    athleteName: names.get(l.athleteUserId) ?? null,
    coachName: l.coachUserId ? (names.get(l.coachUserId) ?? null) : null,
  }));

  return Response.json({
    asAthlete: withNames.filter((l) => l.athleteUserId === userId),
    asCoach: withNames.filter((l) => l.coachUserId === userId && l.status === "active"),
  });
}

// { action: "generate" } — athlete creates an invite code for a coach.
// { action: "redeem", code } — coach redeems a code to link an athlete.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "generate") {
    const [row] = await db
      .insert(coachLinks)
      .values({ athleteUserId: userId, inviteCode: generateCode() })
      .returning();
    return Response.json(row, { status: 201 });
  }

  if (body.action === "redeem") {
    const code = String(body.code ?? "").trim().toUpperCase();
    const [link] = await db
      .select()
      .from(coachLinks)
      .where(and(eq(coachLinks.inviteCode, code), eq(coachLinks.status, "pending")))
      .limit(1);
    if (!link) return Response.json({ error: "Invalid or used code" }, { status: 404 });
    if (link.athleteUserId === userId) {
      return Response.json({ error: "You can't coach yourself via a code" }, { status: 400 });
    }
    const [row] = await db
      .update(coachLinks)
      .set({ coachUserId: userId, status: "active" })
      .where(eq(coachLinks.id, link.id))
      .returning();
    return Response.json(row);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

// Either party can revoke a link (or the athlete can cancel a pending code).
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  const [link] = await db.select().from(coachLinks).where(eq(coachLinks.id, id)).limit(1);
  if (!link || (link.athleteUserId !== userId && link.coachUserId !== userId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await db.update(coachLinks).set({ status: "revoked" }).where(eq(coachLinks.id, id));
  return new Response(null, { status: 204 });
}
