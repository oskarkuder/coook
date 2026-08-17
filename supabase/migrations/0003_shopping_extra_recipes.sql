-- Coook! — let a shopping list include recipes that are not on the meal plan.
-- Run after 0002_categories.sql. Safe to re-run.

alter table public.shopping_state
  add column if not exists extra_recipes jsonb not null default '[]'::jsonb;

comment on column public.shopping_state.extra_recipes is
  'Recipes added straight to the list from the library: [{"recipe_id": uuid, "servings": int}]';
