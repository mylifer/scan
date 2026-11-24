// QNB eSolutions'a fatura göndermek için SOAP istekleri ve yanıt çözümleyicileri. Deno'ya özgü API kullanmaz;
// birim testleri (src/__tests__/faturaKes.test.ts) Node'da da çalıştırır.
//
// Metotlar (QNB connectorService / EarsivWebService):
//   efaturaKullanicisi   alıcı e-Fatura mükellefi mi (yalnızca okuma)
//   faturaNoUret         e-Fatura numarası (seri + yıl + sıra) alır
//   belgeGonder          e-Fatura gönderir (UBL; veri base64, belgeHash = XML'in MD5'i)
//   gidenBelgeDurumSorgula  gönderilen e-Faturanın durumu
//   faturaOlustur        e-Arşiv faturası oluşturur (QNB numara verir)
// ÖNEMLİ: Bu metotların parametreleri QNB'nin örnek entegrasyonlarından alındı; test ortamında doğrulanmalı.

export const NS_EFATURA = 'http://service.connector.uut.cs.com.tr/';
export const NS_EARSIV = 'http://service.earsiv.uut.cs.com.tr/';

export const CANLI_EFATURA_URL = 'https://connector.qnbesolutions.com.tr/connector/ws/connectorService';
export const CANLI_EARSIV_URL = 'https://earsivconnector.qnbesolutions.com.tr/earsiv/ws/EarsivWebService';
/** QNB'nin test sunucuları (QNB farklı adres verirse QNB_TEST_EFATURA_URL / QNB_TEST_EARSIV_URL ile değiştirilir) */
export const TEST_EFATURA_URL = 'https://erpefaturatest.cs.com.tr:8443/efatura/ws/connectorService';
export const TEST_EARSIV_URL = 'https://earsivtest.efinans.com.tr/earsiv/ws/EarsivWebService';

export const EARSIV_OK = 'AE00000';

const kac = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const coz = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, x: string) => {
    const k = x.toLowerCase();
    const sabit: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (sabit[k]) return sabit[k]!;
    const c = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(c) ? String.fromCodePoint(c) : m;
  });

/** Düz parametrelerden gövde: { a: '1' } → <a>1</a> (değerler XML-escape edilir) */
export function alanlar(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `<${k}>${kac(v)}</${k}>`)
    .join('');
}

/** WS-Security UsernameToken başlıklı SOAP 1.1 zarfı; `govde` hazır XML'dir. */
export function zarf(op: string, govde: string, user: string, pass: string, earsiv = false): string {
  const ns = earsiv ? NS_EARSIV : NS_EFATURA;
  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${ns}">` +
    '<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    `<wsse:UsernameToken><wsse:Username>${kac(user)}</wsse:Username><wsse:Password>${kac(pass)}</wsse:Password></wsse:UsernameToken>` +
    '</wsse:Security></soapenv:Header>' +
    `<soapenv:Body><ser:${op}>${govde}</ser:${op}></soapenv:Body></soapenv:Envelope>`
  );
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** MD5 (onaltılık, küçük harf). Web Crypto MD5 desteklemediği için burada. */
export function md5(bytes: Uint8Array): string {
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const n = bytes.length;
  const len = (((n + 8) >>> 6) + 1) << 6;
  const m = new Uint8Array(len);
  m.set(bytes);
  m[n] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(len - 8, (n * 8) >>> 0, true);
  dv.setUint32(len - 4, Math.floor(n / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < len; o += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      f = (f + a + K[i]! + dv.getUint32(o + g * 4, true)) >>> 0;
      a = d; d = c; c = b;
      const s = S[(i >>> 4) * 4 + (i % 4)]!;
      b = (b + ((f << s) | (f >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map((x) => [0, 8, 16, 24].map((k) => ((x >>> k) & 0xff).toString(16).padStart(2, '0')).join(''))
    .join('');
}

// ---------- istekler ----------

export function mukellefIstegi(vknTckn: string): { op: string; govde: string } {
  return { op: 'efaturaKullanicisi', govde: alanlar({ vergiTcKimlikNo: vknTckn }) };
}

export function faturaNoIstegi(saticiVkn: string, seri: string): { op: string; govde: string } {
  return { op: 'faturaNoUret', govde: alanlar({ vknTckn: saticiVkn, faturaKodu: seri }) };
}

/** e-Fatura gönderimi. `belgeNo` QNB tarafındaki yerel referanstır (ETTN kullanılır), fatura numarası değil. */
export function belgeGonderIstegi(saticiVkn: string, ettn: string, xml: string): { op: string; govde: string } {
  const b = utf8(xml);
  return {
    op: 'belgeGonder',
    govde: alanlar({
      vergiTcKimlikNo: saticiVkn,
      belgeTuru: 'FATURA_UBL',
      belgeNo: ettn,
      veri: base64(b),
      belgeHash: md5(b),
      mimeType: 'application/xml',
      belgeVersiyon: '3.0',
    }),
  };
}

export function durumIstegi(saticiVkn: string, belgeOid: string): { op: string; govde: string } {
  return { op: 'gidenBelgeDurumSorgula', govde: alanlar({ vergiTcKimlikNo: saticiVkn, belgeOid }) };
}

/** e-Arşiv faturası: numara QNB'den (numaraVerilsinMi), ETTN işlem kimliği olarak da kullanılır. */
export function earsivOlusturIstegi(saticiVkn: string, ettn: string, xml: string, seri: string): { op: string; govde: string } {
  const input: Record<string, string | number> = {
    donenBelgeFormati: 9,
    islemId: ettn,
    vkn: saticiVkn,
    sube: 'DFLT',
    kasa: 'DFLT',
    numaraVerilsinMi: 1,
  };
  if (seri) input.faturaSeri = seri;
  return {
    op: 'faturaOlustur',
    govde:
      alanlar({ input: JSON.stringify(input) }) +
      `<fatura><belgeFormati>UBL</belgeFormati><belgeIcerigi>${base64(utf8(xml))}</belgeIcerigi></fatura>`,
  };
}

// ---------- yanıtlar ----------

/** SOAP Fault mesajı (yoksa null) */
export function hataMesaji(xml: string): string | null {
  const m = /<faultstring[^>]*>([\s\S]*?)<\/faultstring>/.exec(xml);
  return m ? coz(m[1]!).trim() || 'Bilinmeyen QNB hatası' : null;
}

export function girisHatasiMi(mesaj: string): boolean {
  return /kullan[ıi]c[ıi]\s*ad[ıi]|şifre|sifre|parola|password|authentic|unauthori|yetki|bloke|locked/i.test(mesaj);
}

/** <return>…</return> içindeki düz metin (alt etiket yoksa) */
export function donusMetni(xml: string): string | null {
  const m = /<return\b[^>]*>([^<]*)<\/return>/.exec(xml);
  return m ? coz(m[1]!).trim() : null;
}

/** efaturaKullanicisi yanıtı: true/false; anlaşılamazsa null */
export function mukellefMi(xml: string): boolean | null {
  const v = donusMetni(xml)?.toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

/** GİB fatura numarası: 3 karakter seri + 4 hane yıl + 9 hane sıra */
export const FATURA_NO_RE = /^[A-Z0-9]{3}\d{13}$/;
export const SERI_RE = /^[A-Z0-9]{3}$/;

export function faturaNo(xml: string): string | null {
  const v = donusMetni(xml);
  return v && FATURA_NO_RE.test(v) ? v : null;
}

/** <return> içindeki alt etiketler (ilk düzey, düz metin) */
export function donusAlanlari(xml: string): Record<string, string> {
  const m = /<return\b[^>]*>([\s\S]*?)<\/return>/.exec(xml);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const f of m[1]!.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) out[f[1]!] ??= coz(f[2]!).trim();
  return out;
}

/** e-Arşiv sonucu: kod, metin ve resultExtra anahtar/değerleri (faturaNo, uuid, faturaURL…) */
export function earsivSonucu(xml: string): { kod: string; metin: string; ek: Record<string, string> } {
  const r = donusAlanlari(xml);
  const ek: Record<string, string> = {};
  for (const m of xml.matchAll(/<entry>\s*<key>([^<]*)<\/key>\s*<value>([^<]*)<\/value>\s*<\/entry>/g)) {
    ek[coz(m[1]!).trim()] = coz(m[2]!).trim();
  }
  return { kod: r.resultCode ?? '', metin: r.resultText ?? '', ek };
}
