import "server-only";
import type Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPeriodEndIso } from "@/lib/stripe/server";

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

/**
 * Writes Stripe's view of the subscription onto the profile. The webhook is the
 * single source of truth for `subscription_status` — nothing else sets it.
 */
export async function syncSubscriptionToProfile(
  subscription: Stripe.Subscription,
): Promise<void> {
  const admin = createSupabaseAdmin();
  const customerId = customerIdOf(subscription);

  let profileId: string | null =
    subscription.metadata?.supabase_user_id ?? null;

  if (!profileId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    profileId = (data?.id as string | undefined) ?? null;
  }

  if (!profileId) {
    console.error("No profile for Stripe customer", customerId);
    return;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_current_period_end: getPeriodEndIso(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    })
    .eq("id", profileId);

  if (error) console.error("profile subscription sync failed", error);
}
