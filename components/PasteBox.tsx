"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { SubscribeButton } from "@/components/SubscribeButton";
import { PLAN } from "@/lib/entitlements";

type Status = "idle" | "working" | "error" | "paywall" | "needs-text";

/** Shown one after another while the request is in flight. */
const STAGES = ["Opening the link", "Reading the recipe", "Laying it out"];

const STAGE_MS = 1200;

export function PasteBox({
  initialUrl = "",
  autoStart = false,
  freeRemaining,
  isSubscribed,
}: {
  initialUrl?: string;
  autoStart?: boolean;
  freeRemaining: number;
  isSubscribed: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [manualText, setManualText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const startedRef = useRef(false);

  const submit = useCallback(
    async (extraText?: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setStatus("error");
        setMessage("Paste a video link first.");
        return;
      }

      setStatus("working");
      setMessage(null);
      setStage(0);

      try {
        const response = await fetch("/api/recipes/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: trimmed,
            manualText: extraText?.trim() || undefined,
          }),
        });

        const data = (await response.json()) as {
          id?: string;
          error?: string;
          code?: string;
        };

        if (response.ok && data.id) {
          router.push(`/recipe/${data.id}`);
          return;
        }

        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/?url=${trimmed}`)}`);
          return;
        }

        if (response.status === 402) {
          setStatus("paywall");
          return;
        }

        // Both mean the same thing to the user: nothing written to read, so
        // offer the box that lets them supply it.
        if (data.code === "NO_SOURCE_TEXT" || data.code === "NOT_A_RECIPE") {
          setStatus("needs-text");
          setMessage(data.error ?? null);
          return;
        }

        setStatus("error");
        setMessage(data.error ?? "That did not work. Try another link.");
      } catch {
        setStatus("error");
        setMessage("Could not reach the server. Check your connection.");
      }
    },
    [router, url],
  );

  // Advance the progress copy so a 20-second wait does not feel frozen.
  useEffect(() => {
    if (status !== "working") return;
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, STAGE_MS);
    return () => clearInterval(timer);
  }, [status]);

  // Arriving from a share sheet: start immediately, no extra tap.
  useEffect(() => {
    if (!autoStart || !initialUrl || startedRef.current) return;
    startedRef.current = true;
    void submit();
  }, [autoStart, initialUrl, submit]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setStatus("idle");
        setMessage(null);
      }
    } catch {
      setMessage("Your browser blocked the clipboard. Paste with a long press.");
      setStatus("error");
    }
  }

  if (status === "working") {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-ink" />
          <p className="text-[17px] font-medium">{STAGES[stage]}…</p>
        </div>
        <div className="mt-5 space-y-2">
          {STAGES.map((label, index) => (
            <div
              key={label}
              className={`flex items-center gap-2 text-sm ${
                index <= stage ? "text-ink" : "text-muted"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  index <= stage ? "bg-ink" : "bg-line"
                }`}
              />
              {label}
            </div>
          ))}
        </div>
        <p className="meta mt-5">This only takes a few seconds.</p>
      </div>
    );
  }

  if (status === "paywall") {
    return (
      <div className="card p-6">
        <h2 className="h2">You have used your free recipes</h2>
        <p className="meta mt-2">
          Subscribe to keep turning videos into recipes. ${PLAN.priceUsd} a month,
          cancel any time.
        </p>
        <ul className="mt-4 space-y-2">
          {PLAN.features.map((feature) => (
            <li key={feature} className="flex gap-2 text-[15px]">
              <span aria-hidden className="text-muted">
                •
              </span>
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <SubscribeButton />
        </div>
        <button
          type="button"
          className="btn-ghost mt-2 w-full"
          onClick={() => setStatus("idle")}
        >
          Not now
        </button>
      </div>
    );
  }

  if (status === "needs-text") {
    return (
      <div className="card p-6">
        <h2 className="h2">Couldn&apos;t read that post</h2>
        <p className="meta mt-2">
          {message ??
            "Coook! reads recipes that are written out. Copy the ingredients and steps in and it will lay them out for you."}
        </p>
        <textarea
          className="textarea mt-4 min-h-40"
          placeholder="Paste the caption or the ingredient list here…"
          value={manualText}
          onChange={(event) => setManualText(event.target.value)}
        />
        <button
          type="button"
          className="btn-accent mt-4 w-full"
          disabled={!manualText.trim()}
          onClick={() => void submit(manualText)}
        >
          Make the recipe
        </button>
        <button
          type="button"
          className="btn-ghost mt-2 w-full"
          onClick={() => {
            setStatus("idle");
            setManualText("");
          }}
        >
          Try a different link
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="label" htmlFor="video-url">
          Paste the link to a cooking video
        </label>
        <div className="flex gap-2">
          <input
            id="video-url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://www.tiktok.com/..."
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (status === "error") setStatus("idle");
            }}
          />
          <button
            type="button"
            className="btn-secondary shrink-0 px-4"
            onClick={() => void pasteFromClipboard()}
          >
            Paste
          </button>
        </div>

        <button type="submit" className="btn-accent mt-3 w-full" disabled={!url.trim()}>
          Get the recipe
        </button>
      </form>

      {status === "error" && message ? (
        <p className="mt-3 text-sm text-danger">{message}</p>
      ) : null}

      <p className="meta mt-3">
        {isSubscribed
          ? "TikTok, Instagram, YouTube — or any recipe website."
          : freeRemaining > 0
            ? `${freeRemaining} free ${freeRemaining === 1 ? "recipe" : "recipes"} left, then $${PLAN.priceUsd}/month.`
            : `Free recipes used up — $${PLAN.priceUsd}/month for unlimited.`}
      </p>
    </div>
  );
}
