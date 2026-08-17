"use client";

import { useState } from "react";
import { CheckIcon, Spinner } from "@/components/icons";
import {
  addDays,
  formatDayName,
  formatDayNumber,
  toDateKey,
} from "@/lib/plan/week";
import { MEAL_SLOTS, type MealSlot } from "@/lib/types";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** The next 7 days starting today — the only window people plan in practice. */
function upcomingDays(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(today, index)));
}

export function AddToPlan({
  recipeId,
  defaultServings,
  onClose,
}: {
  recipeId: string;
  defaultServings: number;
  onClose: () => void;
}) {
  const days = upcomingDays();
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [servings, setServings] = useState(defaultServings);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          plan_date: day,
          meal_slot: slot,
          servings,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not add to the plan.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setTimeout(onClose, 900);
    } catch {
      setError("Could not reach the server.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="card flex items-center gap-2 p-5">
        <CheckIcon className="h-5 w-5 text-ok" />
        <p className="font-medium">Added to your plan</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="h2">Add to plan</h3>

      <p className="label mt-5">Day</p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((dateKey) => {
          const active = dateKey === day;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setDay(dateKey)}
              className={`flex flex-col items-center rounded-xl border py-2 text-xs transition-colors ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              <span>{formatDayName(dateKey)}</span>
              <span className="mt-0.5 text-[15px] font-medium">
                {formatDayNumber(dateKey)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="label mt-5">Meal</p>
      <div className="grid grid-cols-3 gap-1.5">
        {MEAL_SLOTS.map((option) => {
          const active = option === slot;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setSlot(option)}
              className={`h-11 rounded-xl border text-sm transition-colors ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {SLOT_LABELS[option]}
            </button>
          );
        })}
      </div>

      <p className="label mt-5">Servings</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary h-11 w-11 px-0 text-xl"
          onClick={() => setServings((value) => Math.max(1, value - 1))}
          aria-label="Fewer servings"
        >
          −
        </button>
        <span className="w-10 text-center text-lg font-medium tabular-nums">
          {servings}
        </span>
        <button
          type="button"
          className="btn-secondary h-11 w-11 px-0 text-xl"
          onClick={() => setServings((value) => Math.min(50, value + 1))}
          aria-label="More servings"
        >
          +
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => void add()}
          disabled={status === "saving"}
        >
          {status === "saving" ? <Spinner /> : null}
          Add to plan
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
