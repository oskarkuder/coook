import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 100) || 100, 200);

  try {
    const recipes = await getStore().listRecipes(user.id, {
      savedOnly: params.get("saved") === "1",
      search: params.get("q")?.trim() || undefined,
      limit,
    });
    return NextResponse.json({ recipes });
  } catch {
    return badRequest("Could not load recipes.");
  }
}
