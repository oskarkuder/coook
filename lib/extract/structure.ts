import "server-only";
import type { ExtractedRecipe } from "@/lib/extract/types";

type ModelRecipe = ExtractedRecipe & { is_recipe: boolean };

const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_recipe",
    "confidence",
    "title",
    "summary",
    "cuisine",
    "difficulty",
    "servings",
    "prep_minutes",
    "cook_minutes",
    "ingredients",
    "steps",
    "nutrition_per_serving",
  ],
  properties: {
    is_recipe: {
      type: "boolean",
      description: "False if the source is not a cooking recipe at all.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    title: { type: "string", description: "Short dish name, no emoji, no hashtags." },
    summary: { type: "string", description: "One sentence, max 140 characters." },
    cuisine: { type: ["string", "null"] },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    servings: {
      type: "integer",
      description: "How many servings the listed quantities make.",
    },
    prep_minutes: { type: ["integer", "null"] },
    cook_minutes: { type: ["integer", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "note"],
        properties: {
          name: {
            type: "string",
            description: "Ingredient only, e.g. 'chicken thighs'. No amount here.",
          },
          quantity: {
            type: ["number", "null"],
            description: "Numeric amount, null when the video never says one.",
          },
          unit: {
            type: ["string", "null"],
            description: "g, ml, tbsp, tsp, cup, clove, piece… null if countless.",
          },
          note: {
            type: ["string", "null"],
            description: "Prep note such as 'finely chopped'.",
          },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "minutes"],
        properties: {
          text: { type: "string", description: "One clear imperative instruction." },
          minutes: { type: ["integer", "null"] },
        },
      },
    },
    nutrition_per_serving: {
      type: "object",
      additionalProperties: false,
      required: ["calories", "protein_g", "carbs_g", "fat_g"],
      properties: {
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You turn short-form cooking videos into precise, cookable recipes.

You receive the post caption and, when available, a transcript of the spoken audio. Together they are your only source.

Rules:
- If PUBLISHED RECIPE DATA is present it is the source of truth: copy its amounts, units and steps exactly, and do not round or reword them. Use the other sections only to fill gaps.
- Otherwise reconstruct the full recipe from the caption and transcript: every ingredient with a numeric amount and unit, and every step in order.
- If an amount is only implied, estimate a sensible one for the stated serving count rather than leaving it null. Use null only when an amount genuinely makes no sense ("salt to taste").
- Normalise units to common cooking units: g, kg, ml, l, tsp, tbsp, cup, piece, clove, slice, can.
- Strip hashtags, emoji, calls to follow, and brand plugs from the title and steps.
- Steps must be instructions a cook can follow, not narration. Merge trivial fragments; split multi-action sentences.
- Estimate calories and macros PER SERVING from the ingredients. Be realistic — an honest estimate is more useful than a round number.
- Set confidence to "low" when you had to invent much of the detail, "high" when the source spelled the recipe out.
- Set is_recipe to false if the content is not food preparation. When false, still return the other fields with empty or zero values.
- Answer in English regardless of the source language.`;

function model(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

/** Keeps token spend predictable on captions that are 90% hashtags. */
function clamp(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export async function structureRecipe(input: {
  caption: string | null;
  transcript: string | null;
  manualText: string | null;
  /** Exact recipe markup from a recipe site, when the page published it. */
  structuredSource: string | null;
  platform: string;
  author: string | null;
}): Promise<ModelRecipe> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");

  const sections = [
    `Platform: ${input.platform}`,
    input.structuredSource
      ? `--- PUBLISHED RECIPE DATA (authoritative, copy amounts exactly) ---\n${clamp(input.structuredSource, 8000)}`
      : "",
    input.author ? `Creator: ${input.author}` : "",
    input.caption ? `--- POST CAPTION ---\n${clamp(input.caption, 6000)}` : "",
    input.transcript
      ? `--- AUDIO TRANSCRIPT ---\n${clamp(input.transcript, 14000)}`
      : "",
    input.manualText
      ? `--- TEXT PASTED BY THE USER ---\n${clamp(input.manualText, 6000)}`
      : "",
  ].filter(Boolean);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sections.join("\n\n") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recipe",
          strict: true,
          schema: RECIPE_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const body = await response.text();
    // Out of credit is a billing problem, not a blip — retrying never fixes it,
    // so mark it so the caller can say something useful.
    if (response.status === 429 && body.includes("insufficient_quota")) {
      throw new Error("OPENAI_NO_CREDIT");
    }
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
  };

  const message = payload.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`Model refused: ${message.refusal}`);

  const content = message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");

  return normalise(JSON.parse(content) as ModelRecipe);
}

/** Defends the UI against a model that returns something slightly off-spec. */
function normalise(recipe: ModelRecipe): ModelRecipe {
  const servings =
    Number.isFinite(recipe.servings) && recipe.servings > 0
      ? Math.min(Math.round(recipe.servings), 50)
      : 2;

  return {
    ...recipe,
    servings,
    title: recipe.title?.trim() || "Untitled recipe",
    summary: recipe.summary?.trim() || "",
    ingredients: (recipe.ingredients ?? [])
      .filter((item) => item?.name?.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity:
          typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? item.quantity
            : null,
        unit: item.unit?.trim() || null,
        note: item.note?.trim() || null,
      })),
    steps: (recipe.steps ?? [])
      .filter((step) => step?.text?.trim())
      .map((step) => ({
        text: step.text.trim(),
        minutes:
          typeof step.minutes === "number" && Number.isFinite(step.minutes)
            ? step.minutes
            : null,
      })),
    nutrition_per_serving: {
      calories: Math.max(0, Math.round(recipe.nutrition_per_serving?.calories ?? 0)),
      protein_g: Math.max(0, Math.round(recipe.nutrition_per_serving?.protein_g ?? 0)),
      carbs_g: Math.max(0, Math.round(recipe.nutrition_per_serving?.carbs_g ?? 0)),
      fat_g: Math.max(0, Math.round(recipe.nutrition_per_serving?.fat_g ?? 0)),
    },
  };
}
