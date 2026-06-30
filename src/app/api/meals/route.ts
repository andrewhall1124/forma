import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { meals } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const rows = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.date, date)))
      .orderBy(desc(meals.createdAt));
    return Response.json(rows);
  }

  // Catalog: one row per distinct meal name (most recently logged), alphabetical.
  if (req.nextUrl.searchParams.get("catalog")) {
    const rows = await db
      .selectDistinctOn([meals.name])
      .from(meals)
      .where(eq(meals.userId, userId))
      .orderBy(meals.name, desc(meals.createdAt));
    return Response.json(rows);
  }
  const rows = await db
    .select()
    .from(meals)
    .where(eq(meals.userId, userId))
    .orderBy(desc(meals.createdAt))
    .limit(50);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const [row] = await db.insert(meals).values({ ...body, userId }).returning();
  return Response.json(row, { status: 201 });
}
