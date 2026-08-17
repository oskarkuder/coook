import { parseIngredient } from "@/lib/recipes/parseIngredient";
import { estimateNutrition } from "@/lib/recipes/nutrition";
import type { ExtractedRecipe } from "@/lib/extract/types";
import type { Ingredient, Step } from "@/lib/types";

/**
 * Turns a social caption or pasted text into a structured recipe using rules
 * only — no model, no cost, no invention. It reads what is written and nothing
 * more: if the text does not contain a recipe, this returns null rather than
 * making one up.
 */

const INGREDIENT_HEADER =
  /^\s*(ingredients?|you.{0,3}ll need|what you need|shopping list|sestavine|zutaten|ingr[ée]dients)\s*[:.\-–]?\s*$/i;

const STEP_HEADER =
  /^\s*(method|instructions?|directions?|steps?|how to make|preparation|priprava|postopek|zubereitung)\s*[:.\-–]?\s*$/i;

/** Engagement bait and platform furniture that is never part of a recipe. */
const NOISE =
  /^(follow|like and|comment|save this|share this|full recipe|recipe below|link in bio|tap the link|subscribe|credit|via |more recipes)/i;

const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

function cleanLine(line: string): string {
  return line
    .replace(EMOJI, " ")
    .replace(/^[\s•\-–—*·▪️>]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hashtag blocks are always trailing noise; mid-sentence tags are rare. */
function stripHashtags(text: string): string {
  return text
    .replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, " ")
    .replace(/(?:^|\s)@[\p{L}\p{N}_.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeIngredient(line: string): boolean {
  const words = line.split(/\s+/).length;
  if (words > 12) return false;

  const parsed = parseIngredient(line);
  if (!parsed) return false;

  // A bare noun ("salt") is only an ingredient inside an ingredients block;
  // on its own we need a number or a unit to be confident.
  return parsed.quantity !== null || parsed.unit !== null;
}

function looksLikeStep(line: string): boolean {
  const words = line.split(/\s+/).length;
  if (words < 4) return false;
  // Steps are sentences; ingredients are fragments.
  return words >= 6 || /[.!]$/.test(line);
}

function findNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

function findMinutes(text: string, label: string): number | null {
  // Grouped: without (?:…) the alternation would swallow the rest of the
  // pattern, so "cook|bake" only ever matched the last branch.
  const pattern = new RegExp(
    `(?:${label})[^\\n]{0,12}?(\\d+)\\s*(h|hr|hour|hours|min|mins|minutes?)`,
    "i",
  );
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return /^h/i.test(match[2]) ? value * 60 : value;
}

export function parseRecipeText(
  raw: string,
  fallbackTitle?: string | null,
): ExtractedRecipe | null {
  if (!raw?.trim()) return null;

  const text = raw.replace(/\r/g, "");
  // Strip tags before the noise test, so "#food follow for more" is recognised
  // as bait rather than surviving as a step once the tags are removed.
  const lines = text
    .split("\n")
    .map((line) => stripHashtags(cleanLine(line)))
    .filter((line) => line.length > 0 && !NOISE.test(line));

  if (lines.length === 0) return null;

  // ------------------------------------------------- explicit sections first
  let ingredientLines: string[] = [];
  let stepLines: string[] = [];

  const ingredientAt = lines.findIndex((line) => INGREDIENT_HEADER.test(line));
  const stepAt = lines.findIndex((line) => STEP_HEADER.test(line));

  if (ingredientAt !== -1) {
    const end = stepAt > ingredientAt ? stepAt : lines.length;
    ingredientLines = lines.slice(ingredientAt + 1, end);
    stepLines = stepAt !== -1 ? lines.slice(stepAt + 1) : [];
  } else if (stepAt !== -1) {
    ingredientLines = lines.slice(0, stepAt);
    stepLines = lines.slice(stepAt + 1);
  } else {
    // ------------------------------------------- otherwise classify per line
    // Captions run "title, ingredients, method" often enough that the first
    // run of ingredient-shaped lines is a reliable split point.
    const firstIngredient = lines.findIndex(looksLikeIngredient);
    if (firstIngredient === -1) return null;

    let lastIngredient = firstIngredient;
    for (let i = firstIngredient; i < lines.length; i += 1) {
      if (looksLikeIngredient(lines[i])) lastIngredient = i;
      else if (looksLikeStep(lines[i]) && i > lastIngredient + 1) break;
    }

    ingredientLines = lines.slice(firstIngredient, lastIngredient + 1);
    stepLines = lines.slice(lastIngredient + 1);
  }

  const ingredients: Ingredient[] = ingredientLines
    .filter((line) => !STEP_HEADER.test(line) && !INGREDIENT_HEADER.test(line))
    .map((line) => parseIngredient(stripHashtags(line)))
    .filter((item): item is Ingredient => item !== null && item.name.length > 1);

  const steps: Step[] = stepLines
    .map((line) => stripHashtags(line).replace(/^\d+[.)]\s*/, ""))
    .filter((line) => line.length > 3)
    .map((line) => ({
      text: line,
      minutes: findMinutes(line, "") ?? null,
    }));

  // Two ingredients and one step is the floor for something cookable.
  if (ingredients.length < 2 || steps.length < 1) return null;

  const flat = stripHashtags(text.replace(EMOJI, " "));

  const title =
    (lines.find(
      (line) =>
        !INGREDIENT_HEADER.test(line) &&
        !STEP_HEADER.test(line) &&
        !looksLikeIngredient(line) &&
        line.length > 2 &&
        line.length <= 80,
    ) ??
      fallbackTitle ??
      "Recipe")
      .replace(/[.:]$/, "")
      .trim();

  const servings =
    findNumber(flat, [
      /serves?\s+(\d+)/i,
      /(\d+)\s+servings?/i,
      /for\s+(\d+)\s+people/i,
      /makes\s+(\d+)/i,
    ]) ?? 2;

  const prep = findMinutes(flat, "prep");
  const cook = findMinutes(flat, "cook|bake|roast|simmer");

  return {
    title,
    summary: "",
    cuisine: null,
    difficulty: steps.length > 8 ? "medium" : "easy",
    servings: Math.min(Math.max(servings, 1), 50),
    prep_minutes: prep,
    cook_minutes: cook,
    ingredients,
    steps,
    nutrition_per_serving: estimateNutrition(ingredients, servings),
    // Explicit sections mean the author laid it out; inference is less certain.
    confidence: ingredientAt !== -1 || stepAt !== -1 ? "high" : "medium",
  };
}
