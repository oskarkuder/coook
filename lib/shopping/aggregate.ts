import type { MealPlanEntryWithRecipe, ShoppingItem } from "@/lib/types";
import { formatQuantity, scaleQuantity } from "@/lib/recipes/scale";

/** Maps the many ways a video says a unit onto one canonical form. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  mg: "mg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l", dl: "dl",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  clove: "clove", cloves: "clove",
  slice: "slice", slices: "slice",
  can: "can", cans: "can",
  pinch: "pinch", pinches: "pinch",
  handful: "handful", handfuls: "handful",
  piece: "piece", pieces: "piece", pcs: "piece",
};

/** Units that sum cleanly after converting to a smaller base unit. */
const CONVERSIONS: Record<string, { base: string; factor: number }> = {
  kg: { base: "g", factor: 1000 },
  l: { base: "ml", factor: 1000 },
  dl: { base: "ml", factor: 100 },
};

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "");
}

function titleCaseFirst(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeUnit(unit: string | null): string {
  if (!unit) return "";
  const key = unit.trim().toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[key] ?? key;
}

/** "1500 g" reads better as "1.5 kg". */
function prettyAmount(quantity: number, unit: string): string {
  if (unit === "g" && quantity >= 1000) {
    return `${formatQuantity(quantity / 1000)} kg`;
  }
  if (unit === "ml" && quantity >= 1000) {
    return `${formatQuantity(quantity / 1000)} l`;
  }
  const value = formatQuantity(quantity);
  if (!value) return "";
  return unit ? `${value} ${unit}` : value;
}

/**
 * Collapses every ingredient across the week's planned meals into one list,
 * scaled to the servings chosen for each meal. Same ingredient in different
 * units keeps one line per unit rather than guessing a conversion.
 */
export function buildShoppingList(
  entries: MealPlanEntryWithRecipe[],
  extraItems: { key: string; name: string }[] = [],
): ShoppingItem[] {
  type Bucket = {
    displayName: string;
    byUnit: Map<string, number>;
    unitless: number;
    recipes: Set<string>;
    hasUnmeasured: boolean;
  };

  const buckets = new Map<string, Bucket>();

  for (const entry of entries) {
    const recipe = entry.recipe;
    if (!recipe || recipe.status !== "ready") continue;

    const recipeTitle = recipe.title ?? "Untitled recipe";
    const base = recipe.base_servings || 1;
    const target = entry.servings || base;

    for (const ingredient of recipe.ingredients ?? []) {
      if (!ingredient?.name) continue;

      const key = normalizeName(ingredient.name);
      if (!key) continue;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          displayName: titleCaseFirst(ingredient.name),
          byUnit: new Map(),
          unitless: 0,
          recipes: new Set(),
          hasUnmeasured: false,
        };
        buckets.set(key, bucket);
      }
      bucket.recipes.add(recipeTitle);

      const scaled = scaleQuantity(ingredient.quantity, base, target);
      if (scaled === null || scaled <= 0) {
        bucket.hasUnmeasured = true;
        continue;
      }

      let unit = normalizeUnit(ingredient.unit);
      let amount = scaled;

      const conversion = CONVERSIONS[unit];
      if (conversion) {
        unit = conversion.base;
        amount = scaled * conversion.factor;
      }

      if (!unit) {
        bucket.unitless += amount;
      } else {
        bucket.byUnit.set(unit, (bucket.byUnit.get(unit) ?? 0) + amount);
      }
    }
  }

  const items: ShoppingItem[] = [];

  for (const [key, bucket] of buckets) {
    const amounts: string[] = [];

    if (bucket.unitless > 0) {
      const text = prettyAmount(bucket.unitless, "");
      if (text) amounts.push(text);
    }
    for (const [unit, quantity] of [...bucket.byUnit].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const text = prettyAmount(quantity, unit);
      if (text) amounts.push(text);
    }
    if (amounts.length === 0 && bucket.hasUnmeasured) {
      amounts.push("as needed");
    }

    items.push({
      key: `ing:${key}`,
      name: bucket.displayName,
      amounts,
      fromRecipes: [...bucket.recipes].sort(),
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  for (const extra of extraItems) {
    items.push({
      key: extra.key,
      name: extra.name,
      amounts: [],
      fromRecipes: [],
      manual: true,
    });
  }

  return items;
}
