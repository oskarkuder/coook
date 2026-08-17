"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { PRICES, type BillingPeriod } from "@/lib/entitlements";

export function SubscribeButton({
  className = "btn-accent w-full",
  label,
  period = "monthly",
}: {
  className?: string;
  label?: string;
  period?: BillingPeriod;
}) {
  const text = label ?? `Subscribe — ${PRICES[period].price} ${PRICES[period].per}`;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period }),
      });

      if (response.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }

      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className={className} onClick={start} disabled={loading}>
        {loading ? <Spinner /> : null}
        {loading ? "Opening checkout…" : text}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
