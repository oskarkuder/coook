"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecipePicker } from "@/components/RecipePicker";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { buildShoppingList } from "@/lib/shopping/aggregate";
import { aisleFor, sortAisles, type Aisle } from "@/lib/shopping/aisles";
import { formatDayName, formatWeekRange, shiftWeek } from "@/lib/plan/week";
import type {
  MealPlanEntryWithRecipe,
  RecipeSummary,
  ShoppingItem,
  ShoppingState,
} from "@/lib/types";

export function ShoppingClient({
  weekStart,
  entries: plannedEntries,
  extraEntries,
  initialShopping,
}: {
  weekStart: string;
  entries: MealPlanEntryWithRecipe[];
  extraEntries: MealPlanEntryWithRecipe[];
  initialShopping: ShoppingState;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<string[]>(initialShopping.checked_keys);
  const [extras, setExtras] = useState(initialShopping.extra_items);
  const [extraRecipes, setExtraRecipes] = useState(initialShopping.extra_recipes);
  const [newItem, setNewItem] = useState("");
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  /** null = everything on the list. Otherwise a single entry id. */
  const [mealFilter, setMealFilter] = useState<string | null>(null);

  const checkedSet = useMemo(() => new Set(checked), [checked]);

  /** Servings live in state, so the +/- steppers rescale without a round trip. */
  const addedEntries = useMemo(
    () =>
      extraEntries.map((entry) => ({
        ...entry,
        servings:
          extraRecipes.find((extra) => extra.recipe_id === entry.recipe_id)
            ?.servings ?? entry.servings,
      })),
    [extraEntries, extraRecipes],
  );

  const entries = useMemo(
    () => [...plannedEntries, ...addedEntries],
    [plannedEntries, addedEntries],
  );

  const activeMeal = entries.find((entry) => entry.id === mealFilter) ?? null;
  // A stale filter (meal deleted elsewhere) must not strand you on an empty list.
  const effectiveFilter = activeMeal ? mealFilter : null;

  const visibleEntries = useMemo(
    () =>
      effectiveFilter
        ? entries.filter((entry) => entry.id === effectiveFilter)
        : entries,
    [entries, effectiveFilter],
  );

  const items = useMemo(
    // Your own added items belong to the week, not to any one meal.
    () => buildShoppingList(visibleEntries, effectiveFilter ? [] : extras),
    [visibleEntries, extras, effectiveFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<Aisle, ShoppingItem[]>();
    for (const item of items) {
      const aisle = item.manual ? "Other" : aisleFor(item.name);
      const list = map.get(aisle);
      if (list) list.push(item);
      else map.set(aisle, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => sortAisles(a, b));
  }, [items]);

  const bought = items.filter((item) => checkedSet.has(item.key)).length;
  const total = items.length;
  const progress = total ? (bought / total) * 100 : 0;

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void fetch("/api/shopping", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart,
          checked_keys: checked,
          extra_items: extras,
          extra_recipes: extraRecipes,
        }),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [checked, extras, extraRecipes, weekStart]);

  /** Persist immediately, then re-render so the server sends the ingredients. */
  async function commitExtraRecipes(
    next: { recipe_id: string; servings: number }[],
  ) {
    setExtraRecipes(next);
    await fetch("/api/shopping", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        week_start: weekStart,
        checked_keys: checked,
        extra_items: extras,
        extra_recipes: next,
      }),
    });
    router.refresh();
  }

  function addRecipe(recipe: RecipeSummary) {
    setPicking(false);
    setMealFilter(null);
    if (extraRecipes.some((extra) => extra.recipe_id === recipe.id)) return;
    void commitExtraRecipes([
      ...extraRecipes,
      { recipe_id: recipe.id, servings: recipe.base_servings || 2 },
    ]);
  }

  function removeRecipe(recipeId: string) {
    void commitExtraRecipes(
      extraRecipes.filter((extra) => extra.recipe_id !== recipeId),
    );
  }

  function changeRecipeServings(recipeId: string, servings: number) {
    const clamped = Math.min(50, Math.max(1, servings));
    setExtraRecipes((current) =>
      current.map((extra) =>
        extra.recipe_id === recipeId ? { ...extra, servings: clamped } : extra,
      ),
    );
  }

  function toggle(key: string) {
    setChecked((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function addManual(event: React.FormEvent) {
    event.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    setExtras((current) => [
      ...current,
      { key: `manual:${name.toLowerCase()}:${Date.now()}`, name },
    ]);
    setNewItem("");
    setMealFilter(null); // so the thing you just typed is actually visible
  }

  function removeManual(key: string) {
    setExtras((current) => current.filter((item) => item.key !== key));
    setChecked((current) => current.filter((item) => item !== key));
  }

  async function copyList() {
    const text = grouped
      .map(([aisle, list]) => {
        const lines = list
          .filter((item) => !checkedSet.has(item.key))
          .map(
            (item) =>
              `- ${item.name}${item.amounts.length ? ` (${item.amounts.join(" + ")})` : ""}`,
          );
        return lines.length ? `${aisle}\n${lines.join("\n")}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text || "Nothing left to buy.");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — nothing useful to do here.
    }
  }

  return (
    <div className="page">
      <Link href="/plan" className="text-sm text-muted hover:text-ink">
        ← Meal plan
      </Link>

      <h1 className="h1 mt-3">Shopping</h1>
      <p className="meta mt-2">
        Everything your planned meals need, added up and scaled.
      </p>

      {/* ------------------------------------------------------- week nav */}
      <div className="mt-5 flex items-center justify-between rounded-xl border border-line p-1.5">
        <Link
          href={`/shopping?week=${shiftWeek(weekStart, -1)}`}
          className="btn-ghost btn-sm"
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <span className="text-[15px] font-medium">{formatWeekRange(weekStart)}</span>
        <Link
          href={`/shopping?week=${shiftWeek(weekStart, 1)}`}
          className="btn-ghost btn-sm"
          aria-label="Next week"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </Link>
      </div>

      {/* --------------------------------------------------- meal filters */}
      {entries.length > 0 ? (
        <div className="no-scrollbar -mx-5 mt-4 overflow-x-auto px-5">
          <div className="flex w-max gap-2 pb-1">
            <button
              type="button"
              onClick={() => setMealFilter(null)}
              aria-pressed={!effectiveFilter}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                !effectiveFilter
                  ? "border-ink bg-ink font-medium text-white"
                  : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              All meals ({entries.length})
            </button>

            {entries.map((entry) => {
              const on = effectiveFilter === entry.id;
              const added = entry.id.startsWith("extra:");
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMealFilter(on ? null : entry.id)}
                  aria-pressed={on}
                  className={`max-w-[15rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-ink bg-ink font-medium text-white"
                      : "border-line text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {added ? "Added" : formatDayName(entry.plan_date)} ·{" "}
                  {entry.recipe?.title ?? "Recipe"}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-ink hover:text-ink"
            >
              <PlusIcon className="h-4 w-4" />
              Add a recipe
            </button>
          </div>
        </div>
      ) : null}

      {/* An unmissable way out of a filtered view. */}
      {activeMeal ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-accent-soft p-3">
          <p className="flex-1 text-sm">
            Showing only{" "}
            <strong className="font-medium">
              {activeMeal.recipe?.title ?? "this meal"}
            </strong>{" "}
            ({formatDayName(activeMeal.plan_date)}, {activeMeal.meal_slot},{" "}
            {activeMeal.servings} servings)
          </p>
          <button
            type="button"
            onClick={() => setMealFilter(null)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-line hover:bg-surface"
          >
            <CloseIcon className="h-4 w-4" />
            Show all
          </button>
        </div>
      ) : null}

      {/* -------------------------------------------------------- progress */}
      {total > 0 ? (
        <div className="card mt-4 p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-medium">
              {total - bought > 0
                ? `${total - bought} still to buy`
                : "All done — nice one"}
            </p>
            <p className="meta">
              {bought} of {total}
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- list */}
      {total === 0 ? (
        <div className="card mt-6 p-6">
          <p className="font-medium">Nothing on the list</p>
          <p className="meta mt-1">
            Pull in any recipe from your library, or plan the week and every
            ingredient lands here automatically.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-accent sm:w-52"
              onClick={() => setPicking(true)}
            >
              <PlusIcon className="h-5 w-5" />
              Add a recipe
            </button>
            <Link href="/plan" className="btn-secondary sm:w-52">
              Plan this week
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map(([aisle, list]) => (
            <section key={aisle}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {aisle}
              </h2>
              <ul className="card divide-y divide-line">
                {list.map((item) => {
                  const isChecked = checkedSet.has(item.key);
                  return (
                    <li key={item.key} className="flex items-start">
                      <label className="flex flex-1 cursor-pointer items-start gap-3 p-4">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isChecked
                              ? "border-ink bg-ink text-white"
                              : "border-line"
                          }`}
                        >
                          {isChecked ? <CheckIcon className="h-4 w-4" /> : null}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isChecked}
                          onChange={() => toggle(item.key)}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-[15px] ${
                              isChecked ? "text-muted line-through" : ""
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.amounts.length > 0 ? (
                            <span className="block text-sm font-medium text-muted">
                              {item.amounts.join(" + ")}
                            </span>
                          ) : null}
                          {!effectiveFilter && item.fromRecipes.length > 0 ? (
                            <span className="block truncate text-xs text-muted">
                              {item.fromRecipes.join(", ")}
                            </span>
                          ) : null}
                        </span>
                      </label>

                      {item.manual ? (
                        <button
                          type="button"
                          className="p-4 text-muted hover:text-danger"
                          onClick={() => removeManual(item.key)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* --------------------------------------------- recipes added by hand */}
      {addedEntries.length > 0 ? (
        <section className="mt-8">
          <h2 className="h2">Added recipes</h2>
          <p className="meta mt-1">
            Not on the plan — just on the list. Change the servings and the
            amounts above follow.
          </p>
          <ul className="card mt-3 divide-y divide-line">
            {addedEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 p-3">
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
                      changeRecipeServings(entry.recipe_id, entry.servings - 1)
                    }
                    aria-label="Fewer servings"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">
                    {entry.servings}
                  </span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg border border-line text-muted hover:text-ink"
                    onClick={() =>
                      changeRecipeServings(entry.recipe_id, entry.servings + 1)
                    }
                    aria-label="More servings"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ml-1 p-2 text-muted hover:text-danger"
                    onClick={() => removeRecipe(entry.recipe_id)}
                    aria-label="Remove from list"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* -------------------------------------------------------- controls */}
      <form onSubmit={addManual} className="mt-6 flex gap-2">
        <input
          className="input"
          placeholder="Add your own item"
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
        />
        <button
          type="submit"
          className="btn-secondary shrink-0 px-4"
          disabled={!newItem.trim()}
        >
          Add
        </button>
      </form>

      {total > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn-secondary" onClick={() => void copyList()}>
            {copied ? "Copied" : effectiveFilter ? "Copy this meal" : "Copy list"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setChecked([])}
            disabled={bought === 0}
          >
            Uncheck all
          </button>
        </div>
      ) : null}

      {picking ? (
        <RecipePicker
          title="Add a recipe to the list"
          onPick={addRecipe}
          onCancel={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
