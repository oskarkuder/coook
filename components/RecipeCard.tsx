"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkIcon } from "@/components/icons";
import { formatMinutes, totalTimeMinutes } from "@/lib/recipes/scale";
import type { RecipeSummary } from "@/lib/types";

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const [saved, setSaved] = useState(recipe.is_saved);
  const [busy, setBusy] = useState(false);

  async function toggleSaved(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const next = !saved;
    setSaved(next); // optimistic — the list should feel instant
    setBusy(true);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_saved: next }),
      });
      if (!response.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  const time = formatMinutes(
    totalTimeMinutes(recipe.prep_minutes, recipe.cook_minutes),
  );
  const calories = recipe.nutrition?.calories;
  const failed = recipe.status === "failed";

  const details = [
    time,
    calories ? `${calories} kcal per serving` : "",
    recipe.source_author ? `@${recipe.source_author.replace(/^@/, "")}` : "",
  ].filter(Boolean);

  return (
    <Link
      href={`/recipe/${recipe.id}`}
      className="card flex items-center gap-4 p-3 transition-colors hover:bg-surface"
    >
      {recipe.source_thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.source_thumbnail_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl border border-line bg-surface" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          {failed ? "Could not read this video" : (recipe.title ?? "Untitled recipe")}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {failed
            ? (recipe.error_message ?? "Try the link again.")
            : details.join(" · ")}
        </p>
      </div>

      {!failed ? (
        <button
          type="button"
          onClick={toggleSaved}
          aria-label={saved ? "Remove from saved" : "Save recipe"}
          aria-pressed={saved}
          className={`shrink-0 rounded-lg p-2 transition-colors ${
            saved ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      ) : null}
    </Link>
  );
}
