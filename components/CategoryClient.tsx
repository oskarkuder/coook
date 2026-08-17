"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeCard } from "@/components/RecipeCard";
import { Spinner, TrashIcon } from "@/components/icons";
import type { Category, RecipeSummary } from "@/lib/types";

export function CategoryClient({
  category,
  recipes,
}: {
  category: Category;
  recipes: RecipeSummary[];
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === category.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (response.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete “${category.name}”? The recipes stay in your library — only the grouping goes.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/categories/${category.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/library");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Link href="/library" className="text-sm text-muted hover:text-ink">
        ← Library
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        {editing ? (
          <form onSubmit={rename} className="flex flex-1 gap-2">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-accent shrink-0 px-4" disabled={busy}>
              {busy ? <Spinner /> : null}
              Save
            </button>
          </form>
        ) : (
          <div className="min-w-0">
            <h1 className="h1 truncate">
              {category.emoji ? `${category.emoji} ` : ""}
              {category.name}
            </h1>
            <p className="meta mt-1">
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
            </p>
          </div>
        )}

        {!editing ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setEditing(true)}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn-danger btn-sm px-3"
              onClick={() => void remove()}
              disabled={busy}
              aria-label="Delete category"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {recipes.length === 0 ? (
        <div className="card mt-8 p-6">
          <p className="font-medium">Nothing in here yet</p>
          <p className="meta mt-1">
            Open any recipe and use <strong>Add to category</strong> to drop it in.
          </p>
          <Link href="/library" className="btn-secondary mt-5 sm:w-48">
            Browse recipes
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
