import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { imageSize } from '../lib/imageSize';
import { buildXlsx, cellRef, colName } from '../lib/xlsx';
import { buildReceiptsWorkbook, monthlyRows, writeReceiptsWorkbookWithPhotos } from '../services/export/receiptsWorkbook';
import type { ReceiptRecord } from '../types/receipt';

const r = (over: Partial<ReceiptRecord>): ReceiptRecord => ({
  id: 'x', created_at: '2026-09-01T00:00:00Z', firma_adi: 'FİRMA', tarih: '2026-09-01', toplam_tutar: 120, kdv_yuzde1: 0, kdv_yuzde10: 0, kdv_yuzde20: 20, toplam_kdv: 20, kategori: 'market', image_path: null, fis_no: null, vkn: null, notlar: null, etiketler: [], muhasebe_gonderildi_at: null, ...over,
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

  it('geçersiz XML karakterlerini atar, emojiyi korur', () => {
    const files = unzipSync(buildXlsx([{ name: 'S', rows: [['A\u0001B\uFFFFC\uD800D😀']] }]));
    const xml = strFromU8(files['xl/worksheets/sheet1.xml']);
    assert.ok(xml.includes('ABCD😀'), xml);
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

  it('hücre adresi: sayfa adı tırnaklı, tırnak ikilenir', () => {
    assert.equal(cellRef('Fiş 1', 4, 0), "'Fiş 1'!A5");
    assert.equal(cellRef("Ali'nin", 0, 9), "'Ali''nin'!J1");
  });
});

/** Yalnızca başlığı olan sahte JPEG: APP0 + SOF0 (genişlik × yükseklik) */
function fakeJpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}

describe('imageSize', () => {
  it('JPEG boyutunu okur', () => {
    assert.deepEqual(imageSize(fakeJpeg(900, 1850)), { width: 900, height: 1850, ext: 'jpeg' });
  });

  it('PNG boyutunu okur', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x84, 0, 0, 1, 0x2c]);
    assert.deepEqual(imageSize(png), { width: 900, height: 300, ext: 'png' });
  });

  it('tanınmayan dosyada null', () => {
    assert.equal(imageSize(new Uint8Array([1, 2, 3, 4, 5])), null);
    assert.equal(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0, 0, 0, 0, 0, 0])), null);
  });
});

describe('fotoğraflı Excel', () => {
  const summary = (fisler: ReceiptRecord[]) => ({ toplamGider: 0, toplamKdv: 0, kdv1: 0, kdv10: 0, kdv20: 0, kategoriToplamlari: [], fisler });

  async function build(fisler: ReceiptRecord[], fetch: (p: string) => Promise<Uint8Array>) {
    const chunks: Uint8Array[] = [];
    const result = await writeReceiptsWorkbookWithPhotos(summary(fisler), 'Eylül', (c) => chunks.push(c), fetch);
    const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    return { result, files: unzipSync(all) };
  }

  it('her fotoğraf dosyaya bir kez girer; küçük resim kendi sayfasına, o sayfa fişe bağlanır', async () => {
    const fisler = [
      r({ id: 'b', firma_adi: 'İKİNCİ', tarih: '2026-09-20', image_path: 'b.jpg' }),
      r({ id: 'a', firma_adi: 'BİRİNCİ', tarih: '2026-09-02', image_path: 'a.jpg' }),
      r({ id: 'c', firma_adi: 'FOTOĞRAFSIZ', tarih: '2026-09-10' }),
    ];
    const { result, files } = await build(fisler, async () => fakeJpeg(900, 1800));
    assert.deepEqual(result, { photos: 2, failed: 0 });
    assert.equal(Object.keys(files).filter((f) => f.startsWith('xl/media/')).length, 2);
    const wb = strFromU8(files['xl/workbook.xml']);
    assert.ok(wb.includes('name="Fiş 1"') && wb.includes('name="Fiş 2"'), 'her fotoğrafa bir sayfa');

    const fisSheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    assert.ok(fisSheet.includes('Fotoğraf'), 'başlık sütunu');
    assert.ok(fisSheet.includes('<row r="2" ht="60" customHeight="1">'), 'fotoğraflı satır yükseltilir');
    assert.ok(!fisSheet.includes('<row r="3" ht='), 'fotoğrafsız satır normal yükseklikte');
    assert.ok(fisSheet.includes(`<hyperlink ref="J2" location="'Fiş 1'!A1"`), 'ilk (en eski) fiş ilk sayfaya gider');
    assert.ok(fisSheet.includes(`<hyperlink ref="J4" location="'Fiş 2'!A1"`), 'fotoğrafsız satır atlanır');
    assert.ok(fisSheet.includes('<drawing r:id="rId1"/>'));

    const thumbRels = strFromU8(files['xl/drawings/_rels/drawing1.xml.rels']);
    assert.ok(thumbRels.includes(`Target="#'Fiş 1'!A1"`), 'küçük resme tıklayınca kendi sayfasına gider');

    // Sayfalar: Fişler, Özet, Fiş 1, Fiş 2
    const first = strFromU8(files['xl/worksheets/sheet3.xml']);
    assert.ok(first.includes('BİRİNCİ'));
    assert.ok(first.includes(`location="'Fişler'!A2"`), 'fişlere dön bağlantısı');
    assert.ok(first.includes('<c r="A2" s="10" t="inlineStr">'), 'fişlere dön düğme görünümünde');
    assert.ok(first.includes('ySplit="2"'), 'başlık ve düğme kaydırınca sabit kalır');
    assert.ok(strFromU8(files['xl/worksheets/sheet4.xml']).includes(`location="'Fişler'!A4"`));
    // Tam boyut: 900×1800 px → EMU (1 px = 9525)
    assert.ok(strFromU8(files['xl/drawings/drawing2.xml']).includes(`<xdr:ext cx="${900 * 9525}" cy="${1800 * 9525}"/>`));
  });

  it('indirilemeyen fotoğraf dosyayı bozmaz, hücrede not düşülür', async () => {
    const fisler = [r({ id: 'a', image_path: 'a.jpg' }), r({ id: 'b', tarih: '2026-09-03', image_path: 'yok.jpg' })];
    const { result, files } = await build(fisler, async (p) => {
      if (p === 'yok.jpg') throw new Error('404');
      return fakeJpeg(800, 1200);
    });
    assert.deepEqual(result, { photos: 1, failed: 1 });
    assert.ok(strFromU8(files['xl/worksheets/sheet1.xml']).includes('indirilemedi'));
  });

  it('hiç fotoğraf indirilemezse fotoğraf sayfası eklenmez', async () => {
    const { files } = await build([r({ id: 'a', image_path: 'a.jpg' })], async () => new Uint8Array([1, 2, 3]));
    assert.ok(!strFromU8(files['xl/workbook.xml']).includes('Fiş 1'));
    assert.ok(strFromU8(files['xl/worksheets/sheet1.xml']).includes('indirilemedi'));
  });
});
