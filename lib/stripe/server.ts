import "server-only";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-07-29.dahlia";

let stripeSingleton: Stripe | null = null;

export function getStripeServerClient(): Stripe {
  if (stripeSingleton) return stripeSingleton;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY.");

  stripeSingleton = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return stripeSingleton;
}

export function getMonthlyPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_MONTHLY?.trim();
  if (!priceId) throw new Error("Missing STRIPE_PRICE_MONTHLY.");
  return priceId;
}

export function getPriceIdFor(period: "monthly" | "yearly"): string {
  if (period === "monthly") return getMonthlyPriceId();

  const priceId = process.env.STRIPE_PRICE_YEARLY?.trim();
  if (!priceId) throw new Error("Missing STRIPE_PRICE_YEARLY.");
  return priceId;
}

/**
 * Newer Stripe API versions moved the billing period onto the subscription
 * item. Read from there, falling back to the legacy top-level field.
 */
export function getPeriodEndIso(
  subscription: Stripe.Subscription,
): string | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const legacy = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  const seconds = fromItem ?? legacy;
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}
