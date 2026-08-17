"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { RecipePicker } from "@/components/RecipePicker";
import {
  currentWeekStartKey,
  formatDayNumber,
  formatDayName,
  formatWeekRange,
  isToday,
  shiftWeek,
  weekDateKeys,
} from "@/lib/plan/week";
import {
  MEAL_SLOTS,
  type MealPlanEntryWithRecipe,
  type MealSlot,
  type RecipeSummary,
} from "@/lib/types";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function PlanClient({
  weekStart,
  initialEntries,
}: {
  weekStart: string;
  initialEntries: MealPlanEntryWithRecipe[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [picker, setPicker] = useState<string | null>(null);
  const [slot, setSlot] = useState<MealSlot>("dinner");

  const days = weekDateKeys(weekStart);

  async function addEntry(recipe: RecipeSummary) {
    const date = picker;
    if (!date) return;
    setPicker(null);

    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipe_id: recipe.id,
        plan_date: date,
        meal_slot: slot,
        servings: recipe.base_servings || 2,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { entry: MealPlanEntryWithRecipe };
      setEntries((current) => [
        ...current.filter((entry) => entry.id !== data.entry.id),
        data.entry,
      ]);
    }
  }

  async function removeEntry(entryId: string) {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    await fetch(`/api/plan/${entryId}`, { method: "DELETE" });
  }

  async function changeServings(entryId: string, servings: number) {
    const clamped = Math.min(50, Math.max(1, servings));
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId ? { ...entry, servings: clamped } : entry,
      ),
    );
    await fetch(`/api/plan/${entryId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ servings: clamped }),
    });
  }

  /** Opens the picker for a day, defaulting to the first slot still free. */
  function openPicker(date: string) {
    const taken = new Set(
      entries.filter((entry) => entry.plan_date === date).map((e) => e.meal_slot),
    );
    setSlot(MEAL_SLOTS.find((option) => !taken.has(option)) ?? "dinner");
    setPicker(date);
  }

  return (
    <div className="page">
      <div className="flex items-baseline justify-between">
        <h1 className="h1">Meal plan</h1>
        {weekStart !== currentWeekStartKey() ? (
          <Link href="/plan" className="text-sm text-muted hover:text-ink">
            This week
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-line p-1.5">
        <Link
          href={`/plan?week=${shiftWeek(weekStart, -1)}`}
          className="btn-ghost btn-sm"
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <span className="text-[15px] font-medium">{formatWeekRange(weekStart)}</span>
        <Link
          href={`/plan?week=${shiftWeek(weekStart, 1)}`}
          className="btn-ghost btn-sm"
          aria-label="Next week"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </Link>
      </div>

      {/* -------------------------------------------------------- the agenda */}
      <div className="mt-6 divide-y divide-line border-y border-line">
        {days.map((date) => {
          // Keep meals in the order you eat them, not the order they were added.
          const dayEntries = entries
            .filter((entry) => entry.plan_date === date)
            .sort(
              (a, b) =>
                MEAL_SLOTS.indexOf(a.meal_slot) - MEAL_SLOTS.indexOf(b.meal_slot),
            );
          const today = isToday(date);

          return (
            <section key={date} className="py-4">
              <div className="flex items-center gap-2">
                <h2
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    today ? "text-ink" : "text-muted"
                  }`}
                >
                  {formatDayName(date)} {formatDayNumber(date)}
                </h2>
                {today ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-ink">
                    Today
                  </span>
                ) : null}
              </div>

              {dayEntries.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {dayEntries.map((entry) => (
                    // Slot label sits above the title: on a phone, sharing the
                    // row with the steppers left the title barely 120px wide.
                    <li key={entry.id}>
                      <p className="text-xs uppercase tracking-wide text-muted">
                        {SLOT_LABELS[entry.meal_slot]}
                      </p>

                      <div className="mt-0.5 flex items-center gap-3">
                        <Link
                          href={`/recipe/${entry.recipe_id}`}
                          className="min-w-0 flex-1 truncate text-[15px] hover:underline"
                        >
                          {entry.recipe?.title ?? "Recipe"}
                        </Link>

                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg border border-line text-muted hover:text-ink"
                          onClick={() =>
                            void changeServings(entry.id, entry.servings - 1)
                          }
                          aria-label="Fewer servings"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm tabular-nums">
                          {entry.servings}
                        </span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg border border-line text-muted hover:text-ink"
                          onClick={() =>
                            void changeServings(entry.id, entry.servings + 1)
                          }
                          aria-label="More servings"
                        >
                          +
                        </button>
                          <button
                            type="button"
                            className="ml-1 p-2 text-muted hover:text-danger"
                            onClick={() => void removeEntry(entry.id)}
                            aria-label="Remove from plan"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className="mt-2 flex items-center gap-1.5 text-[15px] text-muted hover:text-ink"
                onClick={() => openPicker(date)}
              >
                <PlusIcon className="h-4 w-4" />
                Add a meal
              </button>
            </section>
          );
        })}
      </div>

      <Link
        href={`/shopping?week=${weekStart}`}
        className="card mt-6 flex items-center gap-3 p-4 transition-colors hover:bg-surface"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
          <CartIcon className="h-5 w-5 text-ink" />
        </span>
        <span className="flex-1">
          <span className="block font-medium">Shopping list</span>
          <span className="meta">
            Everything {formatWeekRange(weekStart)} needs, added up.
          </span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
      </Link>

      {picker ? (
        <RecipePicker
          title={`${formatDayName(picker)} ${formatDayNumber(picker)}`}
          onPick={(recipe) => void addEntry(recipe)}
          onCancel={() => setPicker(null)}
          headerExtra={
            <div className="grid grid-cols-3 gap-1.5">
              {MEAL_SLOTS.map((option) => {
                const active = option === slot;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSlot(option)}
                    className={`h-10 rounded-xl border text-sm transition-colors ${
                      active
                        ? "border-ink bg-ink font-medium text-white"
                        : "border-line text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    {SLOT_LABELS[option]}
                  </button>
                );
              })}
            </div>
          }
        />
      ) : null}
    </div>
  );
}
