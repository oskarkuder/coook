import { NextResponse } from "next/server";
import { getApiSession, unauthorized } from "@/lib/api/session";
import { getProfile } from "@/lib/supabase/serverUser";
import { getEntitlement } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  const profile = await getProfile(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
    entitlement: getEntitlement(profile),
  });
}
