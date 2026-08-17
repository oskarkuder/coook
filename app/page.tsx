import Link from "next/link";
import { PasteBox } from "@/components/PasteBox";
import { RecipeCard } from "@/components/RecipeCard";
import { FreeCounter } from "@/components/FreeCounter";
import { Sticker } from "@/components/Brand";
import { CartIcon, CalendarIcon, ChevronRightIcon, SparkIcon } from "@/components/icons";
import { getStore } from "@/lib/data";
import { getUserAndProfile } from "@/lib/supabase/serverUser";
import { getEntitlement, FREE_EXTRACTIONS, PLAN } from "@/lib/entitlements";
import { buildShoppingList } from "@/lib/shopping/aggregate";
import {
  currentWeekStartKey,
  formatDayName,
  isToday,
  toDateKey,
  weekDateKeys,
} from "@/lib/plan/week";
import { MEAL_SLOTS } from "@/lib/types";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Copy the link",
    body: "On TikTok or Instagram, tap Share and then Copy link.",
  },
  {
    title: "Paste it here",
    body: "Coook! reads the caption and listens to the video.",
  },
  {
    title: "Cook it",
    body: "Step-by-step mode walks you through it, timers and all.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const { user, profile } = await getUserAndProfile();

  // ------------------------------------------------------------- signed out
  if (!user) {
    return (
      <div className="page">
        <Sticker className="h-20 w-auto" />
        <h1 className="h1 mt-6">Turn cooking videos into real recipes.</h1>
        <p className="mt-3 text-[17px] text-muted">
          Paste a TikTok, Reel or Short. Get the ingredients with exact amounts,
          the steps in order, and a step-by-step mode that cooks it with you.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="btn-accent sm:w-56">
            Get started free
          </Link>
          <Link href="/login" className="btn-secondary sm:w-40">
            Sign in
          </Link>
        </div>
        <p className="meta mt-3">
          {FREE_EXTRACTIONS} recipes free, then ${PLAN.priceUsd} a month. Cancel any time.
        </p>

        <ol className="mt-12 space-y-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm font-medium">
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="meta mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // -------------------------------------------------------------- signed in
  const entitlement = getEntitlement(profile);
  const store = getStore();
  const weekStart = currentWeekStartKey();
  const days = weekDateKeys(weekStart);

  const [recipes, categories, entries, shopping] = await Promise.all([
    store.listRecipes(user.id, { limit: 50 }),
    store.listCategories(user.id),
    store.listPlan(user.id, days[0], days[6]),
    store.getShopping(user.id, weekStart),
  ]);

  const savedCount = recipes.filter((recipe) => recipe.is_saved).length;
  const recent = recipes.slice(0, 3);

  const shoppingItems = buildShoppingList(entries, shopping.extra_items);
  const checked = new Set(shopping.checked_keys);
  const toBuy = shoppingItems.filter((item) => !checked.has(item.key)).length;

  // The next meal that has not been and gone: today first, then later this week.
  const today = toDateKey(new Date());
  const upcoming = entries
    .filter((entry) => entry.plan_date >= today)
    .sort(
      (a, b) =>
        a.plan_date.localeCompare(b.plan_date) ||
        MEAL_SLOTS.indexOf(a.meal_slot) - MEAL_SLOTS.indexOf(b.meal_slot),
    )[0];

  return (
    <div className="page">
      <h1 className="h1">New recipe</h1>

      <div className="mt-6">
        <PasteBox
          initialUrl={url ?? ""}
          autoStart={Boolean(url)}
          freeRemaining={entitlement.freeRemaining}
          isSubscribed={entitlement.isSubscribed}
        />
      </div>

      {!entitlement.isSubscribed ? (
        <div className="mt-6">
          <FreeCounter entitlement={entitlement} />
        </div>
      ) : null}

      {/* ----------------------------------------------------------- up next */}
      {upcoming?.recipe ? (
        <section className="mt-10">
          <h2 className="h2">Up next</h2>
          <Link
            href={`/recipe/${upcoming.recipe_id}`}
            className="card mt-3 flex items-center gap-4 p-4 transition-colors hover:bg-surface"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
              <SparkIcon className="h-6 w-6 text-ink" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {upcoming.recipe.title}
              </span>
              <span className="meta block">
                {isToday(upcoming.plan_date)
                  ? "Today"
                  : formatDayName(upcoming.plan_date)}
                , {upcoming.meal_slot} · {upcoming.servings} servings
              </span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        </section>
      ) : null}

      {/* ------------------------------------------------------- this week */}
      <section className="mt-10">
        <h2 className="h2">This week</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/plan" className="card p-4 transition-colors hover:bg-surface">
            <CalendarIcon className="h-5 w-5 text-muted" />
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {entries.length}
            </p>
            <p className="meta">
              {entries.length === 1 ? "meal planned" : "meals planned"}
            </p>
          </Link>
          <Link
            href="/shopping"
            className="card p-4 transition-colors hover:bg-surface"
          >
            <CartIcon className="h-5 w-5 text-muted" />
            <p className="mt-2 text-2xl font-semibold tabular-nums">{toBuy}</p>
            <p className="meta">
              {toBuy === 1 ? "thing to buy" : "things to buy"}
            </p>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------ categories */}
      {categories.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="h2">Categories</h2>
            <Link href="/library" className="text-sm text-muted hover:text-ink">
              See all
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.id}`}
                className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                {category.emoji ? `${category.emoji} ` : ""}
                {category.name}
                <span className="ml-1.5 text-muted">{category.recipe_count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- recent */}
      {recent.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="h2">Recent</h2>
            <Link href="/library" className="text-sm text-muted hover:text-ink">
              {savedCount > 0 ? `${savedCount} saved` : "See all"}
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="h2">How it works</h2>
          <ol className="mt-4 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm font-medium">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="meta mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
