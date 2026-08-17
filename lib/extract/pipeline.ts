import "server-only";
import type { SourcePlatform } from "@/lib/types";
import {
  detectPlatform,
  isSupportedPlatform,
  normalizeSourceUrl,
  resolveShortLink,
} from "@/lib/extract/sourceUrl";
import { readSourceMetadata, type SourceMetadata } from "@/lib/extract/metadata";
import { transcribeMedia } from "@/lib/extract/transcribe";
import { structureRecipe, type StructuredRecipe } from "@/lib/extract/structure";
import { readRecipeWebsite } from "@/lib/extract/website";

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
      recipe: StructuredRecipe;
    }
  | {
      ok: false;
      code: ExtractionErrorCode;
      message: string;
      platform: SourcePlatform;
      url: string;
      metadata: SourceMetadata | null;
    };

const MEASUREMENT = /\b\d+([.,]\d+)?\s?(g|kg|mg|ml|l|dl|tsp|tbsp|cup|cups|oz|lb|clove|cloves|slice|slices|can|cans)\b/gi;

/**
 * A caption that already lists amounts does not need the audio. Anything
 * thinner and we spend the extra few seconds on transcription.
 */
function captionLooksComplete(caption: string | null): boolean {
  if (!caption) return false;
  const text = caption.trim();
  if (text.length < 180) return false;

  const measurements = text.match(MEASUREMENT)?.length ?? 0;
  const lines = text.split(/\n/).filter((line) => line.trim()).length;

  return measurements >= 4 && lines >= 4;
}

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
      message: "That does not look like a link. Paste the full video URL.",
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
        "Coook! reads TikTok, Instagram and YouTube links, or any recipe website. Paste one of those.",
      platform,
      url,
      metadata: null,
    };
  }

  // Recipe sites publish schema.org/Recipe as JSON-LD. When it is there we get
  // the author's exact amounts for free — no model call, nothing invented.
  if (platform === "website" && !manualText) {
    const parsed = await readRecipeWebsite(url);
    if (parsed) {
      return {
        ok: true,
        platform,
        url,
        metadata: {
          platform,
          url,
          caption: null,
          author: parsed.author,
          thumbnailUrl: parsed.thumbnailUrl,
          mediaUrl: null,
        },
        transcript: null,
        recipe: parsed.recipe,
      };
    }
  }

  const metadata = await readSourceMetadata(url, platform);

  let transcript: string | null = null;
  const needsAudio = !manualText && !captionLooksComplete(metadata.caption);
  if (needsAudio && metadata.mediaUrl) {
    transcript = await transcribeMedia(metadata.mediaUrl, url);
  }

  const hasSource = Boolean(metadata.caption || transcript || manualText);
  if (!hasSource) {
    return {
      ok: false,
      code: "NO_SOURCE_TEXT",
      message:
        "This post is private or blocked, so nothing could be read from it. Paste the recipe text from the caption and Coook! will do the rest.",
      platform,
      url,
      metadata,
    };
  }

  let recipe: StructuredRecipe;
  try {
    recipe = await structureRecipe({
      caption: metadata.caption,
      transcript,
      manualText,
      platform,
      author: metadata.author,
    });
  } catch (error) {
    console.error("structureRecipe failed", error);
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      message: "The recipe reader is having a moment. Try again in a few seconds.",
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
        "No recipe found in that video. Make sure the post actually shows food being made.",
      platform,
      url,
      metadata,
    };
  }

  return { ok: true, platform, url, metadata, transcript, recipe };
}
