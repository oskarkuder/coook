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

  const recipe = await getStore().getRecipe(user.id, id);
  if (!recipe) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ recipe });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: { is_saved?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  if (typeof body.is_saved !== "boolean") return badRequest("Nothing to update.");

  const ok = await getStore().setRecipeSaved(user.id, id, body.is_saved);
  if (!ok) return badRequest("Could not update that recipe.");

  return NextResponse.json({ recipe: { id, is_saved: body.is_saved } });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const ok = await getStore().deleteRecipe(user.id, id);
  if (!ok) return badRequest("Could not delete that recipe.");

  return NextResponse.json({ ok: true });
}
