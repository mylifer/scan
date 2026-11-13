-- =====================================================================
-- Fiş kalemleri: fişteki ürün/hizmet satırları (fiyat geçmişi için).
-- - Yeni fişlerde kalemler tarama sırasında, aynı yapay zekâ isteğinde okunur.
-- - Eski fişler, Gemini günlük kotası sıfırlanmadan önceki saatte (Pasifik 23:00–23:55) o gün kullanılmayan
--   kotayla "kalem-doldur" fonksiyonu tarafından fotoğraftan okunur. Fişin tutar/KDV alanlarına dokunulmaz.
-- 008 kurulumundan sonra çalıştırılır. Mevcut verilere dokunmaz, tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.receipt_items (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receipt_id   uuid not null references public.receipts (id) on delete cascade,
  sira         smallint not null check (sira between 0 and 199),
  ad           text not null check (char_length(btrim(ad)) between 1 and 120),
  miktar       numeric(14, 3) not null default 1,
  birim        text check (birim is null or char_length(birim) <= 10),
  birim_fiyat  numeric(14, 2),
  -- Satırın KDV dahil tutarı (indirim satırlarında negatif)
  tutar        numeric(14, 2) not null,
  kdv_orani    numeric(5, 2) check (kdv_orani is null or kdv_orani between 0 and 100),
  -- tarama: yeni fişte okunurken; geriye_donuk: arşivdeki (küçültülmüş) fotoğraftan sonradan
  kaynak       text not null default 'tarama' check (kaynak in ('tarama', 'geriye_donuk')),
  created_at   timestamptz not null default now(),
  unique (receipt_id, sira)
);

create index if not exists receipt_items_user_ad_idx on public.receipt_items (user_id, lower(ad));

alter table public.receipt_items enable row level security;

drop policy if exists "items_select_own" on public.receipt_items;
create policy "items_select_own" on public.receipt_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "items_insert_own" on public.receipt_items;
create policy "items_insert_own" on public.receipt_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = (select auth.uid()))
  );

drop policy if exists "items_delete_own" on public.receipt_items;
create policy "items_delete_own" on public.receipt_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Fişin kalem okuma durumu ----------
-- null: henüz okunmadı (fotoğrafı varsa geriye dönük okuma sırasında), isleniyor, okundu,
-- yok: fişte okunabilir kalem yok, okunamadi: 3 denemede okunamadı
alter table public.receipts add column if not exists kalem_durumu text;
alter table public.receipts drop constraint if exists receipts_kalem_durumu_check;
alter table public.receipts add constraint receipts_kalem_durumu_check
  check (kalem_durumu is null or kalem_durumu in ('isleniyor', 'okundu', 'yok', 'okunamadi'));
alter table public.receipts add column if not exists kalem_deneme smallint not null default 0;
alter table public.receipts add column if not exists kalem_denendi_at timestamptz;
-- Kalemleri okuyan model (geriye dönük okumada Flash / Flash Lite karşılaştırması için)
alter table public.receipts add column if not exists kalem_model text check (kalem_model is null or char_length(kalem_model) <= 60);

create index if not exists receipts_kalem_bekleyen_idx on public.receipts (user_id, tarih desc)
  where image_path is not null and (kalem_durumu is null or kalem_durumu = 'isleniyor');

-- ---------- Zamanlayıcı ----------
-- Gizli değer veritabanında üretilir (kodda ve GitHub'da yok); fonksiyon onu bu fonksiyonla doğrular.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'kalem_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kalem_cron_secret',
      'kalem-doldur fonksiyonunu zamanlayıcıdan çağırma anahtarı');
  end if;
end $$;

create or replace function public.kalem_cron_dogrula(p_gizli text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce(p_gizli, '') <> '' and exists (
    select 1 from vault.decrypted_secrets where name = 'kalem_cron_secret' and decrypted_secret = p_gizli
  )
$$;
revoke all on function public.kalem_cron_dogrula(text) from public, anon, authenticated;
grant execute on function public.kalem_cron_dogrula(text) to service_role;

-- Pasifik gece yarısı yaz saatinde 07:00 UTC, kışın 08:00 UTC; ikisini de kapsayan 06:00–07:59 UTC
-- aralığında 5 dakikada bir çağrılır, fonksiyon yalnızca Pasifik 23:00–23:55 arasında iş yapar.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'kalem-doldur') then
    perform cron.unschedule('kalem-doldur');
  end if;
end $$;

select cron.schedule(
  'kalem-doldur',
  '*/5 6-7 * * *',
  $cron$
  select net.http_post(
    url := 'https://fzhagwcysltvpcgdfrnl.supabase.co/functions/v1/kalem-doldur',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-kalem-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'kalem_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  )
  $cron$
);

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 9 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
