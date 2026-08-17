import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest, serverError } from "@/lib/api/session";
import { getStore } from "@/lib/data";
import { getEntitlement } from "@/lib/entitlements";
import { extractRecipe } from "@/lib/extract/pipeline";
import { detectPlatform, normalizeSourceUrl } from "@/lib/extract/sourceUrl";
import { DEMO_SAMPLE_EXTRACTION, isDemoMode } from "@/lib/demo";

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
    // Demo mode with no OpenAI key: hand back a sample so the whole flow —
    // progress, recipe page, scaling, plan, shopping list — is clickable.
    // Recipe sites are exempt: that path is pure JSON-LD parsing, so it works
    // with no key and should show the real thing.
    const needsAi = detectPlatform(normalized) !== "website";
    if (needsAi && isDemoMode() && !process.env.OPENAI_API_KEY?.trim()) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await store.markRecipeReady(user.id, recipeId, {
        platform: detectPlatform(normalized),
        url: normalized,
        author: "demo",
        thumbnailUrl: null,
        caption: manualText,
        transcript: null,
        title: DEMO_SAMPLE_EXTRACTION.title,
        summary: DEMO_SAMPLE_EXTRACTION.summary,
        cuisine: DEMO_SAMPLE_EXTRACTION.cuisine,
        difficulty: DEMO_SAMPLE_EXTRACTION.difficulty,
        servings: DEMO_SAMPLE_EXTRACTION.servings,
        prepMinutes: DEMO_SAMPLE_EXTRACTION.prep_minutes,
        cookMinutes: DEMO_SAMPLE_EXTRACTION.cook_minutes,
        ingredients: DEMO_SAMPLE_EXTRACTION.ingredients,
        steps: DEMO_SAMPLE_EXTRACTION.steps,
        nutrition: DEMO_SAMPLE_EXTRACTION.nutrition_per_serving,
        confidence: DEMO_SAMPLE_EXTRACTION.confidence,
      });
      return NextResponse.json({ id: recipeId, reused: false, demo: true });
    }

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

    await store.markRecipeReady(user.id, recipeId, {
      platform: outcome.platform,
      url: outcome.url,
      author: metadata.author,
      thumbnailUrl: metadata.thumbnailUrl,
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
      code: "PROVIDER_ERROR",
      message: "Something broke while reading the video. Try again.",
      platform: detectPlatform(normalized),
      url: normalized,
    });
    return serverError("Something broke while reading the video.");
  }
}
