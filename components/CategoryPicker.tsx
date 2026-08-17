"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Spinner } from "@/components/icons";
import { useBottomInset } from "@/lib/hooks/useBottomInset";
import type { Category } from "@/lib/types";

/** Put a recipe into any number of categories, and make new ones inline. */
export function CategoryPicker({
  recipeId,
  onClose,
  onSaved,
}: {
  recipeId: string;
  onClose: () => void;
  onSaved?: (categories: Category[]) => void;
}) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomInset = useBottomInset();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/recipes/${recipeId}/categories`);
        const data = (await response.json()) as {
          categories?: Category[];
          selected?: string[];
        };
        if (!cancelled) {
          setCategories(data.categories ?? []);
          setSelected(new Set(data.selected ?? []));
        }
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        setCategories((current) => [...(current ?? []), data.category]);
        setSelected((current) => new Set(current).add(data.category.id));
        setNewName("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/recipes/${recipeId}/categories`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_ids: [...selected] }),
      });
      onSaved?.((categories ?? []).filter((c) => selected.has(c.id)));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 md:items-center md:p-6">
      {/* Floats clear of Safari's toolbar and the keyboard on mobile. */}
      <div
        className="mx-2 mb-2 max-h-[78vh] w-full max-w-content overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16)] md:m-0 md:shadow-none"
        style={{ marginBottom: `calc(0.5rem + ${bottomInset}px)` }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="h2">Add to category</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="no-scrollbar max-h-[46vh] overflow-y-auto">
          {categories === null ? (
            <div className="flex items-center gap-2 p-5 text-muted">
              <Spinner className="h-4 w-4" />
              Loading…
            </div>
          ) : categories.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No categories yet. Make your first one below — think “Weeknight
              dinners”, “Meal prep”, “Show off”.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {categories.map((category) => {
                const on = selected.has(category.id);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface"
                      onClick={() => toggle(category.id)}
                      aria-pressed={on}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          on ? "border-ink bg-ink text-white" : "border-line"
                        }`}
                      >
                        {on ? <CheckIcon className="h-4 w-4" /> : null}
                      </span>
                      <span className="flex-1 text-[15px]">
                        {category.emoji ? `${category.emoji} ` : ""}
                        {category.name}
                      </span>
                      <span className="text-sm text-muted">
                        {category.recipe_count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-5">
          <form onSubmit={createCategory} className="flex gap-2">
            <input
              className="input"
              placeholder="New category name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button
              type="submit"
              className="btn-secondary shrink-0 px-4"
              disabled={!newName.trim() || creating}
            >
              Create
            </button>
          </form>

          <button
            type="button"
            className="btn-accent mt-3 w-full"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? <Spinner /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
