import type { Ingredient, Nutrition, Step } from "@/lib/types";

/** What every extraction path produces, however it got there. */
export type ExtractedRecipe = {
  title: string;
  summary: string;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  /** null when we cannot work it out honestly — the UI hides the panel. */
  nutrition_per_serving: Nutrition | null;
  confidence: "high" | "medium" | "low";
};
