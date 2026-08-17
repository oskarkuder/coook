-- Coook! — permanent copies of video thumbnails.
-- TikTok and Instagram sign their CDN URLs, so a hotlinked thumbnail silently
-- breaks after days or weeks. We copy each one into our own bucket at import.
-- Run after 0003. Safe to re-run.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

-- Public read: the bucket only ever holds thumbnails of already-public posts,
-- and making it public means <img src> works with no signing round trip.
drop policy if exists "recipe_images_public_read" on storage.objects;
create policy "recipe_images_public_read" on storage.objects
  for select using (bucket_id = 'recipe-images');

-- Writes come from the server with the service role, which bypasses RLS, so no
-- insert policy is granted to users here on purpose.
