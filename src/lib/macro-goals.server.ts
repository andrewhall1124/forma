import { db } from "@/db";
import { nutritionGoals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_MACRO_GOALS, type MacroGoals } from "@/lib/macro-goals";

// Reads a user's saved goals, falling back to the defaults when none are set.
// Server-only (touches the db); client code fetches /api/macro-goals instead.
export async function getMacroGoals(userId: string): Promise<MacroGoals> {
  const [row] = await db
    .select()
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .limit(1);
  if (!row) return DEFAULT_MACRO_GOALS;
  return {
    calories: row.calories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
  };
}
