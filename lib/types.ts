export type Ingredient = {
  name: string;
  /** null when the video never says an amount ("a pinch of salt") */
  quantity: number | null;
  unit: string | null;
  note: string | null;
};

export type Step = {
  text: string;
  minutes: number | null;
};

export type Nutrition = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type RecipeStatus = "processing" | "ready" | "failed";

export type Recipe = {
  id: string;
  user_id: string;
  status: RecipeStatus;
  error_code: string | null;
  error_message: string | null;

  source_url: string;
  source_platform: SourcePlatform;
  source_author: string | null;
  source_thumbnail_url: string | null;
  source_caption: string | null;
  source_transcript: string | null;

  title: string | null;
  summary: string | null;
  cuisine: string | null;
  difficulty: string | null;
  base_servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  nutrition: Nutrition | null;
  confidence: string | null;

  is_saved: boolean;
  created_at: string;
  updated_at: string;
};

/** Trimmed shape used by list screens — keeps history/saved payloads small. */
export type RecipeSummary = Pick<
  Recipe,
  | "id"
  | "status"
  | "title"
  | "source_platform"
  | "source_author"
  | "source_thumbnail_url"
  | "source_url"
  | "base_servings"
  | "prep_minutes"
  | "cook_minutes"
  | "nutrition"
  | "is_saved"
  | "created_at"
  | "error_message"
>;

export type SourcePlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "website"
  | "manual"
  | "unknown";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  free_extractions_used: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
};

export type MealSlot = "breakfast" | "lunch" | "dinner";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export type MealPlanEntry = {
  id: string;
  user_id: string;
  recipe_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
  created_at: string;
};

/** What the meal plan needs from a recipe: enough to scale + build a list. */
export type PlanRecipe = Pick<
  Recipe,
  | "id"
  | "title"
  | "status"
  | "source_thumbnail_url"
  | "base_servings"
  | "ingredients"
  | "nutrition"
  | "prep_minutes"
  | "cook_minutes"
>;

export type MealPlanEntryWithRecipe = MealPlanEntry & {
  recipe: PlanRecipe | null;
};

export type ShoppingItem = {
  /** stable id used for the checked-off state */
  key: string;
  name: string;
  /** one line per unit, e.g. "300 g" + "2 tbsp" for the same ingredient */
  amounts: string[];
  fromRecipes: string[];
  manual?: boolean;
};

export type Category = {
  id: string;
  name: string;
  emoji: string | null;
  position: number;
  recipe_count: number;
};

/** A recipe pulled onto the list straight from the library, with no meal slot. */
export type ShoppingExtraRecipe = {
  recipe_id: string;
  servings: number;
};

export type ShoppingState = {
  week_start: string;
  checked_keys: string[];
  extra_items: { key: string; name: string }[];
  extra_recipes: ShoppingExtraRecipe[];
};
