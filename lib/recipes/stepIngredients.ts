import type { Ingredient, Step } from "@/lib/types";

/**
 * Works out which ingredients a step actually uses, by matching their names
 * against the step's text. Recipe steps name what they use ("boil the
 * noodles"), so this is reliable without asking a model — and it works on
 * recipes that were already imported.
 *
 * It errs towards showing an ingredient: a spare line on screen costs nothing,
 * a missing one sends you back to the full list.
 */

/** Descriptors that are never the thing itself. */
const STOPWORDS = new Set([
  "fresh", "dried", "frozen", "large", "medium", "small", "plain", "whole",
  "ground", "chopped", "sliced", "grated", "finely", "roughly", "coarsely",
  "extra", "virgin", "unsalted", "salted", "raw", "cooked", "uncooked",
  "smoked", "streaky", "baby", "ripe", "good", "quality", "free", "range",
  "skinless", "boneless", "thick", "thin", "light", "dark", "hot", "cold",
  "warm", "room", "temperature", "and", "the", "for", "with", "into", "your",
  "any", "some", "more", "plus", "taste", "serve", "optional", "about",
]);

function tokensFor(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/** Cheap singular/plural tolerance: "noodles" in the list, "noodle" in a step. */
function mentions(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  if (token.endsWith("es") && haystack.includes(token.slice(0, -2))) return true;
  if (token.endsWith("s") && haystack.includes(token.slice(0, -1))) return true;
  return haystack.includes(`${token}s`);
}

export function ingredientsForStep(
  step: Step,
  ingredients: Ingredient[],
): Ingredient[] {
  const text = (step.text ?? "").toLowerCase();
  if (!text) return [];

  return ingredients.filter((ingredient) => {
    const tokens = tokensFor(ingredient.name);
    if (tokens.length === 0) return false;
    return tokens.some((token) => mentions(text, token));
  });
}
