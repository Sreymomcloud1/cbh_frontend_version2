-- ============================================================
-- CBH v2 — Supabase Storage Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- Run AFTER schema.sql and rls.sql
-- ============================================================

-- ── Create Storage Buckets ────────────────────────────────────────────────
-- These are public buckets — images are readable by anyone with the URL.
-- Upload/update/delete is restricted by RLS policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',          'avatars',          true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('business-assets',  'business-assets',  true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS Policies ──────────────────────────────────────────────────

-- AVATARS: public read, owner can upload/update/delete within their folder
drop policy if exists "avatars: public read"    on storage.objects;
drop policy if exists "avatars: owner insert"   on storage.objects;
drop policy if exists "avatars: owner update"   on storage.objects;
drop policy if exists "avatars: owner delete"   on storage.objects;

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- BUSINESS-ASSETS: public read, authenticated users can upload to their own folder
drop policy if exists "business-assets: public read"    on storage.objects;
drop policy if exists "business-assets: owner insert"   on storage.objects;
drop policy if exists "business-assets: owner update"   on storage.objects;
drop policy if exists "business-assets: owner delete"   on storage.objects;

create policy "business-assets: public read"
  on storage.objects for select
  using (bucket_id = 'business-assets');

create policy "business-assets: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'business-assets'
    and auth.role() = 'authenticated'
    -- path format: logos/{userId}/... or gallery/{userId}/...
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "business-assets: owner update"
  on storage.objects for update
  using (
    bucket_id = 'business-assets'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "business-assets: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'business-assets'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
