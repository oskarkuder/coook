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
- **OpenAI** — transcription plus structured recipe extraction on every import

## How the extraction works

One path for every link, so the result is consistent whatever you paste:

```
gather   published schema.org/Recipe markup (recipe sites)
       + the post caption
       + a transcript of the audio          lib/extract/transcribe.ts
   →    one structuring pass                lib/extract/structure.ts
```

The audio is always transcribed when it can be reached, which is what makes
"paste the link and it just works" true for videos where the creator only says
the recipe out loud. When a recipe site publishes structured markup, that is
handed to the model as authoritative so its exact amounts are copied rather
than reworded.

Video thumbnails are copied into Supabase Storage at import, because social CDN
URLs are signed and expire.

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
