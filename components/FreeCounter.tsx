import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { FREE_EXTRACTIONS, PLAN, type Entitlement } from "@/lib/entitlements";

/**
 * Always-visible answer to "how many do I have left?". Pips rather than a bar —
 * with an allowance of 2, a bar reads as a rounding error.
 */
export function FreeCounter({
  entitlement,
  compact = false,
}: {
  entitlement: Entitlement;
  compact?: boolean;
}) {
  if (entitlement.isSubscribed) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">
          <CheckIcon className="h-3.5 w-3.5" />
          Unlimited
        </span>
      );
    }
    return (
      <div className="card flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
          <CheckIcon className="h-5 w-5 text-ink" />
        </span>
        <div>
          <p className="font-medium">Unlimited recipes</p>
          <p className="meta">{PLAN.name} is active.</p>
        </div>
      </div>
    );
  }

  const used = FREE_EXTRACTIONS - entitlement.freeRemaining;
  const left = entitlement.freeRemaining;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs">
        <Pips used={used} />
        <span className="font-medium">{left} left</span>
      </span>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {left > 0
              ? `${left} free ${left === 1 ? "recipe" : "recipes"} left`
              : "Free recipes used up"}
          </p>
          <p className="meta mt-0.5">
            {left > 0
              ? `${used} of ${FREE_EXTRACTIONS} used. Then $${PLAN.priceUsd} a month.`
              : `Subscribe for unlimited — $${PLAN.priceUsd} a month.`}
          </p>
        </div>
        <Pips used={used} size="lg" />
      </div>

      <Link
        href="/pricing"
        className={`mt-4 w-full ${left > 0 ? "btn-secondary" : "btn-accent"}`}
      >
        {left > 0 ? "See the plan" : `Subscribe — $${PLAN.priceUsd}/month`}
      </Link>
    </div>
  );
}

function Pips({ used, size = "sm" }: { used: number; size?: "sm" | "lg" }) {
  const dot = size === "lg" ? "h-3 w-3" : "h-2 w-2";
  return (
    <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
      {Array.from({ length: FREE_EXTRACTIONS }, (_, index) => (
        <span
          key={index}
          className={`${dot} rounded-full ${index < used ? "bg-line" : "bg-accent"}`}
        />
      ))}
    </span>
  );
}
