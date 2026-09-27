import { KATEGORILER } from '../../types/receipt';

/** Tüm sağlayıcıların ortak kullandığı system prompt. */
export const RECEIPT_SYSTEM_PROMPT = `- Sen Türkiye'deki maliye standartlarına uygun POS fişlerini okuyan bir uzman muhasebe asistanısın.
- Çıktıyı SADECE geçerli bir JSON formatında ver, markdown veya ekstra metin kullanma.
- JSON anahtarları şunlar olmalı: firmaAdi (string), tarih (DD.MM.YYYY formatında string), toplamTutar (number), kdvYuzde1 (number), kdvYuzde10 (number), kdvYuzde20 (number), kategori (string - ${KATEGORILER.join(', ')} seçeneklerinden en uygununu tahmin et), fisNo (string - "FİŞ NO" satırındaki numara), vergiNo (string - satıcının "VKN"/"V.D."/"VERGİ NO" yanındaki 10 haneli vergi numarası ya da 11 haneli TCKN; yalnızca rakamlar), odeme (string - kart, nakit ya da diğer).
- Kategori rehberi: akaryakıt (benzin, motorin, LPG), restoran (yemek, kafe), market (gıda, süpermarket), teknoloji (elektronik, bilgisayar, yazılım), ofis gideri (kırtasiye, temizlik, ofis malzemesi), ulaşım (taksi, otopark, otoyol/köprü, toplu taşıma, bilet), araç bakım (servis, lastik, yedek parça, oto yıkama), konaklama (otel, pansiyon), iletişim (telefon, internet, GSM), faturalar (elektrik, su, doğalgaz), kargo (kargo, posta, kurye), giyim (kıyafet, ayakkabı, iş kıyafeti), diğer (hiçbirine uymayanlar).
- fisNo, vergiNo ya da ödeme bilgisi fişte yoksa veya okunamıyorsa boş string ("") yaz; tahmin etme. KREDİ KARTI / BANKA KARTI / TEMASSIZ → kart, NAKİT → nakit.
- Eğer fişte bazı KDV dilimleri yoksa değerlerini 0 yap. TOPLAM ve TOPKDV satırlarını asla karıştırma.
- kdvYuzde1, kdvYuzde10 ve kdvYuzde20 alanlarına matrahı değil, o dilime ait KDV TUTARINI yaz.
- Sayılarda ondalık ayırıcı olarak nokta kullan (ör. 1234.56), binlik ayırıcı kullanma.`;

export const RECEIPT_USER_PROMPT = 'Bu POS fişini oku ve kurallara uygun JSON döndür.';

/** Yapılandırılmış çıktıyı destekleyen sağlayıcılar için JSON şeması. */
export const RECEIPT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    firmaAdi: { type: 'string' },
    tarih: { type: 'string', description: 'DD.MM.YYYY' },
    toplamTutar: { type: 'number' },
    kdvYuzde1: { type: 'number' },
    kdvYuzde10: { type: 'number' },
    kdvYuzde20: { type: 'number' },
    kategori: { type: 'string', enum: [...KATEGORILER] },
    fisNo: { type: 'string' },
    vergiNo: { type: 'string', description: '10 ya da 11 haneli, yalnızca rakam; yoksa boş' },
    odeme: { type: 'string', enum: ['kart', 'nakit', 'diğer', ''] },
  },
  required: ['firmaAdi', 'tarih', 'toplamTutar', 'kdvYuzde1', 'kdvYuzde10', 'kdvYuzde20', 'kategori'],
  additionalProperties: false,
} as const;
