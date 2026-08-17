import type { Profile } from "@/lib/types";

/** Recipes a signed-in user can extract before the paywall closes. */
export const FREE_EXTRACTIONS = 2;

export type BillingPeriod = "monthly" | "yearly";

export const PLAN = {
  name: "Coook! Unlimited",
  /** Kept for copy that predates the yearly option. */
  priceUsd: 10,
  interval: "month",
  features: [
    "Unlimited recipes from videos and recipe sites",
    "Ingredient scaling for any number of servings",
    "Calories and macros per serving",
    "Weekly meal plan and shopping list",
    "The cooking assistant, step by step",
  ],
} as const;

export const PRICES: Record<
  BillingPeriod,
  { label: string; price: string; per: string; note: string }
> = {
  monthly: {
    label: "Monthly",
    price: "$10",
    per: "per month",
    note: "Cancel any time.",
  },
  yearly: {
    label: "Yearly",
    price: "€30",
    per: "per year",
    note: "Works out at €2.50 a month.",
  },
};

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isSubscribed(profile: Profile | null | undefined): boolean {
  if (!profile?.subscription_status) return false;
  return ACTIVE_STATUSES.has(profile.subscription_status);
}

export function freeRemaining(profile: Profile | null | undefined): number {
  const used = profile?.free_extractions_used ?? 0;
  return Math.max(0, FREE_EXTRACTIONS - used);
}

export type Entitlement = {
  isSubscribed: boolean;
  freeRemaining: number;
  canExtract: boolean;
};

export function getEntitlement(
  profile: Profile | null | undefined,
): Entitlement {
  const subscribed = isSubscribed(profile);
  const remaining = freeRemaining(profile);
  return {
    isSubscribed: subscribed,
    freeRemaining: remaining,
    canExtract: subscribed || remaining > 0,
  };
}
