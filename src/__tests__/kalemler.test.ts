import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kalemleriAyikla, kalemlerTutarli, kalemSatirlari, kalemToplami, MAX_KALEM, satirdanKalem } from '../../supabase/functions/_shared/kalemler';
import { fromFormValues, toFormValues } from '../lib/receiptForm';
import { fisKalemleriniGetir, kalemleriKaydet } from '../services/supabase/receiptRows';
import { parseReceiptJson } from '../services/vision/parseReceiptJson';

describe('Fiş kalemleri: ayıklama', () => {
  it('geçerli satırlar temizlenir, bozuklar atılır', () => {
    const k = kalemleriAyikla([
      { ad: '  EKMEK   500G ', miktar: 2, birim: 'adet', birimFiyat: 15, tutar: 30, kdvOrani: 1 },
      { ad: 'İNDİRİM', miktar: 1, birim: '', birimFiyat: 0, tutar: -5, kdvOrani: 0 },
      { ad: 'MOTORİN', miktar: '41,52', birim: 'LT', birimFiyat: '48,17', tutar: '2.000,00', kdvOrani: 20 },
      { ad: '', tutar: 10 }, // adsız
      { ad: 'BOŞ', tutar: 0 }, // tutarsız
      'çöp',
      null,
    ]);
    assert.deepEqual(k, [
      { ad: 'EKMEK 500G', miktar: 2, birim: 'ADET', birimFiyat: 15, tutar: 30, kdvOrani: 1 },
      { ad: 'İNDİRİM', miktar: 1, tutar: -5 },
      { ad: 'MOTORİN', miktar: 41.52, birim: 'LT', birimFiyat: 48.17, tutar: 2000, kdvOrani: 20 },
    ]);
  });

  it('dizi değilse boş, en fazla MAX_KALEM satır', () => {
    assert.deepEqual(kalemleriAyikla('yok'), []);
    const cok = Array.from({ length: MAX_KALEM + 10 }, (_, i) => ({ ad: `Ü${i}`, tutar: 1 }));
    assert.equal(kalemleriAyikla(cok).length, MAX_KALEM);
  });

  it('miktar geçersizse 1, toplam ve tutarlılık (±%1, en az 1 ₺)', () => {
    const k = kalemleriAyikla([{ ad: 'A', miktar: -3, tutar: 60.5 }, { ad: 'B', tutar: 39.5 }]);
    assert.equal(k[0]!.miktar, 1);
    assert.equal(kalemToplami(k), 100);
    assert.equal(kalemlerTutarli(k, 100.9), true);
    assert.equal(kalemlerTutarli(k, 102), false);
    assert.equal(kalemlerTutarli([], 100), false);
  });

  it('veritabanı satırına ve geri çevrilir', () => {
    const k = kalemleriAyikla([{ ad: 'SU', miktar: 6, birim: 'ADET', birimFiyat: 5, tutar: 30, kdvOrani: 1 }, { ad: 'POŞET', tutar: 0.5 }]);
    const rows = kalemSatirlari('r1', k, 'geriye_donuk', 'u1');
    assert.deepEqual(rows[1], {
      user_id: 'u1',
      receipt_id: 'r1',
      sira: 1,
      ad: 'POŞET',
      miktar: 1,
      birim: null,
      birim_fiyat: null,
      tutar: 0.5,
      kdv_orani: null,
      kaynak: 'geriye_donuk',
    });
    assert.equal('user_id' in kalemSatirlari('r1', k, 'tarama')[0]!, false);
    // numeric sütunlar metin gelebilir
    assert.deepEqual(satirdanKalem({ ad: 'SU', miktar: '6.000', birim: 'ADET', birim_fiyat: '5.00', tutar: '30.00', kdv_orani: '1.00' }), k[0]);
  });
});

describe('Fiş kalemleri: okuma ve form', () => {
  const json = (extra: object) =>
    JSON.stringify({ firmaAdi: 'BİM', tarih: '01.11.2026', toplamTutar: 30, kdvYuzde1: 0.3, kdvYuzde10: 0, kdvYuzde20: 0, kategori: 'market', fisNo: '', vkn: '', ...extra });

  it('yapay zekâ kalem döndürürse okunur; alan yoksa undefined (okunmadı)', () => {
    const d = parseReceiptJson(json({ kalemler: [{ ad: 'EKMEK', miktar: 1, birim: '', birimFiyat: 30, tutar: 30, kdvOrani: 1 }] }));
    assert.deepEqual(d.kalemler, [{ ad: 'EKMEK', miktar: 1, birimFiyat: 30, tutar: 30, kdvOrani: 1 }]);
    assert.deepEqual(parseReceiptJson(json({ kalemler: [] })).kalemler, []);
    assert.equal(parseReceiptJson(json({})).kalemler, undefined);
  });

  it('kalemler formdan geçerken kaybolmaz (kullanıcı başka alan düzenlese de)', () => {
    const d = parseReceiptJson(json({ kalemler: [{ ad: 'EKMEK', miktar: 1, birim: '', birimFiyat: 30, tutar: 30, kdvOrani: 1 }] }));
    const v = { ...toFormValues(d), firmaAdi: 'BİM A.Ş.' };
    assert.deepEqual(fromFormValues(v).kalemler, d.kalemler);
    assert.equal(fromFormValues(toFormValues({ ...d, kalemler: undefined })).kalemler, undefined);
  });
});

describe('Fiş kalemleri: kaydetme', () => {
  function sahte(hata: { tablo?: string } = {}) {
    const islemler: string[] = [];
    const sonuc = (tablo: string) => ({ error: hata.tablo === tablo ? { code: 'PGRST205', message: 'yok' } : null });
    const client = {
      from: (tablo: string) => ({
        insert: async (rows: unknown[]) => (islemler.push(`${tablo}:insert:${rows.length}`), sonuc(tablo)),
        update: (v: Record<string, unknown>) => ({ eq: async () => (islemler.push(`${tablo}:update:${String(v.kalem_durumu)}`), sonuc(tablo)) }),
        delete: () => ({ eq: async () => (islemler.push(`${tablo}:delete`), sonuc(tablo)) }),
        select: () => ({ eq: () => ({ order: async () => ({ data: hata.tablo ? null : [{ ad: 'A', miktar: 1, tutar: 5 }], ...sonuc(tablo) }) }) }),
      }),
    };
    return { client, islemler };
  }

  it('kalemler yazılır ve fiş "okundu"; boşsa "yok"; okunmadıysa (elle giriş) hiçbir şey', async () => {
    const a = sahte();
    assert.equal(await kalemleriKaydet(a.client, 'r', [{ ad: 'A', miktar: 1, tutar: 5 }]), true);
    assert.deepEqual(a.islemler, ['receipt_items:insert:1', 'receipts:update:okundu']);
    const b = sahte();
    await kalemleriKaydet(b.client, 'r', []);
    assert.deepEqual(b.islemler, ['receipts:update:yok']);
    const c = sahte();
    assert.equal(await kalemleriKaydet(c.client, 'r', undefined), false);
    assert.deepEqual(c.islemler, []);
  });

  it('kurulum yoksa fiş kaydını bozmaz: false döner, durum yazılmaz', async () => {
    const s = sahte({ tablo: 'receipt_items' });
    assert.equal(await kalemleriKaydet(s.client, 'r', [{ ad: 'A', miktar: 1, tutar: 5 }]), false);
    assert.deepEqual(s.islemler, ['receipt_items:insert:1']);
    assert.deepEqual(await fisKalemleriniGetir(s.client, 'r'), []);
  });

  it('kalemler okunur', async () => {
    assert.deepEqual(await fisKalemleriniGetir(sahte().client, 'r'), [{ ad: 'A', miktar: 1, tutar: 5 }]);
  });
});
