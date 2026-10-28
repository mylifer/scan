-- =====================================================================
-- Fiş no, VKN/TCKN, not ve etiketler; kendi kategorileriniz; uygulama hata kayıtları.
-- 005 (çöp kutusu) dahil önceki kurulumları da kapsar; tek başına çalıştırmanız yeterli.
-- Mevcut fişlere dokunmaz, tekrar çalıştırılabilir.
-- =====================================================================

-- ---------- Fişlere yeni alanlar ----------
alter table public.receipts add column if not exists fis_no text;
alter table public.receipts add column if not exists vkn text;
alter table public.receipts add column if not exists notlar text;
alter table public.receipts add column if not exists etiketler text[] not null default '{}';

alter table public.receipts drop constraint if exists receipts_fis_no_check;
alter table public.receipts add constraint receipts_fis_no_check check (fis_no is null or char_length(fis_no) between 1 and 40);
alter table public.receipts drop constraint if exists receipts_vkn_check;
alter table public.receipts add constraint receipts_vkn_check check (vkn is null or vkn ~ '^[0-9]{10,11}$');
alter table public.receipts drop constraint if exists receipts_notlar_check;
alter table public.receipts add constraint receipts_notlar_check check (notlar is null or char_length(notlar) <= 1000);
alter table public.receipts drop constraint if exists receipts_etiketler_check;
alter table public.receipts add constraint receipts_etiketler_check check (cardinality(etiketler) <= 20);

-- Kategori artık sabit bir liste değil: hazır kategoriler + kullanıcının kendi eklediği adlar
alter table public.receipts drop constraint if exists receipts_kategori_check;
alter table public.receipts add constraint receipts_kategori_check check (char_length(btrim(kategori)) between 1 and 40);

-- ---------- Kullanıcının kendi kategorileri ----------
create table if not exists public.receipt_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  ad          text not null check (char_length(btrim(ad)) between 1 and 40)
);

create unique index if not exists receipt_categories_user_ad_idx on public.receipt_categories (user_id, lower(ad));

alter table public.receipt_categories enable row level security;

drop policy if exists "categories_select_own" on public.receipt_categories;
create policy "categories_select_own" on public.receipt_categories
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "categories_insert_own" on public.receipt_categories;
create policy "categories_insert_own" on public.receipt_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "categories_update_own" on public.receipt_categories;
create policy "categories_update_own" on public.receipt_categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "categories_delete_own" on public.receipt_categories;
create policy "categories_delete_own" on public.receipt_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Uygulama hata kayıtları (Ayarlar → Hata Kayıtları) ----------
create table if not exists public.app_errors (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  context      text not null check (char_length(context) <= 100),
  message      text not null check (char_length(message) <= 2000),
  detail       text check (detail is null or char_length(detail) <= 8000),
  app_version  text check (app_version is null or char_length(app_version) <= 100),
  platform     text check (platform is null or char_length(platform) <= 100)
);

create index if not exists app_errors_user_created_idx on public.app_errors (user_id, created_at desc);

alter table public.app_errors enable row level security;

drop policy if exists "errors_select_own" on public.app_errors;
create policy "errors_select_own" on public.app_errors
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "errors_insert_own" on public.app_errors;
create policy "errors_insert_own" on public.app_errors
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "errors_delete_own" on public.app_errors;
create policy "errors_delete_own" on public.app_errors
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- 005: çöp kutusu (yapılmamışsa) ----------
create table if not exists public.receipt_trash (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deleted_at  timestamptz not null default now(),
  receipt     jsonb not null
);

create index if not exists receipt_trash_user_deleted_idx on public.receipt_trash (user_id, deleted_at desc);

alter table public.receipt_trash enable row level security;

drop policy if exists "trash_select_own" on public.receipt_trash;
create policy "trash_select_own" on public.receipt_trash
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "trash_insert_own" on public.receipt_trash;
create policy "trash_insert_own" on public.receipt_trash
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "trash_delete_own" on public.receipt_trash;
create policy "trash_delete_own" on public.receipt_trash
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 6 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
