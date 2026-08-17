import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Sticker } from "@/components/Brand";
import { getServerUser } from "@/lib/supabase/serverUser";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getServerUser();
  if (user) redirect("/");

  return (
    <div className="page max-w-sm">
      <Sticker className="h-16 w-auto" />
      <h1 className="h1 mt-6">Sign in</h1>
      <p className="meta mt-2">Welcome back.</p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
