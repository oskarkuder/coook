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

  let body: { servings?: number };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  if (!Number.isFinite(body.servings) || (body.servings as number) <= 0) {
    return badRequest("Servings must be a positive number.");
  }

  const servings = Math.min(Math.round(body.servings as number), 50);
  const ok = await getStore().updatePlanServings(user.id, id, servings);
  if (!ok) return badRequest("Could not update that meal.");

  return NextResponse.json({ entry: { id, servings } });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const ok = await getStore().deletePlanEntry(user.id, id);
  if (!ok) return badRequest("Could not remove that meal.");

  return NextResponse.json({ ok: true });
}
