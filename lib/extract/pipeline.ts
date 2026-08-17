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
import { parseRecipeText } from "@/lib/extract/parseRecipeText";
import type { ExtractedRecipe } from "@/lib/extract/types";

export type ExtractionErrorCode =
  | "UNSUPPORTED_URL"
  | "NO_SOURCE_TEXT"
  | "NOT_A_RECIPE";

export type ExtractionOutcome =
  | {
      ok: true;
      platform: SourcePlatform;
      url: string;
      metadata: SourceMetadata;
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
 * Two deterministic routes, no model anywhere:
 *
 *   1. Recipe websites publish schema.org/Recipe as JSON-LD — read it exactly.
 *   2. Social captions and pasted text are parsed by rules.
 *
 * When the text does not contain a recipe we say so and ask the user to paste
 * it, rather than inventing one.
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

  // ------------------------------------------------ 1. structured recipe site
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
        recipe: parsed.recipe,
      };
    }
  }

  const metadata = await readSourceMetadata(url, platform);

  // ---------------------------------------------------- 2. text, parsed by rule
  const source = manualText ?? metadata.caption;
  if (!source) {
    return {
      ok: false,
      code: "NO_SOURCE_TEXT",
      message:
        "Nothing could be read from that post — it may be private. Paste the recipe text from the caption and Coook! will lay it out for you.",
      platform,
      url,
      metadata,
    };
  }

  const recipe = parseRecipeText(source, metadata.author);
  if (!recipe) {
    return {
      ok: false,
      code: "NOT_A_RECIPE",
      message:
        "No written recipe found here. Coook! reads recipes that are written out — if the creator only says them out loud, copy the ingredients and steps in and it will do the rest.",
      platform,
      url,
      metadata,
    };
  }

  return { ok: true, platform, url, metadata, recipe };
}
