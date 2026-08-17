# Coook!

Paste a link to a cooking video from TikTok, Instagram or YouTube and get back a
recipe you can actually cook: every ingredient with an amount, the steps in
order, calories per serving, and a servings dial that rescales the lot.

Recipes land in your history, you can save the good ones, drop them onto a
weekly meal plan, and the plan builds your shopping list for you.

## Run it

```bash
npm install && npm run dev
```

It starts in demo mode — fake user, sample data, no Supabase or Stripe needed.
See [SETUP.md](SETUP.md) to connect the real backend.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript, Tailwind)
- **Supabase** — auth (Google + email/password), Postgres with RLS on every table
- **Stripe** — one $10/month subscription, webhook-driven
- **No AI, no third-party model calls** — recipes are parsed deterministically

## How the extraction works

Two deterministic routes, no model anywhere:

```
recipe website  → schema.org/Recipe JSON-LD → exact recipe   lib/extract/website.ts
social caption  → rule-based text parser    → parsed recipe  lib/extract/parseRecipeText.ts
```

Almost every food site publishes structured recipe markup, so a website import
is exact and instant. Social captions are parsed by rules: a real ingredient
parser handles `1 1/2 cups plain flour, sifted`, vulgar fractions, ranges and
30+ unit spellings. Nutrition comes from a built-in food table — and returns
nothing at all rather than guessing when it cannot identify enough of a recipe.

If a post has no written recipe, the app says so and offers a box to paste it
in, which runs through the same parser. Nothing is ever invented.

## The screens

- **Home** — paste box, free-recipe counter, what's cooking next, this week's
  numbers, categories, recent recipes.
- **Library** — saved recipes, everything you've ever made, and categories
  (same idea as playlists: a recipe can sit in as many as you like).
- **Plan** — Mon–Sun grid, three meal slots a day, servings per meal.
- **Shopping** — built from the plan, grouped into supermarket aisles, with a
  progress bar, your own extra items, and a copy-to-clipboard.
- **Cooking assistant** — full screen, one step at a time, per-step timers with
  an alarm, screen kept awake, and a Q&A box that answers from *this* recipe.

## Free tier

Two successful extractions, then the $10/month subscription. Failed
extractions are free, and re-pasting a link you have already used returns the
existing recipe without charging you again.
