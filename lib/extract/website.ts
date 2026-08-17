import "server-only";
import { BROWSER_UA } from "@/lib/extract/sourceUrl";
import {
  isoDurationToMinutes,
  parseIngredients,
} from "@/lib/recipes/parseIngredient";
import { estimateNutrition } from "@/lib/recipes/nutrition";
import type { ExtractedRecipe } from "@/lib/extract/types";

/**
 * Recipe websites almost all publish schema.org/Recipe as JSON-LD. Reading it
 * gives an exact recipe — every amount as the author wrote it — with no model
 * call, no cost and nothing invented. This runs before the AI path and skips it
 * entirely when it succeeds.
 */

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: Json): Json[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function typeIncludesRecipe(value: Json): boolean {
  return asArray(value).some(
    (entry) => typeof entry === "string" && entry.toLowerCase() === "recipe",
  );
}

/** JSON-LD is nested inconsistently — @graph, arrays, single objects. */
function findRecipeNode(node: Json, depth = 0): Record<string, Json> | null {
  if (depth > 6) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(node)) return null;
  if (typeIncludesRecipe(node["@type"])) return node;

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    const found = findRecipeNode(node[key], depth + 1);
    if (found) return found;
  }

  for (const value of Object.values(node)) {
    if (isRecord(value) || Array.isArray(value)) {
      const found = findRecipeNode(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function textOf(value: Json): string | null {
  if (typeof value === "string") return stripTags(value) || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(textOf).filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  }
  if (isRecord(value)) {
    return textOf(value.text ?? value.name ?? value["@value"] ?? null);
  }
  return null;
}

/** Instructions come as a string, a list of HowToStep, or sections of steps. */
function collectSteps(value: Json, depth = 0): { text: string; minutes: number | null }[] {
  if (depth > 4) return [];

  if (typeof value === "string") {
    // A single blob: split on sentence-ish boundaries and numbered prefixes.
    return stripTags(value)
      .split(/(?:\r?\n)+|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((part) => part.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter((part) => part.length > 3)
      .map((text) => ({ text, minutes: null }));
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSteps(item, depth + 1));
  }

  if (isRecord(value)) {
    const type = asArray(value["@type"]).find((t) => typeof t === "string") as
      | string
      | undefined;

    if (type?.toLowerCase() === "howtosection") {
      return collectSteps(value.itemListElement ?? value.steps, depth + 1);
    }

    const text = textOf(value.text ?? value.name);
    if (!text) return [];
    return [{ text, minutes: isoDurationToMinutes(value.totalTime) }];
  }

  return [];
}

function parseServings(value: Json): number {
  const text = textOf(value);
  if (!text) return 2;
  const match = text.match(/\d+/);
  if (!match) return 2;
  const parsed = Number(match[0]);
  return parsed > 0 && parsed <= 50 ? Math.round(parsed) : 2;
}

function parseNutritionNumber(value: Json): number {
  const text = textOf(value);
  if (!text) return 0;
  const match = text.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
}

function firstImage(value: Json): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstImage(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) return firstImage(value.url ?? value.contentUrl ?? null);
  return null;
}

export type WebsiteRecipe = {
  recipe: ExtractedRecipe;
  author: string | null;
  thumbnailUrl: string | null;
};

export async function readRecipeWebsite(
  url: string,
): Promise<WebsiteRecipe | null> {
  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  let node: Record<string, Json> | null = null;
  for (const block of blocks) {
    try {
      // Some sites emit trailing commas / CDATA wrappers; ignore what won't parse.
      const cleaned = block[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
      const found = findRecipeNode(JSON.parse(cleaned));
      if (found) {
        node = found;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!node) return null;

  const ingredients = parseIngredients(
    asArray(node.recipeIngredient ?? node.ingredients)
      .map((item) => textOf(item))
      .filter((item): item is string => Boolean(item)),
  );

  const steps = collectSteps(node.recipeInstructions);

  // Without ingredients or steps it is not a usable recipe — fall back to AI.
  if (ingredients.length === 0 || steps.length === 0) return null;

  const nutrition = isRecord(node.nutrition) ? node.nutrition : null;

  const servings = parseServings(node.recipeYield ?? node.yield);

  return {
    recipe: {
      confidence: "high",
      title: textOf(node.name) ?? "Recipe",
      summary: (textOf(node.description) ?? "").slice(0, 200),
      cuisine: textOf(node.recipeCuisine),
      difficulty: "medium",
      servings,
      prep_minutes: isoDurationToMinutes(node.prepTime),
      cook_minutes:
        isoDurationToMinutes(node.cookTime) ?? isoDurationToMinutes(node.totalTime),
      ingredients,
      steps,
      // The site's own figures win; otherwise work it out from the ingredients.
      nutrition_per_serving:
        nutrition && parseNutritionNumber(nutrition.calories) > 0
          ? {
              calories: parseNutritionNumber(nutrition.calories),
              protein_g: parseNutritionNumber(nutrition.proteinContent),
              carbs_g: parseNutritionNumber(nutrition.carbohydrateContent),
              fat_g: parseNutritionNumber(nutrition.fatContent),
            }
          : estimateNutrition(ingredients, servings),
    },
    author:
      textOf(isRecord(node.author) ? node.author.name : node.author) ??
      textOf(node.publisher) ??
      null,
    thumbnailUrl: firstImage(node.image),
  };
}
