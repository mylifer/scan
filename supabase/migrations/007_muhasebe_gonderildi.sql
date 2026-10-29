-- =====================================================================
-- Muhasebeciye gönderildi işareti: fişin muhasebeciye gönderildiği an (boşsa gönderilmedi).
-- 006 kurulumundan sonra çalıştırılır. Mevcut fişlere dokunmaz, tekrar çalıştırılabilir.
-- =====================================================================

alter table public.receipts add column if not exists muhasebe_gonderildi_at timestamptz;

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 7 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
