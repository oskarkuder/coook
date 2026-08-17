import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DeleteAccountButton,
  ManageBillingButton,
  SignOutButton,
} from "@/components/AccountActions";
import { SubscribeButton } from "@/components/SubscribeButton";
import { getUserAndProfile } from "@/lib/supabase/serverUser";
import { getEntitlement, FREE_EXTRACTIONS, PLAN } from "@/lib/entitlements";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login?next=/account");

  const entitlement = getEntitlement(profile);
  const periodEnd = formatDate(profile?.subscription_current_period_end ?? null);

  return (
    <div className="page">
      <h1 className="h1">Account</h1>

      {checkout === "success" ? (
        <div className="card mt-6 p-4">
          <p className="font-medium text-ok">Subscription active</p>
          <p className="meta mt-1">
            Thanks. Unlimited recipes are on. If it still says free below, give
            the page a few seconds and refresh — Stripe is confirming.
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="h2">Signed in as</h2>
        <p className="mt-2 text-[17px]">{user.email}</p>
      </section>

      <section className="mt-8">
        <h2 className="h2">Plan</h2>

        {entitlement.isSubscribed ? (
          <div className="card mt-3 p-5">
            <p className="text-[17px] font-medium">{PLAN.name}</p>
            <p className="meta mt-1">
              ${PLAN.priceUsd} a month.{" "}
              {profile?.cancel_at_period_end
                ? `Ends on ${periodEnd}.`
                : periodEnd
                  ? `Renews on ${periodEnd}.`
                  : ""}
            </p>
            <div className="mt-5">
              <ManageBillingButton />
            </div>
          </div>
        ) : (
          <div className="card mt-3 p-5">
            <p className="text-[17px] font-medium">Free</p>
            <p className="meta mt-1">
              {entitlement.freeRemaining} of {FREE_EXTRACTIONS} free recipes
              left. Subscribe for unlimited.
            </p>
            <ul className="mt-4 space-y-2">
              {PLAN.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[15px]">
                  <span aria-hidden className="text-muted">
                    •
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <SubscribeButton />
            </div>
          </div>
        )}
      </section>

      {isDemoMode() ? (
        <section className="mt-8">
          <h2 className="h2">Session</h2>
          <p className="meta mt-2">
            Signing out and deleting the account need a real Supabase project.
            Turn demo mode off and those controls appear here.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-8 space-y-3">
            <h2 className="h2">Session</h2>
            <SignOutButton />
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="h2">Danger zone</h2>
            <DeleteAccountButton />
          </section>
        </>
      )}

      <section className="mt-12">
        <div className="flex gap-4 text-sm text-muted">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </div>
      </section>
    </div>
  );
}
