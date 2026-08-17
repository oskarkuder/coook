import "server-only";
import type { DataStore } from "@/lib/data/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  Category,
  MealPlanEntryWithRecipe,
  Profile,
  Recipe,
  RecipeSummary,
  ShoppingState,
} from "@/lib/types";

const LIST_FIELDS =
  "id, status, title, source_platform, source_author, source_thumbnail_url, source_url, base_servings, prep_minutes, cook_minutes, nutrition, is_saved, created_at, error_message";

const PLAN_RECIPE_FIELDS =
  "id, title, status, source_thumbnail_url, base_servings, ingredients, nutrition, prep_minutes, cook_minutes";

export const supabaseStore: DataStore = {
  async getProfile(userId) {
    // Service role: a profile row missing because the signup trigger did not
    // fire should be repaired, not turned into a 500.
    const admin = createSupabaseAdmin();

    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) return data as Profile;

    const { data: created } = await admin
      .from("profiles")
      .insert({ id: userId })
      .select("*")
      .maybeSingle();

    return (created as Profile) ?? null;
  },

  async incrementFreeExtractions(userId) {
    const admin = createSupabaseAdmin();
    await admin.rpc("increment_free_extractions", { p_user_id: userId });
  },

  async listRecipes(userId, options) {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("recipes")
      .select(LIST_FIELDS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 200);

    if (options?.savedOnly) query = query.eq("is_saved", true);
    if (options?.search) query = query.ilike("title", `%${options.search}%`);

    const { data } = await query;
    return (data ?? []) as unknown as RecipeSummary[];
  },

  async getRecipe(userId, recipeId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data as Recipe) ?? null;
  },

  async findReadyRecipeByUrl(userId, sourceUrl) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("recipes")
      .select("id")
      .eq("user_id", userId)
      .eq("source_url", sourceUrl)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  },

  async createProcessingRecipe(userId, sourceUrl) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .insert({ user_id: userId, status: "processing", source_url: sourceUrl })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "insert failed");
    return data.id as string;
  },

  async markRecipeReady(userId, recipeId, payload) {
    const admin = createSupabaseAdmin();
    await admin
      .from("recipes")
      .update({
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
      })
      .eq("id", recipeId)
      .eq("user_id", userId);
  },

  async markRecipeFailed(userId, recipeId, payload) {
    const admin = createSupabaseAdmin();
    await admin
      .from("recipes")
      .update({
        status: "failed",
        error_code: payload.code,
        error_message: payload.message,
        source_platform: payload.platform,
        source_url: payload.url,
        source_author: payload.author ?? null,
        source_thumbnail_url: payload.thumbnailUrl ?? null,
        source_caption: payload.caption ?? null,
      })
      .eq("id", recipeId)
      .eq("user_id", userId);
  },

  async setRecipeSaved(userId, recipeId, isSaved) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("recipes")
      .update({ is_saved: isSaved })
      .eq("id", recipeId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    return Boolean(data);
  },

  async deleteRecipe(userId, recipeId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId)
      .eq("user_id", userId);
    return !error;
  },

  async listPlan(userId, from, to) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("meal_plan_entries")
      .select(`*, recipe:recipes(${PLAN_RECIPE_FIELDS})`)
      .eq("user_id", userId)
      .gte("plan_date", from)
      .lte("plan_date", to)
      .order("plan_date", { ascending: true });
    return (data ?? []) as unknown as MealPlanEntryWithRecipe[];
  },

  async upsertPlanEntry(userId, input) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .upsert(
        {
          user_id: userId,
          recipe_id: input.recipeId,
          plan_date: input.planDate,
          meal_slot: input.mealSlot,
          servings: input.servings,
        },
        { onConflict: "user_id,plan_date,meal_slot,recipe_id" },
      )
      .select(`*, recipe:recipes(${PLAN_RECIPE_FIELDS})`)
      .single();

    if (error) return null;
    return data as unknown as MealPlanEntryWithRecipe;
  },

  async updatePlanServings(userId, entryId, servings) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("meal_plan_entries")
      .update({ servings })
      .eq("id", entryId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    return Boolean(data);
  },

  async deletePlanEntry(userId, entryId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("meal_plan_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId);
    return !error;
  },

  async listCategories(userId) {
    const supabase = await createSupabaseServerClient();

    // Counts come back as a separate cheap read rather than a join, so an
    // empty category still shows up in the list.
    const [{ data: rows }, { data: links }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, emoji, position")
        .eq("user_id", userId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("recipe_categories")
        .select("category_id")
        .eq("user_id", userId),
    ]);

    const counts = new Map<string, number>();
    for (const link of links ?? []) {
      const key = link.category_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return (rows ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      emoji: (row.emoji as string | null) ?? null,
      position: (row.position as number) ?? 0,
      recipe_count: counts.get(row.id as string) ?? 0,
    })) satisfies Category[];
  },

  async createCategory(userId, name, emoji) {
    const supabase = await createSupabaseServerClient();

    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name, emoji, position: count ?? 0 })
      .select("id, name, emoji, position")
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      emoji: (data.emoji as string | null) ?? null,
      position: (data.position as number) ?? 0,
      recipe_count: 0,
    };
  },

  async updateCategory(userId, categoryId, patch) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("categories")
      .update(patch)
      .eq("id", categoryId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    return Boolean(data);
  },

  async deleteCategory(userId, categoryId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("user_id", userId);
    return !error;
  },

  async listCategoryRecipes(userId, categoryId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("recipe_categories")
      .select(`recipe:recipes(${LIST_FIELDS})`)
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .order("added_at", { ascending: false });

    return ((data ?? []) as unknown as { recipe: RecipeSummary | null }[])
      .map((row) => row.recipe)
      .filter((recipe): recipe is RecipeSummary => Boolean(recipe));
  },

  async getRecipeCategoryIds(userId, recipeId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("recipe_categories")
      .select("category_id")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);
    return (data ?? []).map((row) => row.category_id as string);
  },

  async setRecipeCategories(userId, recipeId, categoryIds) {
    const supabase = await createSupabaseServerClient();

    const { error: deleteError } = await supabase
      .from("recipe_categories")
      .delete()
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);
    if (deleteError) return false;

    if (categoryIds.length === 0) return true;

    const { error } = await supabase.from("recipe_categories").insert(
      categoryIds.map((categoryId) => ({
        user_id: userId,
        category_id: categoryId,
        recipe_id: recipeId,
      })),
    );
    return !error;
  },

  async getShopping(userId, weekStart) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("shopping_state")
      .select("week_start, checked_keys, extra_items, extra_recipes")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    const row = data as Partial<ShoppingState> | null;
    return {
      week_start: weekStart,
      checked_keys: row?.checked_keys ?? [],
      extra_items: row?.extra_items ?? [],
      extra_recipes: row?.extra_recipes ?? [],
    };
  },

  async putShopping(userId, weekStart, checkedKeys, extraItems, extraRecipes) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("shopping_state")
      .upsert(
        {
          user_id: userId,
          week_start: weekStart,
          checked_keys: checkedKeys,
          extra_items: extraItems,
          extra_recipes: extraRecipes,
        },
        { onConflict: "user_id,week_start" },
      )
      .select("week_start, checked_keys, extra_items, extra_recipes")
      .single();

    const row = data as Partial<ShoppingState> | null;
    return {
      week_start: weekStart,
      checked_keys: row?.checked_keys ?? checkedKeys,
      extra_items: row?.extra_items ?? extraItems,
      extra_recipes: row?.extra_recipes ?? extraRecipes,
    };
  },
};
