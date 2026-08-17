import "server-only";
import { randomUUID } from "node:crypto";
import type { DataStore } from "@/lib/data/types";
import { DEMO_PROFILE, DEMO_RECIPES } from "@/lib/demo";
import type {
  Category,
  MealPlanEntry,
  MealPlanEntryWithRecipe,
  PlanRecipe,
  Recipe,
  RecipeSummary,
  ShoppingState,
} from "@/lib/types";

type DemoCategory = Omit<Category, "recipe_count">;

type DemoState = {
  profile: typeof DEMO_PROFILE;
  recipes: Recipe[];
  plan: MealPlanEntry[];
  shopping: Map<string, ShoppingState>;
  categories: DemoCategory[];
  memberships: { category_id: string; recipe_id: string }[];
};

/**
 * Hung off globalThis so the data survives Next's dev-server module reloads.
 * It does not survive a full restart — demo mode is for clicking around, not
 * for keeping anything.
 */
const globalStore = globalThis as unknown as { __coookDemo?: DemoState };

function state(): DemoState {
  const existing = globalStore.__coookDemo;
  if (existing) {
    // The object survives hot reloads, so a state saved before a field existed
    // would otherwise blow up on read. Backfill anything missing.
    existing.recipes ??= [];
    existing.plan ??= [];
    existing.shopping ??= new Map();
    existing.categories ??= [];
    existing.memberships ??= [];
    return existing;
  }

  if (!globalStore.__coookDemo) {
    const categories: DemoCategory[] = [
      { id: "cat-weeknight", name: "Weeknight dinners", emoji: "🌙", position: 0 },
      { id: "cat-totry", name: "Want to try", emoji: "⭐️", position: 1 },
    ];
    globalStore.__coookDemo = {
      profile: { ...DEMO_PROFILE },
      recipes: DEMO_RECIPES.map((recipe) => ({ ...recipe })),
      plan: [],
      shopping: new Map(),
      categories,
      memberships: [
        { category_id: "cat-weeknight", recipe_id: DEMO_RECIPES[0].id },
        { category_id: "cat-weeknight", recipe_id: DEMO_RECIPES[1].id },
      ],
    };
  }
  return globalStore.__coookDemo;
}

function toSummary(recipe: Recipe): RecipeSummary {
  return {
    id: recipe.id,
    status: recipe.status,
    title: recipe.title,
    source_platform: recipe.source_platform,
    source_author: recipe.source_author,
    source_thumbnail_url: recipe.source_thumbnail_url,
    source_url: recipe.source_url,
    base_servings: recipe.base_servings,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    nutrition: recipe.nutrition,
    is_saved: recipe.is_saved,
    created_at: recipe.created_at,
    error_message: recipe.error_message,
  };
}

function toPlanRecipe(recipe: Recipe): PlanRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    status: recipe.status,
    source_thumbnail_url: recipe.source_thumbnail_url,
    base_servings: recipe.base_servings,
    ingredients: recipe.ingredients,
    nutrition: recipe.nutrition,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
  };
}

export const demoStore: DataStore = {
  async getProfile() {
    return state().profile;
  },

  async incrementFreeExtractions() {
    state().profile.free_extractions_used += 1;
  },

  async listRecipes(_userId, options) {
    let recipes = [...state().recipes].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    if (options?.savedOnly) recipes = recipes.filter((r) => r.is_saved);
    if (options?.search) {
      const needle = options.search.toLowerCase();
      recipes = recipes.filter((r) =>
        (r.title ?? "").toLowerCase().includes(needle),
      );
    }
    return recipes.slice(0, options?.limit ?? 200).map(toSummary);
  },

  async getRecipe(_userId, recipeId) {
    return state().recipes.find((recipe) => recipe.id === recipeId) ?? null;
  },

  async findReadyRecipeByUrl(_userId, sourceUrl) {
    const match = state().recipes.find(
      (recipe) => recipe.source_url === sourceUrl && recipe.status === "ready",
    );
    return match?.id ?? null;
  },

  async createProcessingRecipe(userId, sourceUrl) {
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: randomUUID(),
      user_id: userId,
      status: "processing",
      error_code: null,
      error_message: null,
      source_url: sourceUrl,
      source_platform: "unknown",
      source_author: null,
      source_thumbnail_url: null,
      source_caption: null,
      source_transcript: null,
      title: null,
      summary: null,
      cuisine: null,
      difficulty: null,
      base_servings: 2,
      prep_minutes: null,
      cook_minutes: null,
      ingredients: [],
      steps: [],
      nutrition: null,
      confidence: null,
      is_saved: false,
      created_at: now,
      updated_at: now,
    };
    state().recipes.unshift(recipe);
    return recipe.id;
  },

  async markRecipeReady(_userId, recipeId, payload) {
    const recipe = state().recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    Object.assign(recipe, {
      status: "ready",
      error_code: null,
      error_message: null,
      source_platform: payload.platform,
      source_url: payload.url,
      source_author: payload.author,
      source_thumbnail_url: payload.thumbnailUrl,
      source_caption: payload.caption,
      source_transcript: payload.transcript,
      title: payload.title,
      summary: payload.summary,
      cuisine: payload.cuisine,
      difficulty: payload.difficulty,
      base_servings: payload.servings,
      prep_minutes: payload.prepMinutes,
      cook_minutes: payload.cookMinutes,
      ingredients: payload.ingredients,
      steps: payload.steps,
      nutrition: payload.nutrition,
      confidence: payload.confidence,
      updated_at: new Date().toISOString(),
    } satisfies Partial<Recipe>);
  },

  async markRecipeFailed(_userId, recipeId, payload) {
    const recipe = state().recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    Object.assign(recipe, {
      status: "failed",
      error_code: payload.code,
      error_message: payload.message,
      source_platform: payload.platform,
      source_url: payload.url,
      source_author: payload.author ?? null,
      source_thumbnail_url: payload.thumbnailUrl ?? null,
      source_caption: payload.caption ?? null,
      updated_at: new Date().toISOString(),
    } satisfies Partial<Recipe>);
  },

  async setRecipeSaved(_userId, recipeId, isSaved) {
    const recipe = state().recipes.find((item) => item.id === recipeId);
    if (!recipe) return false;
    recipe.is_saved = isSaved;
    return true;
  },

  async deleteRecipe(_userId, recipeId) {
    const current = state();
    const before = current.recipes.length;
    current.recipes = current.recipes.filter((item) => item.id !== recipeId);
    current.plan = current.plan.filter((entry) => entry.recipe_id !== recipeId);
    return current.recipes.length < before;
  },

  async listPlan(_userId, from, to) {
    const current = state();
    return current.plan
      .filter((entry) => entry.plan_date >= from && entry.plan_date <= to)
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date))
      .map((entry) => {
        const recipe = current.recipes.find(
          (item) => item.id === entry.recipe_id,
        );
        return { ...entry, recipe: recipe ? toPlanRecipe(recipe) : null };
      });
  },

  async upsertPlanEntry(userId, input) {
    const current = state();
    const recipe = current.recipes.find((item) => item.id === input.recipeId);
    if (!recipe) return null;

    const existing = current.plan.find(
      (entry) =>
        entry.recipe_id === input.recipeId &&
        entry.plan_date === input.planDate &&
        entry.meal_slot === input.mealSlot,
    );

    const entry: MealPlanEntry = existing ?? {
      id: randomUUID(),
      user_id: userId,
      recipe_id: input.recipeId,
      plan_date: input.planDate,
      meal_slot: input.mealSlot,
      servings: input.servings,
      created_at: new Date().toISOString(),
    };
    entry.servings = input.servings;
    if (!existing) current.plan.push(entry);

    return { ...entry, recipe: toPlanRecipe(recipe) };
  },

  async updatePlanServings(_userId, entryId, servings) {
    const entry = state().plan.find((item) => item.id === entryId);
    if (!entry) return false;
    entry.servings = servings;
    return true;
  },

  async deletePlanEntry(_userId, entryId) {
    const current = state();
    const before = current.plan.length;
    current.plan = current.plan.filter((entry) => entry.id !== entryId);
    return current.plan.length < before;
  },

  async listCategories() {
    const current = state();
    return current.categories
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((category) => ({
        ...category,
        recipe_count: current.memberships.filter(
          (m) => m.category_id === category.id,
        ).length,
      }));
  },

  async createCategory(_userId, name, emoji) {
    const current = state();
    if (current.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return null;
    }
    const category: DemoCategory = {
      id: randomUUID(),
      name,
      emoji,
      position: current.categories.length,
    };
    current.categories.push(category);
    return { ...category, recipe_count: 0 };
  },

  async updateCategory(_userId, categoryId, patch) {
    const category = state().categories.find((c) => c.id === categoryId);
    if (!category) return false;
    if (patch.name !== undefined) category.name = patch.name;
    if (patch.emoji !== undefined) category.emoji = patch.emoji;
    return true;
  },

  async deleteCategory(_userId, categoryId) {
    const current = state();
    const before = current.categories.length;
    current.categories = current.categories.filter((c) => c.id !== categoryId);
    current.memberships = current.memberships.filter(
      (m) => m.category_id !== categoryId,
    );
    return current.categories.length < before;
  },

  async listCategoryRecipes(_userId, categoryId) {
    const current = state();
    const ids = new Set(
      current.memberships
        .filter((m) => m.category_id === categoryId)
        .map((m) => m.recipe_id),
    );
    return current.recipes
      .filter((recipe) => ids.has(recipe.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(toSummary);
  },

  async getRecipeCategoryIds(_userId, recipeId) {
    return state()
      .memberships.filter((m) => m.recipe_id === recipeId)
      .map((m) => m.category_id);
  },

  async setRecipeCategories(_userId, recipeId, categoryIds) {
    const current = state();
    current.memberships = current.memberships.filter(
      (m) => m.recipe_id !== recipeId,
    );
    for (const categoryId of categoryIds) {
      if (current.categories.some((c) => c.id === categoryId)) {
        current.memberships.push({ category_id: categoryId, recipe_id: recipeId });
      }
    }
    return true;
  },

  async getShopping(_userId, weekStart) {
    const stored = state().shopping.get(weekStart);
    return {
      week_start: weekStart,
      checked_keys: stored?.checked_keys ?? [],
      extra_items: stored?.extra_items ?? [],
      extra_recipes: stored?.extra_recipes ?? [],
    };
  },

  async putShopping(_userId, weekStart, checkedKeys, extraItems, extraRecipes) {
    const next: ShoppingState = {
      week_start: weekStart,
      checked_keys: checkedKeys,
      extra_items: extraItems,
      extra_recipes: extraRecipes,
    };
    state().shopping.set(weekStart, next);
    return next;
  },
};
