-- =====================================================================
-- Giyim kategorisi. 003'ü çalıştırmış olsanız da olmasanız da bunu çalıştırmanız yeterli
-- (tüm kategori listesini yeniden tanımlar). Mevcut fişlere dokunmaz.
-- =====================================================================

alter table public.receipts drop constraint if exists receipts_kategori_check;
alter table public.receipts add constraint receipts_kategori_check check (kategori in (
  'akaryakıt', 'restoran', 'market', 'teknoloji', 'ofis gideri',
  'ulaşım', 'araç bakım', 'konaklama', 'iletişim', 'faturalar', 'kargo', 'giyim', 'diğer'
));

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 4 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
