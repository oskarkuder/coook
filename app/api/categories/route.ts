import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const categories = await getStore().listCategories(user.id);
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: { name?: string; emoji?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const name = body.name?.trim().slice(0, 60);
  if (!name) return badRequest("Give the category a name.");

  const emoji = body.emoji?.trim().slice(0, 8) || null;

  const category = await getStore().createCategory(user.id, name, emoji);
  if (!category) return badRequest("You already have a category with that name.");

  return NextResponse.json({ category });
}
