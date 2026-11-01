import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { approveAll, bulkSummary, type BulkItem } from '../lib/bulkApprove';
import { emptyForm, type ReceiptFormValues } from '../lib/receiptForm';

const form = (patch: Partial<ReceiptFormValues>): ReceiptFormValues => ({
  ...emptyForm(),
  firmaAdi: 'Migros',
  tarih: '15.10.2026',
  toplamTutar: '120,00',
  kdvYuzde20: '20,00',
  ...patch,
});

describe('Toplu onay', () => {
  it('sağlam fişleri kaydeder; hatalı, belirsiz, mükerrer ve kaydedilemeyenleri incelemeye bırakır', async () => {
    const items: BulkItem[] = [
      { id: 'ok1', values: form({}) },
      { id: 'hatali', values: form({ firmaAdi: '' }) },
      { id: 'belirsiz', values: form({ belirsiz: ['toplamTutar'] }) },
      { id: 'mukerrer', values: form({ toplamTutar: '999,00' }) },
      { id: 'patlayan', values: form({ firmaAdi: 'Hata AŞ' }) },
      { id: 'ok2', values: form({ firmaAdi: 'A101' }) },
    ];
    const saved: string[] = [];
    const progress: number[] = [];
    const r = await approveAll(
      items,
      {
        isDuplicate: async (d) => d.toplamTutar === 999,
        save: async (id) => {
          if (id === 'patlayan') throw new Error('ağ hatası');
          saved.push(id);
        },
      },
      (done) => progress.push(done),
    );
    assert.deepEqual(r.saved, ['ok1', 'ok2']);
    assert.deepEqual(saved, ['ok1', 'ok2']);
    assert.deepEqual(
      r.skipped.map((s) => `${s.id}:${s.reason}`),
      ['hatali:hata', 'belirsiz:belirsiz', 'mukerrer:mukerrer', 'patlayan:kaydedilemedi'],
    );
    assert.deepEqual(progress, [1, 2, 3, 4, 5, 6]);
    assert.equal(
      bulkSummary(r),
      '2 fiş kaydedildi. 4 fiş kontrol bekliyor (1 olası mükerrer, 1 eksik/hatalı bilgi, 1 emin olunamayan alan, 1 kaydedilemedi).',
    );
  });

  it('hepsi sağlamsa yalnızca kaydedilen sayısını yazar', async () => {
    const r = await approveAll([{ id: 'a', values: form({}) }], { isDuplicate: async () => false, save: async () => {} });
    assert.equal(bulkSummary(r), '1 fiş kaydedildi.');
  });
});
