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
- **OpenAI** — audio transcription plus structured recipe extraction

## How the extraction works

```
link → normalise + follow share redirects   lib/extract/sourceUrl.ts
     → caption, author, thumbnail, media    lib/extract/metadata.ts
     → transcribe audio, if needed          lib/extract/transcribe.ts
     → structured recipe JSON               lib/extract/structure.ts
```

The caption is tried first. Only when it does not already contain the recipe
does the audio get transcribed, which keeps most extractions to a few cents and
a few seconds. If a post gives up nothing at all — private, or blocked — the
user is offered a box to paste the caption in by hand, and the same pipeline
runs on that.

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
