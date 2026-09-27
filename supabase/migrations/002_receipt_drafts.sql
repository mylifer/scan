-- =====================================================================
-- Toplu tarama için taslak fişler
-- Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- =====================================================================

create table if not exists public.receipt_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  image_path     text not null,
  status         text not null default 'pending'
                 check (status in ('pending', 'scheduled', 'processing', 'ready', 'failed')),
  scheduled_for  timestamptz,
  result         jsonb,
  error          text
);

create index if not exists receipt_drafts_user_created_idx on public.receipt_drafts (user_id, created_at);

alter table public.receipt_drafts enable row level security;

drop policy if exists "drafts_select_own" on public.receipt_drafts;
create policy "drafts_select_own" on public.receipt_drafts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "drafts_insert_own" on public.receipt_drafts;
create policy "drafts_insert_own" on public.receipt_drafts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "drafts_update_own" on public.receipt_drafts;
create policy "drafts_update_own" on public.receipt_drafts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "drafts_delete_own" on public.receipt_drafts;
create policy "drafts_delete_own" on public.receipt_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Taslak görselleri AI'ın okuyabilmesi için daha yüksek çözünürlükte tutulur (kaydedilince silinir)
update storage.buckets set file_size_limit = 1048576 where id = 'receipt-images';
