-- =====================================================================
-- Kullanıcı ayarları: aylık bütçe cihazlar arasında (telefon + web) paylaşılır.
-- 007 kurulumundan sonra çalıştırılır. Mevcut verilere dokunmaz, tekrar çalıştırılabilir.
-- Kurulmamışsa uygulama bütçeyi eskisi gibi yalnızca cihazda saklar.
-- =====================================================================

create table if not exists public.user_settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  aylik_butce  numeric(14, 2) check (aylik_butce is null or aylik_butce > 0),
  updated_at   timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 8 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
