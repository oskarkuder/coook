-- Coook! — initial schema
-- Run this once in the Supabase SQL editor of the NEW project.
-- Safe to re-run: everything is guarded with "if not exists" / "drop ... if exists".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds billing + free-quota state
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  -- how many recipe extractions this user has burned from the free allowance
  free_extractions_used integer not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  -- mirrors Stripe: active | trialing | past_due | canceled | incomplete | null
  subscription_status text,
  subscription_current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- recipes: one row per extracted video. Also doubles as history.
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error_code text,
  error_message text,

  -- where it came from
  source_url text not null,
  source_platform text not null default 'unknown',
  source_author text,
  source_thumbnail_url text,
  source_caption text,
  source_transcript text,

  -- the recipe itself
  title text,
  summary text,
  cuisine text,
  difficulty text,
  base_servings integer not null default 2,
  prep_minutes integer,
  cook_minutes integer,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  nutrition jsonb,
  confidence text,

  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_user_created_idx
  on public.recipes (user_id, created_at desc);
create index if not exists recipes_user_saved_idx
  on public.recipes (user_id, is_saved, created_at desc);

alter table public.recipes enable row level security;

drop policy if exists "recipes_select_own" on public.recipes;
create policy "recipes_select_own" on public.recipes
  for select using (auth.uid() = user_id);

drop policy if exists "recipes_insert_own" on public.recipes;
create policy "recipes_insert_own" on public.recipes
  for insert with check (auth.uid() = user_id);

drop policy if exists "recipes_update_own" on public.recipes;
create policy "recipes_update_own" on public.recipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipes_delete_own" on public.recipes;
create policy "recipes_delete_own" on public.recipes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- meal_plan_entries: a recipe pinned to a day + meal slot
-- ---------------------------------------------------------------------------
create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  plan_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  servings integer not null default 2 check (servings between 1 and 50),
  created_at timestamptz not null default now(),
  unique (user_id, plan_date, meal_slot, recipe_id)
);

create index if not exists meal_plan_user_date_idx
  on public.meal_plan_entries (user_id, plan_date);

alter table public.meal_plan_entries enable row level security;

drop policy if exists "meal_plan_select_own" on public.meal_plan_entries;
create policy "meal_plan_select_own" on public.meal_plan_entries
  for select using (auth.uid() = user_id);

drop policy if exists "meal_plan_insert_own" on public.meal_plan_entries;
create policy "meal_plan_insert_own" on public.meal_plan_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "meal_plan_update_own" on public.meal_plan_entries;
create policy "meal_plan_update_own" on public.meal_plan_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_plan_delete_own" on public.meal_plan_entries;
create policy "meal_plan_delete_own" on public.meal_plan_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- shopping_state: per-user, per-week checkbox state + manually added items.
-- The list itself is derived from the meal plan, so only state lives here.
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  checked_keys text[] not null default '{}',
  extra_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.shopping_state enable row level security;

drop policy if exists "shopping_state_select_own" on public.shopping_state;
create policy "shopping_state_select_own" on public.shopping_state
  for select using (auth.uid() = user_id);

drop policy if exists "shopping_state_insert_own" on public.shopping_state;
create policy "shopping_state_insert_own" on public.shopping_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "shopping_state_update_own" on public.shopping_state;
create policy "shopping_state_update_own" on public.shopping_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

-- Create the profile row automatically when someone signs up (email or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

drop trigger if exists shopping_state_touch_updated_at on public.shopping_state;
create trigger shopping_state_touch_updated_at
  before update on public.shopping_state
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

-- Atomic quota burn, so two tabs cannot both spend the last free extraction.
create or replace function public.increment_free_extractions(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set free_extractions_used = free_extractions_used + 1
   where id = p_user_id
  returning free_extractions_used;
$$;

revoke all on function public.increment_free_extractions(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- backfill: profiles for any users that already exist
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;
