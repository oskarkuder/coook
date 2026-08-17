"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeCard } from "@/components/RecipeCard";
import { PlusIcon, Spinner } from "@/components/icons";
import type { Category, RecipeSummary } from "@/lib/types";

type Filter = "saved" | "all";

export function LibraryClient({
  recipes,
  categories: initialCategories,
}: {
  recipes: RecipeSummary[];
  categories: Category[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("saved");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const savedCount = useMemo(
    () => recipes.filter((recipe) => recipe.is_saved).length,
    [recipes],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes
      .filter((recipe) => (filter === "saved" ? recipe.is_saved : true))
      .filter((recipe) =>
        needle ? (recipe.title ?? "").toLowerCase().includes(needle) : true,
      );
  }, [recipes, filter, query]);

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        const data = (await response.json()) as { category: Category };
        setCategories((current) => [...current, data.category]);
        setNewName("");
        setShowNew(false);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <h1 className="h1">Library</h1>

      {/* ------------------------------------------------------ categories */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">Categories</h2>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={() => setShowNew((open) => !open)}
          >
            {showNew ? "Cancel" : "New category"}
          </button>
        </div>

        {showNew ? (
          <form onSubmit={createCategory} className="mb-3 flex gap-2">
            <input
              className="input"
              placeholder="e.g. Weeknight dinners"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-accent shrink-0 px-4"
              disabled={!newName.trim() || creating}
            >
              {creating ? <Spinner /> : null}
              Create
            </button>
          </form>
        ) : null}

        {categories.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="card flex w-full items-center gap-3 p-4 text-left hover:bg-surface"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <PlusIcon className="h-5 w-5 text-ink" />
            </span>
            <span>
              <span className="block font-medium">Make your first category</span>
              <span className="meta">
                Group recipes however you like — same idea as playlists.
              </span>
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.id}`}
                className="card p-4 transition-colors hover:bg-surface"
              >
                <span className="text-xl">{category.emoji ?? "🍳"}</span>
                <span className="mt-2 block truncate font-medium">
                  {category.name}
                </span>
                <span className="meta">
                  {category.recipe_count}{" "}
                  {category.recipe_count === 1 ? "recipe" : "recipes"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- recipes */}
      <section className="mt-10">
        <div className="flex gap-1 rounded-xl border border-line p-1">
          <Tab active={filter === "saved"} onClick={() => setFilter("saved")}>
            Saved ({savedCount})
          </Tab>
          <Tab active={filter === "all"} onClick={() => setFilter("all")}>
            All ({recipes.length})
          </Tab>
        </div>

        {recipes.length > 6 ? (
          <input
            className="input mt-3"
            placeholder="Search recipes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}

        {visible.length === 0 ? (
          <div className="card mt-4 p-6">
            <p className="font-medium">
              {filter === "saved" ? "Nothing saved yet" : "No recipes yet"}
            </p>
            <p className="meta mt-1">
              {filter === "saved"
                ? "Tap the bookmark on a recipe to keep it here."
                : "Paste a cooking video link and it shows up here."}
            </p>
            <Link href="/" className="btn-accent mt-5 sm:w-48">
              New recipe
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {visible.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-[15px] transition-colors ${
        active ? "bg-ink font-medium text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
