import { redirect } from "next/navigation";
import { ShoppingClient } from "@/components/ShoppingClient";
import { getStore } from "@/lib/data";
import { getServerUser } from "@/lib/supabase/serverUser";
import {
  currentWeekStartKey,
  isValidDateKey,
  weekDateKeys,
} from "@/lib/plan/week";
import type { MealPlanEntryWithRecipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/shopping");

  const { week } = await searchParams;
  const weekStart = week && isValidDateKey(week) ? week : currentWeekStartKey();
  const days = weekDateKeys(weekStart);

  const store = getStore();
  const [entries, shopping] = await Promise.all([
    store.listPlan(user.id, days[0], days[6]),
    store.getShopping(user.id, weekStart),
  ]);

  // Recipes added straight to the list have no day or slot, so wrap them in the
  // same shape the aggregator already understands.
  const extraEntries = (
    await Promise.all(
      shopping.extra_recipes.map(async (extra) => {
        const recipe = await store.getRecipe(user.id, extra.recipe_id);
        if (!recipe || recipe.status !== "ready") return null;

        // Annotated rather than `satisfies`, so meal_slot stays the union type.
        const entry: MealPlanEntryWithRecipe = {
          id: `extra:${recipe.id}`,
          user_id: user.id,
          recipe_id: recipe.id,
          plan_date: weekStart,
          meal_slot: "dinner",
          servings: extra.servings,
          created_at: weekStart,
          recipe: {
            id: recipe.id,
            title: recipe.title,
            status: recipe.status,
            source_thumbnail_url: recipe.source_thumbnail_url,
            base_servings: recipe.base_servings,
            ingredients: recipe.ingredients,
            nutrition: recipe.nutrition,
            prep_minutes: recipe.prep_minutes,
            cook_minutes: recipe.cook_minutes,
          },
        };
        return entry;
      }),
    )
  ).filter((entry): entry is MealPlanEntryWithRecipe => entry !== null);

  return (
    <ShoppingClient
      key={weekStart}
      weekStart={weekStart}
      entries={entries}
      extraEntries={extraEntries}
      initialShopping={shopping}
    />
  );
}
