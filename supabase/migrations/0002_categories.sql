-- Coook! — recipe categories (like playlists)
-- Run after 0001_init.sql. Safe to re-run.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists categories_user_idx
  on public.categories (user_id, position, created_at);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- membership: a recipe can sit in any number of categories
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (category_id, recipe_id)
);

create index if not exists recipe_categories_recipe_idx
  on public.recipe_categories (user_id, recipe_id);

alter table public.recipe_categories enable row level security;

drop policy if exists "recipe_categories_select_own" on public.recipe_categories;
create policy "recipe_categories_select_own" on public.recipe_categories
  for select using (auth.uid() = user_id);

drop policy if exists "recipe_categories_insert_own" on public.recipe_categories;
create policy "recipe_categories_insert_own" on public.recipe_categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "recipe_categories_delete_own" on public.recipe_categories;
create policy "recipe_categories_delete_own" on public.recipe_categories
  for delete using (auth.uid() = user_id);
