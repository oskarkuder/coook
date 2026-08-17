import { isDemoMode } from "@/lib/demo";

/** Impossible-to-miss reminder that nothing here is being saved for real. */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-line bg-accent-soft">
      <p className="mx-auto max-w-wide px-5 py-2 text-[13px] text-ink">
        <span className="font-medium">Demo mode.</span> Signed in as a fake user,
        data lives in memory and resets when the server restarts. Stripe is off.
        Set <code className="font-mono">NEXT_PUBLIC_DEMO_MODE=0</code> to use the
        real Supabase.
      </p>
    </div>
  );
}
