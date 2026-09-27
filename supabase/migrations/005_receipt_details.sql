-- =====================================================================
-- Fiş ayrıntıları: fiş no, satıcı vergi no (VKN/TCKN), ödeme şekli, not.
-- Önceki kurulumları (003, 004) yapmış olsanız da olmasanız da bunu çalıştırmanız yeterli:
-- tüm kategorileri de yeniden tanımlar. Mevcut fişlere dokunmaz.
-- =====================================================================

alter table public.receipts drop constraint if exists receipts_kategori_check;
alter table public.receipts add constraint receipts_kategori_check check (kategori in (
  'akaryakıt', 'restoran', 'market', 'teknoloji', 'ofis gideri',
  'ulaşım', 'araç bakım', 'konaklama', 'iletişim', 'faturalar', 'kargo', 'giyim', 'diğer'
));

alter table public.receipts add column if not exists fis_no text;
alter table public.receipts add column if not exists vergi_no text;
alter table public.receipts add column if not exists odeme text;
alter table public.receipts add column if not exists notlar text;

alter table public.receipts drop constraint if exists receipts_odeme_check;
alter table public.receipts add constraint receipts_odeme_check check (odeme is null or odeme in ('kart', 'nakit', 'diğer'));
alter table public.receipts drop constraint if exists receipts_notlar_check;
alter table public.receipts add constraint receipts_notlar_check check (notlar is null or char_length(notlar) <= 500);

-- Uygulama kurulumun yapıldığını bu fonksiyondan anlar
create or replace function public.receipt_schema_version() returns integer
  language sql stable as $$ select 5 $$;
grant execute on function public.receipt_schema_version() to authenticated;

notify pgrst, 'reload schema';
