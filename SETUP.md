# Coook! — setup

## Try it right now (no accounts needed)

```bash
npm install && npm run dev
```

`.env.local.example` ships with `NEXT_PUBLIC_DEMO_MODE=1`, so with no Supabase,
no Stripe and no Vercel you get:

- a fake signed-in user, no login screen
- two sample recipes already in history, one of them saved
- a working paste box — submit any TikTok/Instagram/YouTube link and it returns
  a sample recipe after a couple of seconds
- servings scaling, meal plan and shopping list all fully working
- the paid plan switched on, so the paywall stays out of the way

Everything lives in memory and disappears when the dev server restarts. A yellow
banner across the top makes sure you never mistake it for the real thing.

Recipe extraction is fully deterministic, so it works in demo mode with no
keys at all — paste a recipe-site link and you get the real thing.

When you are ready for the real backend, set `NEXT_PUBLIC_DEMO_MODE=0` and work
through the rest of this file.

---

## The real setup

Everything below is for a **brand new** Supabase project, a **brand new** Stripe
product and a **brand new** Vercel project. Nothing is shared with PiscesAI.

Work through it top to bottom. It takes about 20 minutes.

---

## 1. Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it.
   Then do the same with
   [`supabase/migrations/0002_categories.sql`](supabase/migrations/0002_categories.sql).
   It creates `profiles`, `recipes`, `meal_plan_entries` and `shopping_state`,
   turns on row-level security for all of them, and adds the trigger that
   creates a profile row on signup.
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose it)

### Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type *Web application*.
2. Under **Authorised redirect URIs** add exactly:
   ```
   https://YOUR-PROJECT.supabase.co/auth/v1/callback
   ```
3. In Supabase → **Authentication → Providers → Google**, enable it and paste the
   client ID and secret.

### Auth URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://your-domain.com` (use `http://localhost:3000` while developing)
- **Redirect URLs**: add both
  ```
  http://localhost:3000/auth/callback
  https://your-domain.com/auth/callback
  ```

### Email confirmation

Supabase → **Authentication → Providers → Email**. If *Confirm email* is on,
new signups see a "check your email" screen; that is handled. Turning it off
lets people in immediately — fine for testing, less good for production.

---


## 2. Stripe

1. **Products → Add product**: name it *Coook! Unlimited*, price **$10.00 USD,
   recurring monthly**. Copy the **price ID** (`price_…`) → `STRIPE_PRICE_MONTHLY`.
2. **Developers → API keys**: copy the secret key → `STRIPE_SECRET_KEY`.
   Then add a second price to the same product: **€30.00 EUR, recurring
   yearly** → `STRIPE_PRICE_YEARLY`.

   > Note: the monthly price is in USD and the yearly in EUR, as specified.
   > Stripe handles that fine as two separate prices, but customers see two
   > currencies on one page. If you'd rather they matched, make the monthly
   > price €9.99 EUR and only the displayed strings in `lib/entitlements.ts`
   > need changing.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copy the **signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`
4. **Settings → Billing → Customer portal**: enable it, and allow customers to
   cancel their subscription. The Account page opens this portal.

Do all of this in **test mode** first, then repeat in live mode — the keys, the
price ID and the webhook secret are all different between the two.

### Testing webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the `whsec_…` that command prints as your local `STRIPE_WEBHOOK_SECRET`.

---

## 3. Local development

```bash
cp .env.local.example .env.local
```

Fill in every value, then:

```bash
npm install && npm run dev
```

Open http://localhost:3000.

> **Note on the folder name.** The `!` in `Coook!` is a reserved character in
> webpack, so `npm run dev` and `npm run build` are pinned to Turbopack, which
> handles it fine. If you ever want to go back to webpack, rename the folder to
> `coook` first. Vercel is unaffected — it builds from the repository name.

> **Why `dev` and `start` call `node --max-http-header-size` directly.**
> Cookies are scoped per *host* and ignore the port, so every project you have
> ever run on `localhost` — PiscesAI, Kino, anything else — keeps sending its
> cookies to this app too. They pile up well past Node's default 16 KB header
> limit, and Node then answers **431 Request Header Fields Too Large**: the
> browser receives an empty document and shows a blank white page, with no
> error anywhere. Raising the limit to 512 KB fixes it. PiscesAI carries the
> same workaround for the same reason.
>
> It only affects local development — on a real domain visitors only have your
> own cookies. To clear the underlying pile-up: Safari → Settings → Privacy →
> Manage Website Data → search `localhost` → Remove.

---

## 4. Vercel

1. Push this folder to a new GitHub repository.
2. Import it as a **new Vercel project** (do not reuse the PiscesAI project).
3. **Settings → Environment Variables**: add every variable from
   `.env.local.example` for *Production* and *Preview*.
   - `NEXT_PUBLIC_APP_ORIGIN` must be your real domain with no trailing slash,
     e.g. `https://coook.app`.
4. Deploy.
5. Go back and update, with the real domain:
   - Supabase **Site URL** and **Redirect URLs**
   - The Stripe **webhook endpoint URL**

`maxDuration` on the extraction route is 60 seconds. That fits inside Vercel's
Hobby limit; no configuration needed.

---

## 5. Optional: media resolver

`MEDIA_RESOLVER_URL` and `MEDIA_RESOLVER_KEY` are the escape hatch for the one
genuinely fragile part of this app.

TikTok and Instagram throttle or block requests coming from datacenter IP
ranges — which is exactly where Vercel runs. Captions usually still come
not**, especially for Instagram.

When those variables are set, the app calls

```
GET {MEDIA_RESOLVER_URL}?url=<post url>
```

with `Authorization: Bearer {MEDIA_RESOLVER_KEY}` and `x-api-key`, and expects
JSON shaped like:

```json
{
  "caption": "…",
  "author": "…",
  "thumbnail_url": "https://…",
  "media_url": "https://…direct .mp4…"
}
```

Any RapidAPI TikTok/Instagram downloader, an Apify actor, or your own small
`yt-dlp` service on Fly/Railway fits that shape.

**Without it the app still works.** It reads the caption, and when a post gives
up nothing at all the user is shown a text box to paste the caption in by hand.

---

## How people get a video into the app

Three ways in, because the platforms do not all allow the same thing:

| Path | Works on |
|---|---|
| Paste the link into the box on the home page | Everywhere — this is the main one |
| `/?url=…` — anything that opens the site with a link attached | Everywhere |
| Android share sheet → Coook! (Web Share Target, declared in `app/manifest.ts`) | Android, after the user installs the PWA |

**iOS has no equivalent of Web Share Target.** A website cannot appear in the
iOS share sheet. On iPhone the flow is: Share → Copy link → open Coook! → tap
**Paste**. If you later want a real iOS share-sheet entry, that needs a native
app wrapper or an iOS Shortcut — not something a web app can do.

---

## Where things live

```
lib/data/                      the store: Supabase in production, memory in demo
app/
  page.tsx                     home — paste box, or the landing page when signed out
  recipe/[id]/page.tsx         a single recipe
  history/  saved/  plan/      the three list screens
  account/  pricing/           billing
  share/page.tsx               Android share-target landing
  api/
    recipes/extract/           the whole extraction runs here
    stripe/webhook/            the only thing that writes subscription_status
lib/
  recipes/scale.ts             servings maths and fraction formatting
  shopping/aggregate.ts        merges the week's ingredients into one list
  entitlements.ts              free allowance + subscription checks
supabase/migrations/           the schema
```

## Things worth knowing

- **The free allowance is 2 successful extractions**, set by `FREE_EXTRACTIONS`
  in `lib/entitlements.ts`. Failed extractions cost nothing, and re-pasting a
  link you already turned into a recipe returns the existing one for free.
- **Nutrition is an AI estimate** from the ingredient list, not a lab
  measurement. The recipe page says so when the model reports low confidence.
- **Only the Stripe webhook sets `subscription_status`.** Nothing in the app
  writes it directly, so the paywall can never drift out of sync with Stripe.
- **RLS is on for every table.** Even with a leaked anon key, one user cannot
  read another's recipes.
