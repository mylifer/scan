-- =====================================================================
-- Çöp kutusu: silinen fişler 30 gün boyunca burada saklanır ve geri alınabilir.
-- 004 (kategoriler) dahil önceki kurulumları da kapsar; tek başına çalıştırmanız yeterli.
-- Mevcut fişlere dokunmaz.
-- =====================================================================

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

-- 004: tüm kategoriler
alter table public.receipts drop constraint if exists receipts_kategori_check;
alter table public.receipts add constraint receipts_kategori_check check (kategori in (
  'akaryakıt', 'restoran', 'market', 'teknoloji', 'ofis gideri',
  'ulaşım', 'araç bakım', 'konaklama', 'iletişim', 'faturalar', 'kargo', 'giyim', 'diğer'
));

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 5 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
