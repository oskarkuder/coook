import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";
import { isValidDateKey } from "@/lib/plan/week";
import { MEAL_SLOTS, type MealSlot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");

  if (!from || !to || !isValidDateKey(from) || !isValidDateKey(to)) {
    return badRequest("Give a valid from and to date.");
  }

  const entries = await getStore().listPlan(user.id, from, to);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: {
    recipe_id?: string;
    plan_date?: string;
    meal_slot?: MealSlot;
    servings?: number;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const { recipe_id: recipeId, plan_date: planDate, meal_slot: mealSlot } = body;

  if (!recipeId) return badRequest("Pick a recipe.");
  if (!planDate || !isValidDateKey(planDate)) return badRequest("Pick a day.");
  if (!mealSlot || !MEAL_SLOTS.includes(mealSlot)) return badRequest("Pick a meal.");

  const servings =
    Number.isFinite(body.servings) && (body.servings as number) > 0
      ? Math.min(Math.round(body.servings as number), 50)
      : 2;

  const entry = await getStore().upsertPlanEntry(user.id, {
    recipeId,
    planDate,
    mealSlot,
    servings,
  });

  if (!entry) return badRequest("Could not add that to the plan.");
  return NextResponse.json({ entry });
}
