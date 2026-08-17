import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";
import { isValidDateKey } from "@/lib/plan/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const weekStart = new URL(request.url).searchParams.get("week");
  if (!weekStart || !isValidDateKey(weekStart)) return badRequest("Bad week.");

  const state = await getStore().getShopping(user.id, weekStart);
  return NextResponse.json({ state });
}

export async function PUT(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: {
    week_start?: string;
    checked_keys?: string[];
    extra_items?: { key: string; name: string }[];
    extra_recipes?: { recipe_id: string; servings: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const weekStart = body.week_start;
  if (!weekStart || !isValidDateKey(weekStart)) return badRequest("Bad week.");

  const checkedKeys = Array.isArray(body.checked_keys)
    ? body.checked_keys.filter((key) => typeof key === "string").slice(0, 500)
    : [];

  const extraItems = Array.isArray(body.extra_items)
    ? body.extra_items
        .filter(
          (item) =>
            item &&
            typeof item.key === "string" &&
            typeof item.name === "string" &&
            item.name.trim().length > 0,
        )
        .map((item) => ({ key: item.key, name: item.name.trim().slice(0, 120) }))
        .slice(0, 200)
    : [];

  const extraRecipes = Array.isArray(body.extra_recipes)
    ? body.extra_recipes
        .filter((item) => item && typeof item.recipe_id === "string")
        .map((item) => ({
          recipe_id: item.recipe_id,
          servings:
            Number.isFinite(item.servings) && item.servings > 0
              ? Math.min(Math.round(item.servings), 50)
              : 2,
        }))
        .slice(0, 100)
    : [];

  const state = await getStore().putShopping(
    user.id,
    weekStart,
    checkedKeys,
    extraItems,
    extraRecipes,
  );

  return NextResponse.json({ state });
}
