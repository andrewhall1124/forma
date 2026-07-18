// Client-safe: types and constants only. The db-backed reader lives in
// macro-goals.server.ts so this module can be imported from client components.
export type MacroGoals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const MACRO_GOAL_KEYS = ["calories", "proteinG", "carbsG", "fatG"] as const;

// Sensible starting point for a new user: a balanced ~2,000 kcal day
// (150g protein / 200g carbs / 67g fat). Users override this in Settings.
export const DEFAULT_MACRO_GOALS: MacroGoals = {
  calories: 2000,
  proteinG: 150,
  carbsG: 200,
  fatG: 67,
};
