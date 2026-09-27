import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { buildXlsx, colName } from '../lib/xlsx';
import { buildReceiptsWorkbook, monthlyRows } from '../services/export/receiptsWorkbook';
import type { ReceiptRecord } from '../types/receipt';

const r = (over: Partial<ReceiptRecord>): ReceiptRecord => ({
  id: 'x', created_at: '2026-09-01T00:00:00Z', firma_adi: 'FİRMA', tarih: '2026-09-01', toplam_tutar: 120, kdv_yuzde1: 0, kdv_yuzde10: 0, kdv_yuzde20: 20, toplam_kdv: 20, kategori: 'market', image_path: null, ...over,
});

describe('xlsx', () => {
  it('sütun adları', () => {
    assert.equal(colName(0), 'A');
    assert.equal(colName(25), 'Z');
    assert.equal(colName(26), 'AA');
    assert.equal(colName(701), 'ZZ');
  });

  it('geçerli bir zip ve zorunlu parçaları üretir', () => {
    const files = unzipSync(buildXlsx([{ name: 'Sayfa', rows: [['a', 1]] }]));
    for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(files[f], f);
  });

  it('özel karakterleri kaçışlar ve geçersiz sayfa adlarını düzeltir', () => {
    const files = unzipSync(buildXlsx([{ name: 'A/B:C*[D]', rows: [['<&>"']] }]));
    assert.ok(strFromU8(files['xl/worksheets/sheet1.xml']).includes('&lt;&amp;&gt;&quot;'));
    assert.ok(!strFromU8(files['xl/workbook.xml']).match(/name="[^"]*[/:*[\]]/));
  });

  it('fiş çalışma kitabı: tarih sırası, formüller ve önceden hesaplanmış değerler', () => {
    const fisler = [r({ id: 'b', firma_adi: 'İKİNCİ', tarih: '2026-09-20', toplam_tutar: 100, kdv_yuzde20: 16.67 }), r({ id: 'a', firma_adi: 'BİRİNCİ', tarih: '2026-09-02' })];
    const bytes = buildReceiptsWorkbook(
      { toplamGider: 220, toplamKdv: 36.67, kdv1: 0, kdv10: 0, kdv20: 36.67, kategoriToplamlari: [{ kategori: 'market', toplam: 220 }], fisler },
      'Eylül 2026',
    );
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
    assert.ok(sheet.indexOf('BİRİNCİ') < sheet.indexOf('İKİNCİ'), 'eskiden yeniye sıralı');
    assert.ok(sheet.includes('<f>SUM(D2:D3)</f><v>220</v>'), 'toplam formülü + önbellek değeri');
    assert.ok(sheet.includes('<f>E3+F3+G3</f><v>16.67</v>'));
  });

  it('birden çok ay varsa "Aylar" sayfası ekler', () => {
    const summary = (fisler: ReceiptRecord[]) => ({ toplamGider: 0, toplamKdv: 0, kdv1: 0, kdv10: 0, kdv20: 0, kategoriToplamlari: [], fisler });
    const tek = unzipSync(buildReceiptsWorkbook(summary([r({}), r({ tarih: '2026-09-20' })]), 'Eylül'));
    assert.ok(!strFromU8(tek['xl/workbook.xml']).includes('Aylar'));
    const cok = unzipSync(buildReceiptsWorkbook(summary([r({}), r({ tarih: '2026-10-02' })]), '2026'));
    assert.ok(strFromU8(cok['xl/workbook.xml']).includes('Aylar'));
  });

  it('aylık toplamlar doğru', () => {
    const rows = monthlyRows([r({ tarih: '2026-10-05', toplam_tutar: 50, kdv_yuzde20: 0, kdv_yuzde1: 0.5 }), r({}), r({ tarih: '2026-09-15' })])!;
    assert.equal(rows.length, 4); // başlık + 2 ay + toplam
    assert.equal(rows[1][0], 'Eylül 2026');
    assert.equal(rows[1][1], 2);
    assert.deepEqual(rows[1][2], { v: 240, s: 'money' });
    assert.equal(rows[2][0], 'Ekim 2026');
    assert.equal((rows[3][1] as { v: number }).v, 3);
    assert.equal((rows[3][6] as { v: number }).v, 40.5);
  });
});
