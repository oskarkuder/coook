"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookmarkIcon,
  CalendarIcon,
  ExternalIcon,
  LibraryIcon,
  SparkIcon,
  TrashIcon,
} from "@/components/icons";
import { AddToPlan } from "@/components/AddToPlan";
import { CookAssistant } from "@/components/CookAssistant";
import { CategoryPicker } from "@/components/CategoryPicker";
import {
  formatIngredient,
  formatMinutes,
  totalNutrition,
  totalTimeMinutes,
} from "@/lib/recipes/scale";
import type { Category, Recipe } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  website: "Recipe site",
  manual: "Pasted text",
  unknown: "Link",
};

export function RecipeView({
  recipe,
  categories: initialCategories,
}: {
  recipe: Recipe;
  categories: Category[];
}) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.base_servings || 2);
  const [saved, setSaved] = useState(recipe.is_saved);
  const [categories, setCategories] = useState(initialCategories);
  const [planOpen, setPlanOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const perServing = recipe.nutrition;
  const batch = totalNutrition(perServing, servings);
  const time = formatMinutes(
    totalTimeMinutes(recipe.prep_minutes, recipe.cook_minutes),
  );

  async function toggleSaved() {
    const next = !saved;
    setSaved(next);
    const response = await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_saved: next }),
    });
    if (!response.ok) setSaved(!next);
  }

  async function remove() {
    if (!window.confirm("Delete this recipe? This cannot be undone.")) return;
    setDeleting(true);
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/library");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  if (cooking) {
    return (
      <CookAssistant
        recipe={recipe}
        servings={servings}
        onClose={() => setCooking(false)}
      />
    );
  }

  return (
    <div className="page">
      <Link href="/library" className="text-sm text-muted hover:text-ink">
        ← Library
      </Link>

      {/* ---------------------------------------------------------- header */}
      <div className="mt-4 flex gap-4">
        {recipe.source_thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.source_thumbnail_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-24 w-24 shrink-0 rounded-2xl border border-line object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]">
            {recipe.title}
          </h1>
          <p className="meta mt-2">
            {[
              PLATFORM_LABELS[recipe.source_platform] ?? "Link",
              recipe.source_author
                ? `@${recipe.source_author.replace(/^@/, "")}`
                : "",
              time,
              recipe.difficulty,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {recipe.summary ? (
        <p className="mt-4 text-[17px] leading-relaxed">{recipe.summary}</p>
      ) : null}

      {/* The whole point of the app — so it gets the yellow and the top slot. */}
      <button
        type="button"
        className="btn-accent mt-6 w-full"
        onClick={() => setCooking(true)}
      >
        <SparkIcon className="h-5 w-5" />
        Cook with the assistant
      </button>
      <p className="meta mt-2 text-center">
        One step at a time, with timers and answers while your hands are busy.
      </p>

      {categories.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.id}`}
              className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-ink hover:text-ink"
            >
              {category.emoji ? `${category.emoji} ` : ""}
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}

      {recipe.confidence === "low" ? (
        <p className="mt-5 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          The video was vague about amounts, so some of these are estimates.
          Taste as you go.
        </p>
      ) : null}

      {/* -------------------------------------------------------- servings */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <p className="h2">Servings</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary h-11 w-11 px-0 text-xl"
              onClick={() => setServings((value) => Math.max(1, value - 1))}
              aria-label="Fewer servings"
            >
              −
            </button>
            <span className="w-8 text-center text-lg font-medium tabular-nums">
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
        </div>
        {servings !== recipe.base_servings ? (
          <p className="meta mt-2">
            Original video makes {recipe.base_servings}. Amounts below are scaled.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------- nutrition */}
      {perServing ? (
        <section className="mt-8">
          <h2 className="h2">Nutrition</h2>
          <div className="card mt-3 grid grid-cols-4 divide-x divide-line">
            <Stat label="Calories" value={`${perServing.calories}`} />
            <Stat label="Protein" value={`${perServing.protein_g} g`} />
            <Stat label="Carbs" value={`${perServing.carbs_g} g`} />
            <Stat label="Fat" value={`${perServing.fat_g} g`} />
          </div>
          <p className="meta mt-2">
            Per serving. All {servings} servings together:{" "}
            {batch?.calories ?? 0} kcal. Estimated from the ingredients.
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------------------ ingredients */}
      <section className="mt-8">
        <h2 className="h2">Ingredients</h2>
        <ul className="card mt-3 divide-y divide-line">
          {recipe.ingredients.map((ingredient, index) => {
            const line = formatIngredient(
              ingredient,
              recipe.base_servings,
              servings,
            );
            return (
              <li key={`${ingredient.name}-${index}`} className="flex gap-3 p-4">
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
      </section>

      {/* ------------------------------------------------------------ steps */}
      <section className="mt-8">
        <h2 className="h2">Steps</h2>
        <ol className="mt-3 space-y-4">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm font-medium tabular-nums">
                {index + 1}
              </span>
              <div className="pt-1">
                <p className="leading-relaxed">{step.text}</p>
                {step.minutes ? (
                  <p className="meta mt-1">{formatMinutes(step.minutes)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------- actions */}
      <section className="mt-10">
        {planOpen ? (
          <AddToPlan
            recipeId={recipe.id}
            defaultServings={servings}
            onClose={() => setPlanOpen(false)}
          />
        ) : (
          <>
            <button
              type="button"
              className="btn-accent w-full"
              onClick={() => setCooking(true)}
            >
              <SparkIcon className="h-5 w-5" />
              Cook with the assistant
            </button>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => void toggleSaved()}
              >
                <BookmarkIcon filled={saved} />
                {saved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setCategoryOpen(true)}
              >
                <LibraryIcon />
                Add to category
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setPlanOpen(true)}
              >
                <CalendarIcon />
                Add to plan
              </button>
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full"
              >
                <ExternalIcon />
                Open original video
              </a>
              <button
                type="button"
                className="btn-danger w-full sm:col-span-2"
                onClick={() => void remove()}
                disabled={deleting}
              >
                <TrashIcon />
                Delete
              </button>
            </div>
          </>
        )}
      </section>

      {categoryOpen ? (
        <CategoryPicker
          recipeId={recipe.id}
          onClose={() => setCategoryOpen(false)}
          onSaved={(next) => {
            setCategories(next);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-4 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
