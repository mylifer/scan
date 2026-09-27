import { normalizeTrDate, parseAmount, todayTr } from '../../lib/format';
import { KATEGORILER, type Kategori, type ReceiptData } from '../../types/receipt';
import { VisionServiceError } from './VisionService';

/**
 * Modelden gelen ham metni doğrulanmış ReceiptData'ya çevirir.
 * Sağlayıcıdan bağımsızdır: markdown çitleri, fazladan metin, virgüllü sayılar
 * gibi sapmaları tolere eder; böylece her adapter aynı çıktıyı üretir.
 */
export function parseReceiptJson(raw: string): ReceiptData {
  const obj = extractJsonObject(raw);

  return {
    firmaAdi: typeof obj.firmaAdi === 'string' ? obj.firmaAdi.trim() : '',
    tarih: (typeof obj.tarih === 'string' && normalizeTrDate(obj.tarih)) || todayTr(),
    toplamTutar: parseAmount(obj.toplamTutar),
    kdvYuzde1: parseAmount(obj.kdvYuzde1),
    kdvYuzde10: parseAmount(obj.kdvYuzde10),
    kdvYuzde20: parseAmount(obj.kdvYuzde20),
    kategori: normalizeKategori(obj.kategori),
  };
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new VisionServiceError('Modelden geçerli bir JSON gelmedi.');
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (e) {
    throw new VisionServiceError('Modelden gelen JSON çözümlenemedi.', e);
  }
  throw new VisionServiceError('Modelden gelen JSON beklenen yapıda değil.');
}

function normalizeKategori(value: unknown): Kategori {
  if (typeof value !== 'string') return 'diğer';
  const v = value.toLocaleLowerCase('tr-TR').trim();
  const exact = KATEGORILER.find((k) => k === v);
  if (exact) return exact;
  if (/akaryak|benzin|motorin|yakıt|opet|shell|petrol|lpg/.test(v)) return 'akaryakıt';
  if (/restoran|cafe|kafe|yemek|lokanta/.test(v)) return 'restoran';
  if (/market|gıda|süpermarket/.test(v)) return 'market';
  if (/teknoloji|elektronik|bilgisayar|yazılım/.test(v)) return 'teknoloji';
  if (/ofis|kırtasiye|temizlik/.test(v)) return 'ofis gideri';
  if (/ulaşım|ulasim|taksi|otopark|otoyol|köprü|bilet|toplu taşıma/.test(v)) return 'ulaşım';
  if (/bakım|bakim|servis|lastik|yedek parça|yıkama|oto/.test(v)) return 'araç bakım';
  if (/konaklama|otel|pansiyon/.test(v)) return 'konaklama';
  if (/iletişim|iletisim|telefon|internet|gsm/.test(v)) return 'iletişim';
  if (/fatura|elektrik|su |doğalgaz|dogalgaz/.test(v)) return 'faturalar';
  if (/kargo|posta|kurye/.test(v)) return 'kargo';
  if (/giyim|kıyafet|elbise|ayakkabı|tekstil|konfeksiyon/.test(v)) return 'giyim';
  return 'diğer';
}
