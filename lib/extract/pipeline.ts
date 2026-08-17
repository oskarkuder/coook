import "server-only";
import type { SourcePlatform } from "@/lib/types";
import {
  detectPlatform,
  isSupportedPlatform,
  normalizeSourceUrl,
  resolveShortLink,
} from "@/lib/extract/sourceUrl";
import { readSourceMetadata, type SourceMetadata } from "@/lib/extract/metadata";
import { readRecipeWebsite } from "@/lib/extract/website";
import { transcribeMedia } from "@/lib/extract/transcribe";
import { structureRecipe } from "@/lib/extract/structure";
import { estimateNutrition } from "@/lib/recipes/nutrition";
import type { ExtractedRecipe } from "@/lib/extract/types";

export type ExtractionErrorCode =
  | "UNSUPPORTED_URL"
  | "NO_SOURCE_TEXT"
  | "NOT_A_RECIPE"
  | "PROVIDER_ERROR";

export type ExtractionOutcome =
  | {
      ok: true;
      platform: SourcePlatform;
      url: string;
      metadata: SourceMetadata;
      transcript: string | null;
      recipe: ExtractedRecipe;
    }
  | {
      ok: false;
      code: ExtractionErrorCode;
      message: string;
      platform: SourcePlatform;
      url: string;
      metadata: SourceMetadata | null;
    };

/**
 * One path for every link, so the result is consistent whatever you paste:
 * gather everything the source offers — published recipe markup, the caption,
 * and a transcript of the audio — then structure it in a single pass.
 *
 * The audio is always transcribed when it can be reached, which is what makes
 * "paste the link and it just works" true for videos where the creator only
 * says the recipe out loud.
 */
export async function extractRecipe(input: {
  rawUrl: string;
  manualText?: string | null;
}): Promise<ExtractionOutcome> {
  const manualText = input.manualText?.trim() || null;

  const normalized = normalizeSourceUrl(input.rawUrl);
  if (!normalized) {
    return {
      ok: false,
      code: "UNSUPPORTED_URL",
      message: "That does not look like a link. Paste the full URL.",
      platform: "unknown",
      url: input.rawUrl,
      metadata: null,
    };
  }

  const url = await resolveShortLink(normalized);
  const platform = detectPlatform(url);

  if (!isSupportedPlatform(platform) && !manualText) {
    return {
      ok: false,
      code: "UNSUPPORTED_URL",
      message:
        "Coook! reads TikTok, Instagram and YouTube links, or any recipe website.",
      platform,
      url,
      metadata: null,
    };
  }

  // ------------------------------------------------ published recipe markup
  // Recipe sites state their amounts exactly. We still run the model, but hand
  // it this as the source of truth so nothing gets rounded or reworded.
  let structuredSource: string | null = null;
  let websiteAuthor: string | null = null;
  let websiteThumbnail: string | null = null;

  if (platform === "website") {
    const parsed = await readRecipeWebsite(url);
    if (parsed) {
      structuredSource = JSON.stringify({
        title: parsed.recipe.title,
        servings: parsed.recipe.servings,
        prep_minutes: parsed.recipe.prep_minutes,
        cook_minutes: parsed.recipe.cook_minutes,
        ingredients: parsed.recipe.ingredients,
        steps: parsed.recipe.steps,
        nutrition_per_serving: parsed.recipe.nutrition_per_serving,
      });
      websiteAuthor = parsed.author;
      websiteThumbnail = parsed.thumbnailUrl;
    }
  }

  const metadata = await readSourceMetadata(url, platform);
  if (websiteAuthor && !metadata.author) metadata.author = websiteAuthor;
  if (websiteThumbnail && !metadata.thumbnailUrl) {
    metadata.thumbnailUrl = websiteThumbnail;
  }

  // ----------------------------------------------------------- transcription
  // Always, when there is media to read — this is the whole point of "just
  // paste the link". Failure here is not fatal; the caption may carry it.
  let transcript: string | null = null;
  if (metadata.mediaUrl && !manualText) {
    transcript = await transcribeMedia(metadata.mediaUrl, url);
  }

  const hasSource = Boolean(
    structuredSource || metadata.caption || transcript || manualText,
  );
  if (!hasSource) {
    return {
      ok: false,
      code: "NO_SOURCE_TEXT",
      message:
        "Nothing could be read from that post — it may be private, or the platform blocked us. Paste the recipe text and Coook! will lay it out.",
      platform,
      url,
      metadata,
    };
  }

  let recipe: ExtractedRecipe & { is_recipe: boolean };
  try {
    recipe = await structureRecipe({
      caption: metadata.caption,
      transcript,
      manualText,
      structuredSource,
      platform,
      author: metadata.author,
    });
  } catch (error) {
    console.error("structureRecipe failed", error);
    const noCredit =
      error instanceof Error && error.message === "OPENAI_NO_CREDIT";
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      message: noCredit
        ? "The recipe reader is out of credit. Top up the OpenAI account and this will work again."
        : "The recipe reader is having a moment. Try again in a few seconds.",
      platform,
      url,
      metadata,
    };
  }

  if (!recipe.is_recipe || recipe.ingredients.length === 0) {
    return {
      ok: false,
      code: "NOT_A_RECIPE",
      message:
        "No recipe found in that post. Make sure it actually shows food being made.",
      platform,
      url,
      metadata,
    };
  }

  // The model estimates nutrition; fall back to the built-in food table if it
  // declined to, so the panel is not empty for no reason.
  const nutrition =
    recipe.nutrition_per_serving && recipe.nutrition_per_serving.calories > 0
      ? recipe.nutrition_per_serving
      : estimateNutrition(recipe.ingredients, recipe.servings);

  return {
    ok: true,
    platform,
    url,
    metadata,
    transcript,
    recipe: { ...recipe, nutrition_per_serving: nutrition },
  };
}
