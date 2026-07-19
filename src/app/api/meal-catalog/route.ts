import { NextRequest } from "next/server";
import { db } from "@/db";
import { catalogMeals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveViewer } from "@/lib/access";

export async function GET() {
  const { subjectUserId: userId } = await resolveViewer();
  if (!userId) return Response.json([], { status: 401 });

  const rows = await db
    .select()
    .from(catalogMeals)
    .where(eq(catalogMeals.userId, userId))
    .orderBy(desc(catalogMeals.createdAt));
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId, coachView } = await resolveViewer();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (coachView) return Response.json({ error: "Read-only in coach view" }, { status: 403 });

  const body = await req.json();
  const [row] = await db
    .insert(catalogMeals)
    .values({
      userId,
      name: body.name,
      mealType: body.mealType ?? null,
      description: body.description ?? null,
      calories: body.calories ?? null,
      proteinG: body.proteinG ?? null,
      carbsG: body.carbsG ?? null,
      fatG: body.fatG ?? null,
      fiberG: body.fiberG ?? null,
      ingredients: body.ingredients?.length ? body.ingredients : null,
      note: body.note ?? null,
    })
    // A meal name is already in the catalog — refresh its snapshot.
    .onConflictDoUpdate({
      target: [catalogMeals.userId, catalogMeals.name],
      set: {
        mealType: body.mealType ?? null,
        description: body.description ?? null,
        calories: body.calories ?? null,
        proteinG: body.proteinG ?? null,
        carbsG: body.carbsG ?? null,
        fatG: body.fatG ?? null,
        fiberG: body.fiberG ?? null,
        ingredients: body.ingredients?.length ? body.ingredients : null,
        note: body.note ?? null,
      },
    })
    .returning();
  return Response.json(row, { status: 201 });
}
