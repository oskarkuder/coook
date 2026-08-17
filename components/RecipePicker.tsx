"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/icons";
import { useBottomInset } from "@/lib/hooks/useBottomInset";
import type { RecipeSummary } from "@/lib/types";

/** Pick one of your existing recipes to drop into a meal slot. */
export function RecipePicker({
  title,
  onPick,
  onCancel,
  headerExtra,
}: {
  title: string;
  onPick: (recipe: RecipeSummary) => void;
  onCancel: () => void;
  /** Optional controls above the search box — the plan uses it for meal slots. */
  headerExtra?: React.ReactNode;
}) {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const bottomInset = useBottomInset();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/recipes?limit=100");
        const data = (await response.json()) as { recipes?: RecipeSummary[] };
        if (!cancelled) {
          setRecipes(
            (data.recipes ?? []).filter((recipe) => recipe.status === "ready"),
          );
        }
      } catch {
        if (!cancelled) setRecipes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = (recipes ?? []).filter((recipe) =>
    (recipe.title ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-0 md:items-center md:p-6">
      {/* Floats clear of Safari's toolbar and the keyboard on mobile. */}
      <div
        className="mx-2 mb-2 max-h-[78vh] w-full max-w-content overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16)] md:m-0 md:shadow-none"
        style={{ marginBottom: `calc(0.5rem + ${bottomInset}px)` }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="h2">{title}</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <div className="space-y-3 border-b border-line px-5 py-3">
          {headerExtra}
          <input
            className="input"
            placeholder="Search your recipes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="no-scrollbar max-h-[52vh] overflow-y-auto">
          {recipes === null ? (
            <div className="flex items-center gap-2 p-5 text-muted">
              <Spinner className="h-4 w-4" />
              Loading…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-5">
              <p className="font-medium">No recipes to add</p>
              <p className="meta mt-1">
                Make one first and it will show up here.
              </p>
              <Link href="/" className="btn-primary mt-4 w-full">
                New recipe
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface"
                    onClick={() => onPick(recipe)}
                  >
                    {recipe.source_thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.source_thumbnail_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {recipe.title ?? "Untitled recipe"}
                      </span>
                      <span className="block text-sm text-muted">
                        Makes {recipe.base_servings}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
