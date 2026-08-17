"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import {
  formatIngredient,
  formatMinutes,
  totalTimeMinutes,
} from "@/lib/recipes/scale";
import { stepHasUsefulTimer } from "@/lib/recipes/timers";
import { ingredientsForStep } from "@/lib/recipes/stepIngredients";
import type { Recipe } from "@/lib/types";

/** Short beep so a timer can finish while you are across the kitchen. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.start();
    osc.stop(ctx.currentTime + 0.95);
  } catch {
    // Audio is a nicety — never let it break the timer.
  }
}

export function CookAssistant({
  recipe,
  servings,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}) {
  const steps = recipe.steps;
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  // Nobody starts cooking without checking they have everything first.
  const [started, setStarted] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const stepIngredients = step
    ? ingredientsForStep(step, recipe.ingredients)
    : [];

  // ------------------------------------------------------------ wake lock
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    let sentinel: WakeLock | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLock> };
    };

    const acquire = async () => {
      try {
        sentinel = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        // Unsupported or denied — the screen just dims as usual.
      }
    };
    void acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  // Lock background scroll while the assistant owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ---------------------------------------------------------------- timer
  useEffect(() => {
    if (!timerRunning || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      setTimerRunning(false);
      beep();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, secondsLeft]);

  // Reset the timer whenever the step changes.
  useEffect(() => {
    const timed = step && stepHasUsefulTimer(step);
    setSecondsLeft(timed && step.minutes ? step.minutes * 60 : null);
    setTimerRunning(false);
  }, [index, step]);

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current >= steps.length - 1) {
        setDone(true);
        return current;
      }
      return current + 1;
    });
  }, [steps.length]);

  const goBack = useCallback(() => {
    setDone(false);
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // ------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goBack();
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const progress = done
    ? 100
    : !started
      ? 0
      : ((index + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ------------------------------------------------------------ header */}
      <div className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-content items-center justify-between px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{recipe.title}</p>
            <p className="text-xs text-muted">
              {done
                ? "Finished"
                : !started
                  ? "Before you start"
                  : `Step ${index + 1} of ${steps.length}`}{" "}
              · {servings} servings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-muted hover:text-ink"
            aria-label="Close cooking mode"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="h-1 w-full bg-line">
          <div
            className="h-1 bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-content px-5 py-8">
          {!done && !started ? (
            <div>
              <h2 className="text-[22px] font-medium leading-snug md:text-[26px]">
                Get everything out first
              </h2>
              <p className="meta mt-2">
                Everything below is scaled to {servings}{" "}
                {servings === 1 ? "serving" : "servings"}.
                {totalTimeMinutes(recipe.prep_minutes, recipe.cook_minutes) > 0
                  ? ` About ${formatMinutes(totalTimeMinutes(recipe.prep_minutes, recipe.cook_minutes))} in total.`
                  : ""}
              </p>

              <ul className="card mt-5 divide-y divide-line">
                {recipe.ingredients.map((ingredient, i) => {
                  const line = formatIngredient(
                    ingredient,
                    recipe.base_servings,
                    servings,
                  );
                  return (
                    <li key={i} className="flex gap-3 p-4">
                      <span className="w-24 shrink-0 font-medium tabular-nums">
                        {line.amount || "—"}
                      </span>
                      <span className="flex-1">
                        {line.name}
                        {line.note ? (
                          <span className="text-muted">, {line.note}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className="btn-accent mt-6 w-full"
                onClick={() => setStarted(true)}
              >
                Start cooking — {steps.length} steps
              </button>
            </div>
          ) : done ? (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <CheckIcon className="h-8 w-8 text-ink" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                That&apos;s it — enjoy.
              </h2>
              <p className="meta mt-2">
                {recipe.title} for {servings}.
              </p>
              <button type="button" className="btn-accent mt-8 w-full" onClick={onClose}>
                Done
              </button>
              <button
                type="button"
                className="btn-ghost mt-2 w-full"
                onClick={() => {
                  setDone(false);
                  setIndex(steps.length - 1);
                }}
              >
                Back to the last step
              </button>
            </div>
          ) : (
            <>
              <p className="text-[22px] font-medium leading-snug md:text-[26px]">
                {step?.text}
              </p>

              {secondsLeft !== null ? (
                <div className="card mt-6 flex items-center justify-between p-4">
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">
                      {Math.floor(secondsLeft / 60)}:
                      {String(secondsLeft % 60).padStart(2, "0")}
                    </p>
                    <p className="meta mt-0.5">
                      {step?.minutes ? formatMinutes(step.minutes) : ""} for this step
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setSecondsLeft(step?.minutes ? step.minutes * 60 : 0);
                        setTimerRunning(false);
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="btn-accent btn-sm"
                      onClick={() => setTimerRunning((running) => !running)}
                    >
                      {timerRunning ? "Pause" : secondsLeft > 0 ? "Start" : "Done"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* ------------------------------ what this step needs */}
              {stepIngredients.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    For this step
                  </p>
                  <ul className="card mt-2 divide-y divide-line">
                    {stepIngredients.map((ingredient, i) => {
                      const line = formatIngredient(
                        ingredient,
                        recipe.base_servings,
                        servings,
                      );
                      return (
                        <li key={i} className="flex gap-3 px-4 py-2.5 text-[15px]">
                          <span className="w-24 shrink-0 font-medium tabular-nums">
                            {line.amount || "—"}
                          </span>
                          <span>{line.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                className="mt-4 text-sm text-muted hover:text-ink"
                onClick={() => setShowIngredients((open) => !open)}
              >
                {showIngredients ? "Hide" : "Show"} all ingredients (
                {recipe.ingredients.length})
              </button>
              {showIngredients ? (
                <ul className="card mt-3 divide-y divide-line">
                  {recipe.ingredients.map((ingredient, i) => {
                    const line = formatIngredient(
                      ingredient,
                      recipe.base_servings,
                      servings,
                    );
                    return (
                      <li key={i} className="flex gap-3 px-4 py-2.5 text-[15px]">
                        <span className="w-24 shrink-0 font-medium tabular-nums">
                          {line.amount || "—"}
                        </span>
                        <span>{line.name}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ footer */}
      {!done && started ? (
        <div className="border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex w-full max-w-content gap-2 px-5 py-3">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={goBack}
              disabled={index === 0}
            >
              Back
            </button>
            <button type="button" className="btn-accent flex-[2]" onClick={goNext}>
              {index === steps.length - 1 ? "Finish" : "Next step"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
