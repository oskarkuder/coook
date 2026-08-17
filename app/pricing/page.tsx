import Link from "next/link";
import { PlanPicker } from "@/components/PlanPicker";
import { getUserAndProfile } from "@/lib/supabase/serverUser";
import { getEntitlement, FREE_EXTRACTIONS, PLAN } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { user, profile } = await getUserAndProfile();
  const entitlement = getEntitlement(profile);

  return (
    <div className="page max-w-md">
      <h1 className="h1">One plan. That&apos;s it.</h1>
      <p className="meta mt-2">
        {FREE_EXTRACTIONS} recipes free so you can see if it works for you.
      </p>

      <div className="card mt-8 p-6">
        <p className="text-[17px] font-medium">{PLAN.name}</p>

        {!user ? (
          <>
            <ul className="mt-6 space-y-3">
              {PLAN.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[15px]">
                  <span aria-hidden className="text-muted">
                    •
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/signup?next=/pricing" className="btn-accent mt-8 w-full">
              Create an account
            </Link>
          </>
        ) : entitlement.isSubscribed ? (
          <Link href="/account" className="btn-secondary mt-6 w-full">
            You are subscribed — manage it
          </Link>
        ) : (
          <div className="mt-5">
            <PlanPicker />
          </div>
        )}

        <p className="meta mt-4 text-center">Cancel any time.</p>
      </div>
    </div>
  );
}
