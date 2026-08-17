import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Sticker } from "@/components/Brand";
import { getServerUser } from "@/lib/supabase/serverUser";
import { FREE_EXTRACTIONS, PLAN } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getServerUser();
  if (user) redirect("/");

  return (
    <div className="page max-w-sm">
      <Sticker className="h-16 w-auto" />
      <h1 className="h1 mt-6">Create your account</h1>
      <p className="meta mt-2">
        {FREE_EXTRACTIONS} recipes free, then ${PLAN.priceUsd} a month.
      </p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}
