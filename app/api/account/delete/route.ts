import { NextResponse } from "next/server";
import { getApiSession, unauthorized, serverError } from "@/lib/api/session";
import { getProfile } from "@/lib/supabase/serverUser";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes the auth user; recipes, plan entries and the profile follow via
 * "on delete cascade". Any live subscription is cancelled first so the user
 * is never billed for an account that no longer exists.
 */
export async function POST() {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Demo mode — there is no real account to delete." },
      { status: 400 },
    );
  }

  const profile = await getProfile(user.id);

  if (profile?.stripe_subscription_id) {
    try {
      const stripe = getStripeServerClient();
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (error) {
      // A already-cancelled subscription must not block account deletion.
      console.error("subscription cancel during delete failed", error);
    }
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete failed", error);
    return serverError("Could not delete the account.");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
