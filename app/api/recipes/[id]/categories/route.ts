import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const store = getStore();
  const [categories, selected] = await Promise.all([
    store.listCategories(user.id),
    store.getRecipeCategoryIds(user.id, id),
  ]);

  return NextResponse.json({ categories, selected });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: { category_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const categoryIds = Array.isArray(body.category_ids)
    ? body.category_ids.filter((value) => typeof value === "string").slice(0, 100)
    : [];

  const ok = await getStore().setRecipeCategories(user.id, id, categoryIds);
  if (!ok) return badRequest("Could not update categories.");

  return NextResponse.json({ ok: true, selected: categoryIds });
}
