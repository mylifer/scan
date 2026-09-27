-- =====================================================================
-- Fiş Tarayıcı: receipts tablosu + fiş görselleri için Storage bucket
-- Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- =====================================================================

create table if not exists public.receipts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  firma_adi     text not null,
  tarih         date not null,
  toplam_tutar  numeric(12, 2) not null check (toplam_tutar >= 0),
  kdv_yuzde1    numeric(12, 2) not null default 0 check (kdv_yuzde1 >= 0),
  kdv_yuzde10   numeric(12, 2) not null default 0 check (kdv_yuzde10 >= 0),
  kdv_yuzde20   numeric(12, 2) not null default 0 check (kdv_yuzde20 >= 0),
  toplam_kdv    numeric(12, 2) generated always as (kdv_yuzde1 + kdv_yuzde10 + kdv_yuzde20) stored,
  kategori      text not null
                check (kategori in ('akaryakıt', 'restoran', 'market', 'teknoloji', 'ofis gideri')),
  image_path    text
);

create index if not exists receipts_user_tarih_idx on public.receipts (user_id, tarih desc);

-- ---------- Row Level Security: herkes yalnızca kendi fişlerini görür ----------
alter table public.receipts enable row level security;

drop policy if exists "receipts_select_own" on public.receipts;
create policy "receipts_select_own" on public.receipts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "receipts_insert_own" on public.receipts;
create policy "receipts_insert_own" on public.receipts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "receipts_update_own" on public.receipts;
create policy "receipts_update_own" on public.receipts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "receipts_delete_own" on public.receipts;
create policy "receipts_delete_own" on public.receipts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Storage: özel (private) bucket, dosya başına en fazla 500 KB ----------
-- Uygulama görselleri ~900px / JPEG %45 ile ~50-120 KB'a sıkıştırır.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-images', 'receipt-images', false, 512000, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dosya yolu: <user_id>/<dosya>.jpg — kullanıcı yalnızca kendi klasörüne erişir.
drop policy if exists "receipt_images_select_own" on storage.objects;
create policy "receipt_images_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipt_images_insert_own" on storage.objects;
create policy "receipt_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipt_images_delete_own" on storage.objects;
create policy "receipt_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
