// QNB eSolutions connectorService için SOAP yardımcıları. Deno'ya özgü API kullanmaz; birim testleri
// (src/__tests__/qnbSoap.test.ts) Node'da da çalıştırır.
//
// Yalnızca okuma metotları kullanılır: gelenBelgeleriListeleExt ve gidenBelgeleriListele.
// belgelerAlindi gibi durum değiştiren metotlar bilerek yoktur.

export const QNB_URL = 'https://connector.qnbesolutions.com.tr/connector/ws/connectorService';

export type Yon = 'gelen' | 'giden';

/** Uygulamaya dönen sade fatura satırı */
export interface EFatura {
  ettn: string;
  belgeNo: string;
  /** YYYY-MM-DD */
  tarih: string;
  /** Gelen faturada satıcı, giden faturada alıcı */
  unvan: string;
  vkn: string;
  tutar: number;
  paraBirimi: string;
  /** TEMELFATURA, TICARIFATURA, ENERJI… */
  profil: string;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

/** WS-Security UsernameToken başlıklı SOAP 1.1 zarfı */
export function buildEnvelope(op: string, params: Record<string, string>, user: string, pass: string): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
    .join('');
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.connector.uut.cs.com.tr/">' +
    '<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    `<wsse:UsernameToken><wsse:Username>${xmlEscape(user)}</wsse:Username><wsse:Password>${xmlEscape(pass)}</wsse:Password></wsse:UsernameToken>` +
    '</wsse:Security></soapenv:Header>' +
    `<soapenv:Body><ser:${op}><parametreler>${body}</parametreler></ser:${op}></soapenv:Body></soapenv:Envelope>`
  );
}

/** Dönem için istek: gelen faturalar fatura tarihine, giden faturalar gönderim tarihine göre listelenir. */
export function listRequest(yon: Yon, vkn: string, baslangic: string, bitis: string): { op: string; params: Record<string, string> } {
  if (yon === 'gelen') {
    // sonAlinanBelgeSiraNumarasi tarih aralığıyla birlikte gönderilemez (QNB reddediyor).
    // donusTipiVersiyon 6.0: satıcı unvanı ve ödenecek tutar listede gelir, faturayı indirmek gerekmez.
    return {
      op: 'gelenBelgeleriListeleExt',
      params: {
        vergiTcKimlikNo: vkn,
        belgeTuru: 'FATURA',
        donusTipiVersiyon: '6.0',
        faturaTarihiBaslangic: baslangic,
        faturaTarihiBitis: bitis,
        onayDurum: 'HEPSI',
      },
    };
  }
  return {
    op: 'gidenBelgeleriListele',
    params: { vkn, belgeTuru: 'FATURA', baslangicGonderimTarihi: baslangic, bitisGonderimTarihi: bitis },
  };
}

/** SOAP Fault varsa mesajı, yoksa null */
export function parseFault(xml: string): string | null {
  if (!/<(\w+:)?Fault\b/.test(xml)) return null;
  const m = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  return m ? xmlUnescape(m[1]!).trim() : 'Bilinmeyen SOAP hatası';
}

/** Kullanıcı adı/şifre hatası mı? Bu durumda tekrar denenmemeli (hesap kilitlenebilir). */
export function isLoginFault(message: string): boolean {
  return /username\.pwd|pwd\.mismatch|kullan[ıi]c[ıi]\s*ad[ıi]|şifre|parola|password|authenticat|unauthori[sz]ed|kilitl|locked|yetkisiz/i.test(message);
}

/** <return> öğelerinin yaprak alanlarını düz nesne olarak döndürür. */
export function parseReturns(xml: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of xml.matchAll(/<return\b[^>]*>([\s\S]*?)<\/return>/g)) {
    const fields: Record<string, string> = {};
    for (const f of m[1]!.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      fields[f[1]!] ??= xmlUnescape(f[2]!).trim();
    }
    out.push(fields);
  }
  return out;
}

function isoDate(yyyymmdd: string | undefined): string {
  const s = (yyyymmdd ?? '').replace(/\D/g, '');
  return s.length >= 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
}

export function toEFatura(r: Record<string, string>, yon: Yon): EFatura {
  const vkn = (yon === 'gelen' ? r.gonderenVknTckn : r.aliciVkn) ?? '';
  const unvan = (yon === 'gelen' ? r.saticiUnvan || r.gonderenIsim : r.aliciUnvan) || vkn || 'Bilinmeyen firma';
  const tutar = Number(r.odenecekTutar ?? r.payableAmount ?? '');
  return {
    ettn: r.ettn ?? '',
    belgeNo: r.belgeNo ?? '',
    tarih: isoDate(r.belgeTarihi),
    unvan,
    vkn,
    tutar: Number.isFinite(tutar) ? tutar : 0,
    paraBirimi: r.odenecekTutarDovizCinsi || r.dovizCinsi || 'TRY',
    profil: r.profileId ?? r.faturaSenaryo ?? '',
  };
}

/** Yeni tarihli fatura üstte */
export function parseList(xml: string, yon: Yon): EFatura[] {
  return parseReturns(xml)
    .map((r) => toEFatura(r, yon))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.belgeNo.localeCompare(a.belgeNo));
}
