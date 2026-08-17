import type { Ingredient, Nutrition } from "@/lib/types";

/**
 * Nutrition without a model and without a network call: a built-in table of
 * common foods per 100 g, plus unit-to-gram conversion.
 *
 * The honesty rule matters more than the coverage: if we cannot identify
 * enough of a recipe's weight, this returns null and the UI hides the panel.
 * A missing number is better than a confident wrong one.
 */

type Food = {
  /** per 100 g */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** grams for one "piece"/"clove"/"slice" of this thing */
  each?: number;
  /** grams per ml, for volume measures. Defaults to 1. */
  density?: number;
};

// Values are round numbers from standard food tables — this is an estimate,
// and the app says so.
const FOODS: Record<string, Food> = {
  // fats & oils
  "olive oil": { kcal: 884, protein: 0, carbs: 0, fat: 100, density: 0.92 },
  "vegetable oil": { kcal: 884, protein: 0, carbs: 0, fat: 100, density: 0.92 },
  "sunflower oil": { kcal: 884, protein: 0, carbs: 0, fat: 100, density: 0.92 },
  "sesame oil": { kcal: 884, protein: 0, carbs: 0, fat: 100, density: 0.92 },
  butter: { kcal: 717, protein: 1, carbs: 0, fat: 81 },
  ghee: { kcal: 876, protein: 0, carbs: 0, fat: 99 },

  // dairy & eggs
  milk: { kcal: 61, protein: 3, carbs: 5, fat: 3, density: 1.03 },
  "double cream": { kcal: 449, protein: 2, carbs: 3, fat: 47, density: 1 },
  cream: { kcal: 292, protein: 2, carbs: 3, fat: 30, density: 1 },
  yoghurt: { kcal: 61, protein: 4, carbs: 5, fat: 3 },
  yogurt: { kcal: 61, protein: 4, carbs: 5, fat: 3 },
  "greek yoghurt": { kcal: 97, protein: 9, carbs: 4, fat: 5 },
  cheese: { kcal: 402, protein: 25, carbs: 1, fat: 33 },
  cheddar: { kcal: 402, protein: 25, carbs: 1, fat: 33 },
  parmesan: { kcal: 431, protein: 38, carbs: 4, fat: 29 },
  mozzarella: { kcal: 280, protein: 22, carbs: 2, fat: 22 },
  feta: { kcal: 264, protein: 14, carbs: 4, fat: 21 },
  halloumi: { kcal: 321, protein: 22, carbs: 2, fat: 25 },
  "cream cheese": { kcal: 342, protein: 6, carbs: 4, fat: 34 },
  egg: { kcal: 143, protein: 13, carbs: 1, fat: 10, each: 50 },
  eggs: { kcal: 143, protein: 13, carbs: 1, fat: 10, each: 50 },

  // meat & fish
  chicken: { kcal: 165, protein: 31, carbs: 0, fat: 4 },
  "chicken breast": { kcal: 165, protein: 31, carbs: 0, fat: 4, each: 170 },
  "chicken thigh": { kcal: 209, protein: 26, carbs: 0, fat: 11, each: 110 },
  "chicken thighs": { kcal: 209, protein: 26, carbs: 0, fat: 11, each: 110 },
  beef: { kcal: 250, protein: 26, carbs: 0, fat: 15 },
  "beef mince": { kcal: 254, protein: 26, carbs: 0, fat: 17 },
  mince: { kcal: 254, protein: 26, carbs: 0, fat: 17 },
  pork: { kcal: 242, protein: 27, carbs: 0, fat: 14 },
  sausage: { kcal: 301, protein: 12, carbs: 3, fat: 27, each: 60 },
  sausages: { kcal: 301, protein: 12, carbs: 3, fat: 27, each: 60 },
  bacon: { kcal: 541, protein: 37, carbs: 1, fat: 42, each: 25 },
  pancetta: { kcal: 458, protein: 20, carbs: 0, fat: 41 },
  chorizo: { kcal: 455, protein: 24, carbs: 2, fat: 38 },
  lamb: { kcal: 294, protein: 25, carbs: 0, fat: 21 },
  salmon: { kcal: 208, protein: 20, carbs: 0, fat: 13 },
  tuna: { kcal: 132, protein: 28, carbs: 0, fat: 1 },
  cod: { kcal: 82, protein: 18, carbs: 0, fat: 1 },
  prawns: { kcal: 99, protein: 24, carbs: 0, fat: 0 },
  shrimp: { kcal: 99, protein: 24, carbs: 0, fat: 0 },

  // starches
  flour: { kcal: 364, protein: 10, carbs: 76, fat: 1, density: 0.53 },
  "plain flour": { kcal: 364, protein: 10, carbs: 76, fat: 1, density: 0.53 },
  cornflour: { kcal: 381, protein: 0, carbs: 91, fat: 0, density: 0.55 },
  cornstarch: { kcal: 381, protein: 0, carbs: 91, fat: 0, density: 0.55 },
  rice: { kcal: 360, protein: 7, carbs: 79, fat: 1, density: 0.85 },
  "cooked rice": { kcal: 130, protein: 3, carbs: 28, fat: 0 },
  pasta: { kcal: 371, protein: 13, carbs: 75, fat: 2 },
  spaghetti: { kcal: 371, protein: 13, carbs: 75, fat: 2 },
  orzo: { kcal: 371, protein: 13, carbs: 75, fat: 2 },
  noodles: { kcal: 350, protein: 12, carbs: 71, fat: 2 },
  "udon noodles": { kcal: 270, protein: 8, carbs: 56, fat: 1 },
  bread: { kcal: 265, protein: 9, carbs: 49, fat: 3, each: 35 },
  breadcrumbs: { kcal: 395, protein: 13, carbs: 72, fat: 5, density: 0.45 },
  panko: { kcal: 395, protein: 13, carbs: 72, fat: 5, density: 0.35 },
  tortilla: { kcal: 310, protein: 8, carbs: 51, fat: 8, each: 45 },
  potato: { kcal: 77, protein: 2, carbs: 17, fat: 0, each: 170 },
  potatoes: { kcal: 77, protein: 2, carbs: 17, fat: 0, each: 170 },
  "sweet potato": { kcal: 86, protein: 2, carbs: 20, fat: 0, each: 180 },
  couscous: { kcal: 376, protein: 13, carbs: 77, fat: 1 },
  quinoa: { kcal: 368, protein: 14, carbs: 64, fat: 6 },
  oats: { kcal: 389, protein: 17, carbs: 66, fat: 7, density: 0.4 },

  // pulses
  "chickpeas": { kcal: 164, protein: 9, carbs: 27, fat: 3 },
  lentils: { kcal: 116, protein: 9, carbs: 20, fat: 0 },
  "black beans": { kcal: 132, protein: 9, carbs: 24, fat: 1 },
  tofu: { kcal: 76, protein: 8, carbs: 2, fat: 5 },

  // vegetables
  onion: { kcal: 40, protein: 1, carbs: 9, fat: 0, each: 110 },
  onions: { kcal: 40, protein: 1, carbs: 9, fat: 0, each: 110 },
  shallot: { kcal: 72, protein: 3, carbs: 17, fat: 0, each: 30 },
  garlic: { kcal: 149, protein: 6, carbs: 33, fat: 1, each: 5 },
  "spring onions": { kcal: 32, protein: 2, carbs: 7, fat: 0, each: 15 },
  "spring onion": { kcal: 32, protein: 2, carbs: 7, fat: 0, each: 15 },
  carrot: { kcal: 41, protein: 1, carbs: 10, fat: 0, each: 70 },
  carrots: { kcal: 41, protein: 1, carbs: 10, fat: 0, each: 70 },
  celery: { kcal: 16, protein: 1, carbs: 3, fat: 0, each: 40 },
  tomato: { kcal: 18, protein: 1, carbs: 4, fat: 0, each: 120 },
  tomatoes: { kcal: 18, protein: 1, carbs: 4, fat: 0, each: 120 },
  "chopped tomatoes": { kcal: 20, protein: 1, carbs: 4, fat: 0 },
  "tomato purée": { kcal: 82, protein: 4, carbs: 19, fat: 0 },
  "tomato paste": { kcal: 82, protein: 4, carbs: 19, fat: 0 },
  passata: { kcal: 30, protein: 1, carbs: 6, fat: 0 },
  pepper: { kcal: 26, protein: 1, carbs: 6, fat: 0, each: 150 },
  peppers: { kcal: 26, protein: 1, carbs: 6, fat: 0, each: 150 },
  mushrooms: { kcal: 22, protein: 3, carbs: 3, fat: 0 },
  spinach: { kcal: 23, protein: 3, carbs: 4, fat: 0 },
  broccoli: { kcal: 34, protein: 3, carbs: 7, fat: 0 },
  courgette: { kcal: 17, protein: 1, carbs: 3, fat: 0, each: 200 },
  zucchini: { kcal: 17, protein: 1, carbs: 3, fat: 0, each: 200 },
  aubergine: { kcal: 25, protein: 1, carbs: 6, fat: 0, each: 250 },
  cucumber: { kcal: 15, protein: 1, carbs: 4, fat: 0, each: 300 },
  peas: { kcal: 81, protein: 5, carbs: 14, fat: 0 },
  corn: { kcal: 86, protein: 3, carbs: 19, fat: 1 },
  cabbage: { kcal: 25, protein: 1, carbs: 6, fat: 0 },
  lettuce: { kcal: 15, protein: 1, carbs: 3, fat: 0 },
  ginger: { kcal: 80, protein: 2, carbs: 18, fat: 1 },
  lemon: { kcal: 29, protein: 1, carbs: 9, fat: 0, each: 85 },
  lime: { kcal: 30, protein: 1, carbs: 11, fat: 0, each: 65 },
  avocado: { kcal: 160, protein: 2, carbs: 9, fat: 15, each: 150 },

  // pantry & sauces
  sugar: { kcal: 387, protein: 0, carbs: 100, fat: 0, density: 0.85 },
  honey: { kcal: 304, protein: 0, carbs: 82, fat: 0, density: 1.42 },
  "maple syrup": { kcal: 260, protein: 0, carbs: 67, fat: 0, density: 1.32 },
  "soy sauce": { kcal: 53, protein: 8, carbs: 5, fat: 0, density: 1.1 },
  "fish sauce": { kcal: 35, protein: 5, carbs: 4, fat: 0, density: 1.1 },
  gochujang: { kcal: 214, protein: 5, carbs: 41, fat: 2, density: 1.2 },
  miso: { kcal: 199, protein: 12, carbs: 26, fat: 6, density: 1.2 },
  mayonnaise: { kcal: 680, protein: 1, carbs: 1, fat: 75 },
  ketchup: { kcal: 101, protein: 1, carbs: 26, fat: 0, density: 1.1 },
  mustard: { kcal: 66, protein: 4, carbs: 6, fat: 3 },
  vinegar: { kcal: 21, protein: 0, carbs: 1, fat: 0 },
  "coconut milk": { kcal: 197, protein: 2, carbs: 3, fat: 21, density: 1 },
  stock: { kcal: 6, protein: 1, carbs: 0, fat: 0 },
  "chicken stock": { kcal: 6, protein: 1, carbs: 0, fat: 0 },
  "peanut butter": { kcal: 588, protein: 25, carbs: 20, fat: 50 },
  tahini: { kcal: 595, protein: 17, carbs: 21, fat: 54 },
  chocolate: { kcal: 546, protein: 5, carbs: 61, fat: 31 },
  almonds: { kcal: 579, protein: 21, carbs: 22, fat: 50 },
  cashews: { kcal: 553, protein: 18, carbs: 30, fat: 44 },
  walnuts: { kcal: 654, protein: 15, carbs: 14, fat: 65 },
  "sesame seeds": { kcal: 573, protein: 18, carbs: 23, fat: 50 },
};

/** Volume units in ml; weight units in grams. */
const ML_PER_UNIT: Record<string, number> = {
  ml: 1, l: 1000, dl: 100, tsp: 5, tbsp: 15, cup: 240,
  pint: 473, quart: 946,
};
const G_PER_UNIT: Record<string, number> = {
  g: 1, kg: 1000, mg: 0.001, oz: 28.35, lb: 453.6,
};
/** Rough weights when a recipe counts rather than measures. */
const COUNT_UNITS = new Set([
  "piece", "clove", "slice", "can", "jar", "pack", "bunch", "sprig",
  "stick", "head", "stalk", "handful",
]);
const COUNT_FALLBACK_G: Record<string, number> = {
  clove: 5, slice: 30, can: 400, jar: 300, pack: 250, bunch: 30,
  sprig: 3, stick: 40, head: 500, stalk: 40, handful: 30, piece: 100,
};

function lookup(name: string): { key: string; food: Food } | null {
  const clean = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!clean) return null;

  if (FOODS[clean]) return { key: clean, food: FOODS[clean] };

  // Longest matching entry contained in the name: "smoked streaky bacon" -> bacon,
  // and "sweet potato" beats "potato".
  let best: { key: string; food: Food } | null = null;
  for (const [key, food] of Object.entries(FOODS)) {
    if (clean.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, food };
    }
  }
  return best;
}

function gramsFor(ingredient: Ingredient, food: Food): number | null {
  const quantity = ingredient.quantity;
  if (quantity === null || quantity <= 0) return null;

  const unit = ingredient.unit?.toLowerCase() ?? "";

  if (!unit) {
    // Countable with no unit: "2 onions".
    return food.each ? quantity * food.each : null;
  }
  if (G_PER_UNIT[unit] !== undefined) return quantity * G_PER_UNIT[unit];
  if (ML_PER_UNIT[unit] !== undefined) {
    return quantity * ML_PER_UNIT[unit] * (food.density ?? 1);
  }
  if (COUNT_UNITS.has(unit)) {
    return quantity * (food.each ?? COUNT_FALLBACK_G[unit] ?? 0) || null;
  }
  return null;
}

/** Below this share of identified ingredients we do not publish a number. */
const MIN_COVERAGE = 0.6;

export function estimateNutrition(
  ingredients: Ingredient[],
  servings: number,
): Nutrition | null {
  if (!ingredients.length || servings <= 0) return null;

  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let matched = 0;
  let considered = 0;

  for (const ingredient of ingredients) {
    // Seasoning "to taste" carries no weight and should not count against us.
    if (ingredient.quantity === null && !ingredient.unit) continue;
    considered += 1;

    const found = lookup(ingredient.name);
    if (!found) continue;

    const grams = gramsFor(ingredient, found.food);
    if (grams === null || grams <= 0) continue;

    const factor = grams / 100;
    kcal += found.food.kcal * factor;
    protein += found.food.protein * factor;
    carbs += found.food.carbs * factor;
    fat += found.food.fat * factor;
    matched += 1;
  }

  if (considered === 0) return null;
  if (matched / considered < MIN_COVERAGE) return null;
  if (kcal <= 0) return null;

  return {
    calories: Math.round(kcal / servings),
    protein_g: Math.round(protein / servings),
    carbs_g: Math.round(carbs / servings),
    fat_g: Math.round(fat / servings),
  };
}
