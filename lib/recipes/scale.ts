import type { Ingredient, Nutrition } from "@/lib/types";

/** Vulgar fractions people actually use in kitchens. */
const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

const FRACTION_TOLERANCE = 0.05;

/**
 * Turns 0.75 into "¾" and 1.5 into "1 ½". Amounts of 10 or more are rounded to
 * whole numbers — nobody measures 247.5 g of flour.
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 10) return String(Math.round(value));

  const whole = Math.floor(value);
  const frac = value - whole;

  if (frac < FRACTION_TOLERANCE) return String(whole);

  let best = "";
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const [fractionValue, label] of FRACTIONS) {
    const diff = Math.abs(frac - fractionValue);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }

  if (bestDiff > FRACTION_TOLERANCE) {
    return String(Math.round(value * 10) / 10);
  }

  // 1 - frac is close to a whole number, e.g. 1.97 -> "2"
  if (frac > 1 - FRACTION_TOLERANCE) return String(whole + 1);

  return whole > 0 ? `${whole} ${best}` : best;
}

export function scaleQuantity(
  quantity: number | null,
  baseServings: number,
  targetServings: number,
): number | null {
  if (quantity === null || !Number.isFinite(quantity)) return null;
  if (!baseServings || baseServings <= 0) return quantity;
  return (quantity * targetServings) / baseServings;
}

/** "300 g flour, sifted" — the whole line, ready to render. */
export function formatIngredient(
  ingredient: Ingredient,
  baseServings: number,
  targetServings: number,
): { amount: string; name: string; note: string | null } {
  const scaled = scaleQuantity(
    ingredient.quantity,
    baseServings,
    targetServings,
  );
  const quantityText = scaled === null ? "" : formatQuantity(scaled);
  const unit = ingredient.unit?.trim() ?? "";

  const amount = [quantityText, unit].filter(Boolean).join(" ").trim();

  return {
    amount,
    name: ingredient.name,
    note: ingredient.note?.trim() || null,
  };
}

/**
 * Nutrition is stored per serving, so it does not scale with the servings
 * picker — but the "whole batch" figure does.
 */
export function totalNutrition(
  nutrition: Nutrition | null,
  servings: number,
): Nutrition | null {
  if (!nutrition) return null;
  return {
    calories: Math.round(nutrition.calories * servings),
    protein_g: Math.round(nutrition.protein_g * servings),
    carbs_g: Math.round(nutrition.carbs_g * servings),
    fat_g: Math.round(nutrition.fat_g * servings),
  };
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function totalTimeMinutes(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number {
  return (prep ?? 0) + (cook ?? 0);
}
