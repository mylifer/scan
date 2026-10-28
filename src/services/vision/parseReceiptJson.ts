import { normalizeTrDate, parseAmount, todayTr } from '../../lib/format';
import { allCategories, findCategory } from '../../lib/categories';
import { cleanFisNo, cleanTaxId } from '../../lib/receiptExtras';
import { type Kategori, RECEIPT_FIELDS, type ReceiptData, type ReceiptField } from '../../types/receipt';
import { VisionServiceError } from './VisionService';

/**
 * Modelden gelen ham metni doğrulanmış ReceiptData'ya çevirir.
 * Sağlayıcıdan bağımsızdır: markdown çitleri, fazladan metin, virgüllü sayılar
 * gibi sapmaları tolere eder; böylece her adapter aynı çıktıyı üretir.
 */
export function parseReceiptJson(raw: string, categories: readonly Kategori[] = allCategories()): ReceiptData {
  const obj = extractJsonObject(raw);

  const data: ReceiptData = {
    firmaAdi: typeof obj.firmaAdi === 'string' ? obj.firmaAdi.trim() : '',
    tarih: (typeof obj.tarih === 'string' && normalizeTrDate(obj.tarih)) || todayTr(),
    toplamTutar: parseAmount(obj.toplamTutar),
    kdvYuzde1: parseAmount(obj.kdvYuzde1),
    kdvYuzde10: parseAmount(obj.kdvYuzde10),
    kdvYuzde20: parseAmount(obj.kdvYuzde20),
    kategori: normalizeKategori(obj.kategori, categories),
  };
  const fisNo = cleanFisNo(obj.fisNo);
  if (fisNo) data.fisNo = fisNo;
  // VKN 10, TCKN 11 hane: başka uzunluktaki (yanlış okunmuş) değerler yazılmaz
  const vkn = cleanTaxId(obj.vkn);
  if (vkn.length === 10 || vkn.length === 11) data.vkn = vkn;
  const uncertain = uncertainFields(obj.eminOlunmayanlar);
  if (uncertain.length) data.eminOlunmayanlar = uncertain;
  return data;
}

/** Bilinen alan adlarını süzer (tekrarsız, form sırasıyla) */
function uncertainFields(value: unknown): ReceiptField[] {
  if (!Array.isArray(value)) return [];
  const names = new Set(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()));
  return RECEIPT_FIELDS.filter((f) => names.has(f));
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

function normalizeKategori(value: unknown, categories: readonly Kategori[]): Kategori {
  if (typeof value !== 'string') return 'diğer';
  const exact = findCategory(value, categories);
  if (exact) return exact;
  const v = value.toLocaleLowerCase('tr-TR').trim();
  // Yeni kategoriler önce: "yapı market", "kişisel bakım" gibi adlar eski kurallara (market, bakım) takılmasın
  if (/sağlık|saglik|eczane|hastane|klinik|muayene|optik/.test(v)) return 'sağlık';
  if (/eğitim|egitim|kurs|okul|kitap|seminer/.test(v)) return 'eğitim';
  if (/kira|aidat/.test(v)) return 'kira';
  if (/sigorta|kasko/.test(v)) return 'sigorta';
  if (/abonelik|üyelik|uyelik/.test(v)) return 'abonelik';
  if (/reklam|ilan|matbaa|tanıtım/.test(v)) return 'reklam';
  if (/vergi|harç|harc|noter|tapu|ruhsat/.test(v)) return 'vergi ve harç';
  if (/banka|eft|havale/.test(v)) return 'banka masrafı';
  if (/yapı|yapi|hırdavat|nalbur|boya|tadilat|mobilya/.test(v)) return 'yapı market';
  if (/kuaför|kuafor|berber|kozmetik|kişisel bakım/.test(v)) return 'kişisel bakım';
  if (/hediye|çiçek|cicek/.test(v)) return 'hediye';
  if (/eğlence|eglence|sinema|konser|tiyatro|etkinlik/.test(v)) return 'eğlence';
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
