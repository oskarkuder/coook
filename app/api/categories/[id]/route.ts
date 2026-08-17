import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: { name?: string; emoji?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const patch: { name?: string; emoji?: string | null } = {};
  if (body.name !== undefined) {
    const name = body.name.trim().slice(0, 60);
    if (!name) return badRequest("Give the category a name.");
    patch.name = name;
  }
  if (body.emoji !== undefined) {
    patch.emoji = body.emoji?.trim().slice(0, 8) || null;
  }

  if (Object.keys(patch).length === 0) return badRequest("Nothing to update.");

  const ok = await getStore().updateCategory(user.id, id, patch);
  if (!ok) return badRequest("Could not update that category.");

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const ok = await getStore().deleteCategory(user.id, id);
  if (!ok) return badRequest("Could not delete that category.");

  // Recipes themselves are untouched — only the grouping goes away.
  return NextResponse.json({ ok: true });
}
