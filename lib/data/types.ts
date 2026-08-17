import type {
  Category,
  MealPlanEntryWithRecipe,
  MealSlot,
  Profile,
  Recipe,
  RecipeSummary,
  ShoppingExtraRecipe,
  ShoppingState,
} from "@/lib/types";

export type ReadyRecipePayload = {
  platform: Recipe["source_platform"];
  url: string;
  author: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  transcript: string | null;
  title: string;
  summary: string;
  cuisine: string | null;
  difficulty: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Recipe["ingredients"];
  steps: Recipe["steps"];
  nutrition: Recipe["nutrition"];
  confidence: string;
};

export type FailedRecipePayload = {
  code: string;
  message: string;
  platform: Recipe["source_platform"];
  url: string;
  author?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
};

/**
 * Everything the app needs from storage. Two implementations: Supabase for
 * real use, and an in-memory one for demo mode.
 */
export type DataStore = {
  getProfile(userId: string): Promise<Profile | null>;
  incrementFreeExtractions(userId: string): Promise<void>;

  listRecipes(
    userId: string,
    options?: { savedOnly?: boolean; limit?: number; search?: string },
  ): Promise<RecipeSummary[]>;
  getRecipe(userId: string, recipeId: string): Promise<Recipe | null>;
  findReadyRecipeByUrl(userId: string, sourceUrl: string): Promise<string | null>;
  createProcessingRecipe(userId: string, sourceUrl: string): Promise<string>;
  markRecipeReady(
    userId: string,
    recipeId: string,
    payload: ReadyRecipePayload,
  ): Promise<void>;
  markRecipeFailed(
    userId: string,
    recipeId: string,
    payload: FailedRecipePayload,
  ): Promise<void>;
  setRecipeSaved(
    userId: string,
    recipeId: string,
    isSaved: boolean,
  ): Promise<boolean>;
  deleteRecipe(userId: string, recipeId: string): Promise<boolean>;

  listPlan(
    userId: string,
    from: string,
    to: string,
  ): Promise<MealPlanEntryWithRecipe[]>;
  upsertPlanEntry(
    userId: string,
    input: {
      recipeId: string;
      planDate: string;
      mealSlot: MealSlot;
      servings: number;
    },
  ): Promise<MealPlanEntryWithRecipe | null>;
  updatePlanServings(
    userId: string,
    entryId: string,
    servings: number,
  ): Promise<boolean>;
  deletePlanEntry(userId: string, entryId: string): Promise<boolean>;

  listCategories(userId: string): Promise<Category[]>;
  createCategory(
    userId: string,
    name: string,
    emoji: string | null,
  ): Promise<Category | null>;
  updateCategory(
    userId: string,
    categoryId: string,
    patch: { name?: string; emoji?: string | null },
  ): Promise<boolean>;
  deleteCategory(userId: string, categoryId: string): Promise<boolean>;
  listCategoryRecipes(
    userId: string,
    categoryId: string,
  ): Promise<RecipeSummary[]>;
  getRecipeCategoryIds(userId: string, recipeId: string): Promise<string[]>;
  setRecipeCategories(
    userId: string,
    recipeId: string,
    categoryIds: string[],
  ): Promise<boolean>;

  getShopping(userId: string, weekStart: string): Promise<ShoppingState>;
  putShopping(
    userId: string,
    weekStart: string,
    checkedKeys: string[],
    extraItems: { key: string; name: string }[],
    extraRecipes: ShoppingExtraRecipe[],
  ): Promise<ShoppingState>;
};
