import { NextResponse } from "next/server";
import { getApiSession, unauthorized, serverError, badRequest } from "@/lib/api/session";
import { getProfile } from "@/lib/supabase/serverUser";
import { getStripeServerClient } from "@/lib/stripe/server";
import { getAppOrigin } from "@/lib/appOrigin";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  if (isDemoMode()) {
    return badRequest("Demo mode — there is no real Stripe customer to manage.");
  }

  const profile = await getProfile(user.id);
  if (!profile?.stripe_customer_id) {
    return badRequest("No billing account yet.");
  }

  try {
    const stripe = getStripeServerClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppOrigin(request.url)}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("portal failed", error);
    return serverError("Could not open the billing portal.");
  }
}
