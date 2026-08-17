"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { supabase } from "@/lib/supabase/client";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not open billing.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => void open()}
        disabled={loading}
      >
        {loading ? <Spinner /> : null}
        Manage subscription
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <p className="meta mt-2">
        Change your card or cancel. Cancelling keeps access until the period ends.
      </p>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="btn-secondary w-full"
      onClick={() => void signOut()}
      disabled={loading}
    >
      {loading ? <Spinner /> : null}
      Sign out
    </button>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not delete the account.");
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn-danger w-full"
        onClick={() => setConfirming(true)}
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="card border-danger/30 p-4">
      <p className="font-medium">Delete your account?</p>
      <p className="meta mt-1">
        Every recipe, your meal plan and your shopping list go with it. Any
        active subscription is cancelled. This cannot be undone.
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-danger flex-1"
          onClick={() => void remove()}
          disabled={loading}
        >
          {loading ? <Spinner /> : null}
          Yes, delete everything
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
