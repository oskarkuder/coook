import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest, serverError } from "@/lib/api/session";
import { getStore } from "@/lib/data";
import { getEntitlement } from "@/lib/entitlements";
import { extractRecipe } from "@/lib/extract/pipeline";
import { detectPlatform, normalizeSourceUrl } from "@/lib/extract/sourceUrl";
import { persistThumbnail } from "@/lib/images/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Caption fetch + transcription + structuring; comfortably inside 60s. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: { url?: string; manualText?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const rawUrl = body.url?.trim();
  const manualText = body.manualText?.trim() || null;
  if (!rawUrl) return badRequest("Paste a video link first.");

  const normalized = normalizeSourceUrl(rawUrl);
  if (!normalized) return badRequest("That does not look like a link.");

  const store = getStore();

  // Re-pasting a link you already turned into a recipe is free and instant.
  if (!manualText) {
    const existingId = await store.findReadyRecipeByUrl(user.id, normalized);
    if (existingId) return NextResponse.json({ id: existingId, reused: true });
  }

  const profile = await store.getProfile(user.id);
  const entitlement = getEntitlement(profile);
  if (!entitlement.canExtract) {
    return NextResponse.json(
      { error: "You have used your free recipes.", code: "PAYWALL" },
      { status: 402 },
    );
  }

  let recipeId: string;
  try {
    recipeId = await store.createProcessingRecipe(user.id, normalized);
  } catch (error) {
    console.error("recipe insert failed", error);
    return serverError("Could not start the recipe.");
  }

  try {
    const outcome = await extractRecipe({ rawUrl: normalized, manualText });

    if (!outcome.ok) {
      await store.markRecipeFailed(user.id, recipeId, {
        code: outcome.code,
        message: outcome.message,
        platform: outcome.platform,
        url: outcome.url,
        author: outcome.metadata?.author ?? null,
        thumbnailUrl: outcome.metadata?.thumbnailUrl ?? null,
        caption: outcome.metadata?.caption ?? null,
      });

      return NextResponse.json(
        { id: recipeId, error: outcome.message, code: outcome.code },
        { status: 422 },
      );
    }

    const { recipe, metadata } = outcome;

    // Keep our own copy — platform CDN URLs are signed and expire.
    const thumbnailUrl = await persistThumbnail(
      metadata.thumbnailUrl,
      user.id,
      recipeId,
      outcome.url,
    );

    await store.markRecipeReady(user.id, recipeId, {
      platform: outcome.platform,
      url: outcome.url,
      author: metadata.author,
      thumbnailUrl,
      caption: metadata.caption,
      transcript: outcome.transcript,
      title: recipe.title,
      summary: recipe.summary,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      prepMinutes: recipe.prep_minutes,
      cookMinutes: recipe.cook_minutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      nutrition: recipe.nutrition_per_serving,
      confidence: recipe.confidence,
    });

    // Only a successful extraction costs a free credit.
    if (!entitlement.isSubscribed) {
      await store.incrementFreeExtractions(user.id);
    }

    return NextResponse.json({ id: recipeId, reused: false });
  } catch (error) {
    console.error("extraction crashed", error);
    await store.markRecipeFailed(user.id, recipeId, {
      code: "READ_FAILED",
      message: "Something broke while reading that link. Try again.",
      platform: detectPlatform(normalized),
      url: normalized,
    });
    return serverError("Something broke while reading the video.");
  }
}
