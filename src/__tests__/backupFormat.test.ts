import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backupFilename, buildManifest, parseManifest, planRestore, receiptKey } from '../lib/backupFormat';
import type { ReceiptRecord } from '../types/receipt';

const rec = (id: string, firma_adi: string, tarih: string, toplam_tutar: number, image_path: string | null = null): ReceiptRecord => ({
  id,
  created_at: '2026-09-01T10:00:00Z',
  firma_adi,
  tarih,
  toplam_tutar,
  kdv_yuzde1: 0,
  kdv_yuzde10: 0,
  kdv_yuzde20: round(toplam_tutar / 6),
  toplam_kdv: round(toplam_tutar / 6),
  kategori: 'market',
  image_path,
});
const round = (n: number) => Math.round(n * 100) / 100;

describe('yedek biçimi', () => {
  it('manifest → JSON → geri okuma aynı fişleri verir; fotoğrafı olmayanlar null', () => {
    const list = [rec('a1', 'MİGROS', '2026-09-03', 120, 'u/a.jpg'), rec('b2', 'OPET', '2026-09-04', 1500, 'u/b.jpg'), rec('c3', 'BİM', '2026-09-05', 45)];
    const m = buildManifest(list, new Set(['a1']), '2026-10-03T12:00:00Z', '1.29.0');
    const back = parseManifest(JSON.stringify(m));
    assert.equal(back.receipts.length, 3);
    assert.equal(back.receipts[0]!.photo, 'fotograflar/a1.jpg');
    assert.equal(back.receipts[1]!.photo, null, 'indirilemeyen fotoğraf yedekte yok sayılır');
    assert.equal(back.receipts[1]!.toplam_tutar, 1500);
    assert.equal(back.receipts[2]!.kategori, 'market');
  });

  it('başka dosyalar ve bozuk veriler anlaşılır hatayla reddedilir', () => {
    assert.throws(() => parseManifest('{bozuk'), /bozuk/);
    assert.throws(() => parseManifest('{"format":"baska"}'), /yedeği değil/);
    assert.throws(() => parseManifest(JSON.stringify({ format: 'fis-tarayici-yedek', version: 99, receipts: [] })), /daha yeni/);
    const bad = buildManifest([rec('a', 'X', '2026-09-03', 10)], new Set(), '', '');
    (bad.receipts[0] as { tarih: string }).tarih = '03.09.2026';
    assert.throws(() => parseManifest(JSON.stringify(bad)), /1\. fiş geçersiz/);
    const badCat = buildManifest([rec('a', 'X', '2026-09-03', 10)], new Set(), '', '');
    (badCat.receipts[0] as { kategori: string }).kategori = 'uydurma';
    assert.throws(() => parseManifest(JSON.stringify(badCat)), /geçersiz/);
    const traversal = buildManifest([rec('a', 'X', '2026-09-03', 10)], new Set(['a']), '', '');
    traversal.receipts[0]!.photo = '../../etc/passwd';
    assert.equal(parseManifest(JSON.stringify(traversal)).receipts[0]!.photo, null);
  });

  it('geri yükleme planı: zaten olanlar atlanır, aynı gün aynı tutarlı iki fiş korunur', () => {
    const backup = parseManifest(
      JSON.stringify(
        buildManifest(
          [rec('1', 'Kahveci', '2026-09-03', 80), rec('2', 'KAHVECİ ', '2026-09-03', 80), rec('3', 'OPET', '2026-09-04', 1500), rec('4', 'BİM', '2026-09-05', 45)],
          new Set(),
          '',
          '',
        ),
      ),
    ).receipts;
    const existing = [rec('x', 'kahveci', '2026-09-03', 80), rec('y', 'OPET', '2026-09-04', 1500.0)];
    const plan = planRestore(backup, existing);
    assert.equal(plan.skipped, 2);
    assert.deepEqual(plan.toInsert.map((r) => r.id), ['2', '4']);
    // Aynı yedek ikinci kez yüklenirse hiçbir şey eklenmez
    assert.equal(planRestore(backup, [...existing, ...plan.toInsert]).toInsert.length, 0);
  });

  it('yardımcılar', () => {
    assert.equal(receiptKey({ firma_adi: ' a  b ', tarih: '2026-01-02', toplam_tutar: 5 }), '2026-01-02|5.00|A B');
    assert.equal(backupFilename(new Date(2026, 9, 3)), 'Fis_Yedek_2026-10-03.zip');
  });
});
