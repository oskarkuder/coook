"use client";

import { useState } from "react";
import { SubscribeButton } from "@/components/SubscribeButton";
import { PLAN, PRICES, type BillingPeriod } from "@/lib/entitlements";

/** Monthly / yearly toggle plus the matching checkout button. */
export function PlanPicker() {
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const chosen = PRICES[period];

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-line p-1">
        {(Object.keys(PRICES) as BillingPeriod[]).map((option) => {
          const active = option === period;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              aria-pressed={active}
              className={`flex-1 rounded-lg py-2 text-[15px] transition-colors ${
                active ? "bg-ink font-medium text-white" : "text-muted hover:text-ink"
              }`}
            >
              {PRICES[option].label}
              {option === "yearly" ? (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                    active ? "bg-accent text-ink" : "bg-accent-soft text-ink"
                  }`}
                >
                  Best value
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-5">
        <span className="text-[34px] font-semibold tracking-tight">
          {chosen.price}
        </span>
        <span className="text-muted"> {chosen.per}</span>
      </p>
      <p className="meta mt-1">{chosen.note}</p>

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

      <div className="mt-8">
        <SubscribeButton period={period} />
      </div>
    </div>
  );
}
