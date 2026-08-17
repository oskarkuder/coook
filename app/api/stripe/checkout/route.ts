import { NextResponse } from "next/server";
import { getApiSession, unauthorized, serverError } from "@/lib/api/session";
import { getProfile } from "@/lib/supabase/serverUser";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeServerClient, getPriceIdFor } from "@/lib/stripe/server";
import { isBillingPeriod } from "@/lib/entitlements";
import { isSubscribed } from "@/lib/entitlements";
import { getAppOrigin } from "@/lib/appOrigin";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Demo mode — Stripe is switched off. The demo user is already on the paid plan.", code: "DEMO" },
      { status: 400 },
    );
  }

  let period: "monthly" | "yearly" = "monthly";
  try {
    const body = (await request.json()) as { period?: unknown };
    if (isBillingPeriod(body.period)) period = body.period;
  } catch {
    // No body is fine — monthly is the default.
  }

  try {
    const profile = await getProfile(user.id);
    if (isSubscribed(profile)) {
      return NextResponse.json(
        { error: "You are already subscribed.", code: "ALREADY_SUBSCRIBED" },
        { status: 409 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = getAppOrigin(request.url);

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const admin = createSupabaseAdmin();
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getPriceIdFor(period), quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
    });

    if (!session.url) return serverError("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("checkout failed", error);
    return serverError("Could not start checkout.");
  }
}
