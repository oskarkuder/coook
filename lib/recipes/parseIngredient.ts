import type { Ingredient } from "@/lib/types";

/**
 * Turns "1 1/2 cups plain flour, sifted" into structured form.
 *
 * Recipe sites give ingredients as single strings, so this is what lets a
 * website import produce the same shape as an AI extraction — with no model
 * call, no cost and no invention.
 */

const VULGAR: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/** Canonical unit -> every spelling seen in the wild. */
const UNITS: [string, string[]][] = [
  ["g", ["g", "gram", "grams", "gr", "gramme", "grammes"]],
  ["kg", ["kg", "kilo", "kilos", "kilogram", "kilograms"]],
  ["mg", ["mg", "milligram", "milligrams"]],
  ["ml", ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "cc"]],
  ["l", ["l", "liter", "liters", "litre", "litres"]],
  ["dl", ["dl", "deciliter", "deciliters"]],
  ["tsp", ["tsp", "tsps", "teaspoon", "teaspoons", "t"]],
  ["tbsp", ["tbsp", "tbsps", "tablespoon", "tablespoons", "tbs", "tbl", "T"]],
  ["cup", ["cup", "cups", "c"]],
  ["oz", ["oz", "ounce", "ounces"]],
  ["lb", ["lb", "lbs", "pound", "pounds"]],
  ["pint", ["pint", "pints", "pt"]],
  ["quart", ["quart", "quarts", "qt"]],
  ["clove", ["clove", "cloves"]],
  ["slice", ["slice", "slices"]],
  ["piece", ["piece", "pieces", "pcs", "pc"]],
  ["can", ["can", "cans", "tin", "tins"]],
  ["jar", ["jar", "jars"]],
  ["pack", ["pack", "packs", "packet", "packets", "package", "packages"]],
  ["bunch", ["bunch", "bunches"]],
  ["sprig", ["sprig", "sprigs"]],
  ["stick", ["stick", "sticks"]],
  ["pinch", ["pinch", "pinches"]],
  ["dash", ["dash", "dashes"]],
  ["handful", ["handful", "handfuls"]],
  ["head", ["head", "heads"]],
  ["stalk", ["stalk", "stalks"]],
];

const UNIT_LOOKUP = new Map<string, string>();
for (const [canonical, spellings] of UNITS) {
  for (const spelling of spellings) UNIT_LOOKUP.set(spelling.toLowerCase(), canonical);
}

/**
 * Words that are preparation, not part of the ingredient's name.
 * Sorted longest-first so "finely chopped" wins over "chopped" — otherwise
 * "onion finely chopped" splits into "onion finely" + "chopped".
 */
const NOTE_LEADERS = [
  "chopped", "finely chopped", "roughly chopped", "coarsely chopped",
  "diced", "finely diced", "minced", "sliced", "thinly sliced", "finely sliced",
  "grated", "finely grated", "shredded", "crushed", "crumbled", "skinned",
  "peeled", "trimmed", "melted", "softened", "room temperature",
  "at room temperature", "beaten", "lightly beaten", "divided", "plus more",
  "to taste", "to serve", "for garnish", "for frying", "for drizzling",
  "optional", "drained", "rinsed", "drained and rinsed", "cooked", "uncooked",
  "fresh", "frozen", "halved", "quartered", "cubed", "julienned", "zested",
  "juiced", "toasted", "seeded", "deseeded", "torn", "smashed", "stemmed",
  "washed", "well beaten", "cut into chunks", "cut into wedges",
].sort((a, b) => b.length - a.length);

function parseNumberToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Single vulgar fraction, possibly attached to a whole number: "1½"
  const vulgarMatch = trimmed.match(/^(\d*)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (vulgarMatch) {
    const whole = vulgarMatch[1] ? Number(vulgarMatch[1]) : 0;
    return whole + (VULGAR[vulgarMatch[2]] ?? 0);
  }

  // "1 1/2" and "3/4"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  // Plain or decimal, comma or dot: "1,5" / "1.5"
  const plain = trimmed.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(plain)) return Number(plain);

  return null;
}

/** Leading quantity, handling ranges ("2-3") and "1 1/2" by taking the lower. */
function takeQuantity(text: string): { quantity: number | null; rest: string } {
  const cleaned = text.replace(/^[\s•\-–—*]+/, "");

  const pattern =
    /^((?:\d+\s+\d+\s*\/\s*\d+)|(?:\d+\s*\/\s*\d+)|(?:\d*\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])|(?:\d+(?:[.,]\d+)?))/;
  const match = cleaned.match(pattern);
  if (!match) return { quantity: null, rest: cleaned };

  let rest = cleaned.slice(match[0].length);
  const quantity = parseNumberToken(match[0]);

  // "2-3 cloves" / "2 to 3": use the smaller, then drop the upper bound.
  const range = rest.match(
    /^\s*(?:-|–|—|to)\s*((?:\d+\s*\/\s*\d+)|(?:\d+(?:[.,]\d+)?))/i,
  );
  if (range) rest = rest.slice(range[0].length);

  return { quantity, rest };
}

function takeUnit(text: string): { unit: string | null; rest: string } {
  const cleaned = text.replace(/^[\s.]+/, "");
  const match = cleaned.match(/^([a-zA-Z]+)\.?\b/);
  if (!match) return { unit: null, rest: cleaned };

  const canonical = UNIT_LOOKUP.get(match[1].toLowerCase());
  if (!canonical) return { unit: null, rest: cleaned };

  return { unit: canonical, rest: cleaned.slice(match[0].length) };
}

function splitNote(text: string): { name: string; note: string | null } {
  // "2 x 400g cans tomatoes" — drop the multiplier so the name starts cleanly.
  const trimmed = text.trim().replace(/^x\s+/i, "").replace(/^of\s+/i, "");

  // Anything in brackets is a note: "flour (plain)"
  const bracket = trimmed.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (bracket) {
    return { name: bracket[1].trim(), note: bracket[2].trim() || null };
  }

  // Everything after the first comma is usually preparation.
  const comma = trimmed.indexOf(",");
  if (comma > 0) {
    return {
      name: trimmed.slice(0, comma).trim(),
      note: trimmed.slice(comma + 1).trim() || null,
    };
  }

  // "flour, sifted" without the comma: "sifted flour" stays as-is, but a
  // trailing preparation word is worth lifting out.
  const lower = trimmed.toLowerCase();
  for (const leader of NOTE_LEADERS) {
    if (lower.endsWith(` ${leader}`)) {
      return {
        name: trimmed.slice(0, trimmed.length - leader.length - 1).trim(),
        note: leader,
      };
    }
  }

  return { name: trimmed, note: null };
}

export function parseIngredient(line: string): Ingredient | null {
  const text = line
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!text) return null;

  const { quantity, rest: afterQuantity } = takeQuantity(text);
  const { unit, rest: afterUnit } = takeUnit(afterQuantity);
  const { name, note } = splitNote(afterUnit);

  // No name left means the line was junk ("For the sauce:"), not an ingredient.
  if (!name) return null;

  return {
    name: name.replace(/[.,;:]+$/, "").trim(),
    quantity,
    unit,
    note,
  };
}

export function parseIngredients(lines: string[]): Ingredient[] {
  return lines
    .map((line) => parseIngredient(line))
    .filter((item): item is Ingredient => item !== null && item.name.length > 0);
}

/** ISO-8601 duration ("PT1H30M") to minutes, which is what recipes use. */
export function isoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const total = days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : null;
}
