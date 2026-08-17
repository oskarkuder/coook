import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/stripe/server";
import { isDemoMode } from "@/lib/demo";
import { resolverProvider } from "@/lib/extract/resolvers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Config preflight. Hit this right after a deploy and it tells you exactly
 * what is missing or broken, instead of finding out from a user whose import
 * failed. Guarded by CRON_SECRET so it is not a public inventory of your setup.
 *
 *   curl -H "authorization: Bearer $CRON_SECRET" https://your-domain/api/health
 */

type Check = { name: string; ok: boolean; detail: string };

function present(name: string): Check {
  const value = process.env[name]?.trim();
  return {
    name,
    ok: Boolean(value),
    detail: value ? "set" : "MISSING",
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const checks: Check[] = [
    present("NEXT_PUBLIC_SUPABASE_URL"),
    present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    present("SUPABASE_SERVICE_ROLE_KEY"),
    present("NEXT_PUBLIC_APP_ORIGIN"),
    present("OPENAI_API_KEY"),
    present("STRIPE_SECRET_KEY"),
    present("STRIPE_WEBHOOK_SECRET"),
    present("STRIPE_PRICE_MONTHLY"),
    present("STRIPE_PRICE_YEARLY"),
  ];

  checks.push({
    name: "demo_mode",
    ok: !isDemoMode(),
    detail: isDemoMode()
      ? "ON — set NEXT_PUBLIC_DEMO_MODE=0 for production"
      : "off",
  });

  const provider = resolverProvider();
  checks.push({
    name: "media_resolver",
    ok: Boolean(provider),
    detail: provider
      ? `${provider}`
      : "none — speech-only videos will fail from a datacenter IP",
  });

  // ------------------------------------------------------- live connectivity
  try {
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("profiles").select("id").limit(1);
    checks.push({
      name: "supabase",
      ok: !error,
      detail: error ? error.message : "reachable, profiles readable",
    });

    const { error: bucketError } = await admin.storage
      .from("recipe-images")
      .list("", { limit: 1 });
    checks.push({
      name: "storage_bucket",
      ok: !bucketError,
      detail: bucketError
        ? `${bucketError.message} — run 0004_recipe_images.sql`
        : "recipe-images present",
    });
  } catch (error) {
    checks.push({
      name: "supabase",
      ok: false,
      detail: error instanceof Error ? error.message : "failed",
    });
  }

  try {
    const stripe = getStripeServerClient();
    const monthly = process.env.STRIPE_PRICE_MONTHLY?.trim();
    const yearly = process.env.STRIPE_PRICE_YEARLY?.trim();
    for (const [label, id] of [
      ["stripe_price_monthly", monthly],
      ["stripe_price_yearly", yearly],
    ] as const) {
      if (!id) continue;
      const price = await stripe.prices.retrieve(id);
      checks.push({
        name: label,
        ok: price.active,
        detail: `${(price.unit_amount ?? 0) / 100} ${price.currency.toUpperCase()} / ${price.recurring?.interval ?? "one-off"}${price.active ? "" : " — INACTIVE"}`,
      });
    }
  } catch (error) {
    checks.push({
      name: "stripe",
      ok: false,
      detail: error instanceof Error ? error.message : "failed",
    });
  }

  try {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      checks.push({
        name: "openai",
        ok: response.ok,
        detail: response.ok
          ? "key valid"
          : `${response.status} — ${response.status === 429 ? "out of credit" : "check the key"}`,
      });
    }
  } catch (error) {
    checks.push({
      name: "openai",
      ok: false,
      detail: error instanceof Error ? error.message : "failed",
    });
  }

  const failing = checks.filter((check) => !check.ok);
  return NextResponse.json(
    { ok: failing.length === 0, failing: failing.length, checks },
    { status: failing.length === 0 ? 200 : 503 },
  );
}
