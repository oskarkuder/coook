"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GoogleIcon, Spinner } from "@/components/icons";
import { supabase } from "@/lib/supabase/client";

type Mode = "login" | "signup";

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Only same-origin paths — never redirect to an attacker-supplied host.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google">(null);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  async function withGoogle() {
    setBusy("google");
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(null);
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy("email");
    setError(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setBusy(null);
        return;
      }

      // No session means Supabase is set to confirm addresses first.
      if (!data.session) {
        setCheckInbox(true);
        setBusy(null);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Wrong email or password."
            : signInError.message,
        );
        setBusy(null);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  if (checkInbox) {
    return (
      <div className="card p-6">
        <h2 className="h2">Check your email</h2>
        <p className="meta mt-2">
          We sent a confirmation link to {email}. Open it and you are in.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => void withGoogle()}
        disabled={busy !== null}
      >
        {busy === "google" ? <Spinner /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-sm text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={withEmail}>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="label mt-4" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === "signup" ? (
          <p className="meta mt-2">At least 8 characters.</p>
        ) : null}

        <button
          type="submit"
          className={`mt-6 w-full ${mode === "signup" ? "btn-accent" : "btn-primary"}`}
          disabled={busy !== null}
        >
          {busy === "email" ? <Spinner /> : null}
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <p className="meta mt-6 text-center">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-ink underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="text-ink underline">
              Create one
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
