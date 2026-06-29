import { NextRequest } from "next/server";
import { db } from "@/db";
import { meals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const rows = await db
      .select()
      .from(meals)
      .where(eq(meals.date, date))
      .orderBy(desc(meals.createdAt));
    return Response.json(rows);
  }
  const rows = await db.select().from(meals).orderBy(desc(meals.createdAt)).limit(50);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [row] = await db.insert(meals).values(body).returning();
  return Response.json(row, { status: 201 });
}
