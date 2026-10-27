import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { strFromU8, strToU8, unzipSync } from 'fflate';

import { crc32, ZipStream } from '../lib/zipStream';

function build(add: (z: ZipStream) => void): Uint8Array {
  const chunks: Uint8Array[] = [];
  const z = new ZipStream((c) => chunks.push(c));
  add(z);
  z.end();
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

describe('ZipStream', () => {
  it('CRC-32 standart değeri', () => {
    assert.equal(crc32(strToU8('123456789')), 0xcbf43926);
  });

  it('sıkıştırılmış ve sıkıştırılmamış dosyalar geri açılır, Türkçe adlar korunur', () => {
    const text = strToU8('a'.repeat(5000));
    const photo = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const files = unzipSync(
      build((z) => {
        z.add('Fisler.xlsx', text, true);
        z.add('Fotograflar/çiçek.jpg', photo, false);
      }),
    );
    assert.equal(strFromU8(files['Fisler.xlsx']), 'a'.repeat(5000));
    assert.deepEqual(files['Fotograflar/çiçek.jpg'], photo);
  });

  it('boyut ve CRC dosya başlığında; data descriptor yok (macOS Arşiv İzlencesi bunu açamıyor)', () => {
    const bytes = build((z) => {
      z.add('a.jpg', new Uint8Array([1, 2, 3]), false);
      z.add('b.txt', strToU8('x'.repeat(100)), true);
    });
    const v = new DataView(bytes.buffer);
    let at = 0;
    for (let i = 0; i < 2; i++) {
      assert.equal(v.getUint32(at, true), 0x04034b50, 'yerel başlık imzası');
      assert.equal(v.getUint16(at + 6, true) & 0x8, 0, 'bit 3 (data descriptor) kapalı');
      const csize = v.getUint32(at + 18, true);
      assert.ok(csize > 0, 'sıkıştırılmış boyut başlıkta');
      assert.ok(v.getUint32(at + 14, true) !== 0, 'CRC başlıkta');
      at += 30 + v.getUint16(at + 26, true) + csize; // sonraki başlık hemen ardından gelir
    }
    assert.equal(v.getUint32(at, true), 0x02014b50, 'ardından merkez dizin');
  });
});
