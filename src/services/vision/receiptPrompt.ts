import { allCategories, isBuiltinCategory } from '../../lib/categories';
import { type Kategori, RECEIPT_FIELDS } from '../../types/receipt';

const CATEGORY_GUIDE =
  'akaryakıt (benzin, motorin, LPG), restoran (yemek, kafe), market (gıda, süpermarket), teknoloji (elektronik, bilgisayar, yazılım), ' +
  'ofis gideri (kırtasiye, temizlik, ofis malzemesi), ulaşım (taksi, otopark, otoyol/köprü, toplu taşıma, bilet), ' +
  'araç bakım (servis, lastik, yedek parça, oto yıkama), konaklama (otel, pansiyon), iletişim (telefon, internet, GSM), ' +
  'faturalar (elektrik, su, doğalgaz), kargo (kargo, posta, kurye), giyim (kıyafet, ayakkabı, iş kıyafeti), ' +
  'sağlık (eczane, hastane, muayene, optik), eğitim (kurs, okul, kitap, seminer), kira (işyeri/ev kirası, aidat), ' +
  'sigorta (kasko, trafik, sağlık sigortası), abonelik (yazılım/üyelik/yayın aboneliği), reklam (ilan, matbaa, tanıtım), ' +
  'vergi ve harç (noter, tapu, ruhsat, resmi harçlar), banka masrafı (EFT/havale ücreti, kart aidatı), ' +
  'yapı market (hırdavat, boya, tadilat malzemesi, mobilya), kişisel bakım (kuaför, berber, kozmetik), hediye (çiçek, hediyelik), ' +
  'eğlence (sinema, konser, etkinlik, spor), diğer (hiçbirine uymayanlar)';

/**
 * Tüm sağlayıcıların ortak kullandığı system prompt. Kullanıcının kendi kategorileri de seçeneklere eklenir.
 */
export function receiptSystemPrompt(categories: readonly Kategori[] = allCategories()): string {
  const custom = categories.filter((k) => !isBuiltinCategory(k));
  return `- Sen Türkiye'deki maliye standartlarına uygun POS fişlerini okuyan bir uzman muhasebe asistanısın.
- Çıktıyı SADECE geçerli bir JSON formatında ver, markdown veya ekstra metin kullanma.
- JSON anahtarları şunlar olmalı: firmaAdi (string), tarih (DD.MM.YYYY formatında string), toplamTutar (number), kdvYuzde1 (number), kdvYuzde10 (number), kdvYuzde20 (number), kategori (string - ${categories.join(', ')} seçeneklerinden en uygununu tahmin et), fisNo (string), vkn (string).
- Kategori rehberi: ${CATEGORY_GUIDE}.${custom.length ? `\n- Kullanıcının kendi kategorileri: ${custom.join(', ')}. Fiş bunlardan birine açıkça uyuyorsa onu seç.` : ''}
- Belge bir e-Arşiv fatura ya da e-Fatura (PDF) olabilir. O zaman: firmaAdi faturayı DÜZENLEYEN satıcıdır (alıcı değil), tarih fatura tarihidir, fisNo fatura numarasıdır (ör. ABC2026000000123), vkn satıcının VKN/TCKN'sidir, toplamTutar vergiler dahil ÖDENECEK tutardır; KDV tutarlarını faturadaki "Hesaplanan KDV (%..)" satırlarından al (eski %8 oranını kdvYuzde10'a, %18'i kdvYuzde20'ye yaz).
- Eğer fişte bazı KDV dilimleri yoksa değerlerini 0 yap. TOPLAM ve TOPKDV satırlarını asla karıştırma.
- kdvYuzde1, kdvYuzde10 ve kdvYuzde20 alanlarına matrahı değil, o dilime ait KDV TUTARINI yaz.
- Sayılarda ondalık ayırıcı olarak nokta kullan (ör. 1234.56), binlik ayırıcı kullanma.
- fisNo: fişteki "FİŞ NO" değeri (yalnızca numara, baştaki sıfırlarla, ör. "0045"). Z NO, EKÜ NO, ETTN, onay/provizyon ya da işlem numarasını yazma. Fişte yoksa "".
- vkn: fişi kesen firmanın vergi kimlik numarası (VKN, 10 hane; "VKN", "V.NO", "VERGİ NO" ya da vergi dairesi adının yanında) ya da şahıs işletmesiyse TC kimlik numarası (TCKN, 11 hane). Yalnızca rakamları yaz. Alıcının/müşterinin numarasını yazma. Fişte yoksa "".
- eminOlunmayanlar (string dizisi): fişte silik, kesik, buruşuk ya da okunaksız olduğu için değerini tahmin ettiğin alanların adlarını yaz (${RECEIPT_FIELDS.join(', ')}). Net okuduğun alanları yazma; hepsinden eminsen boş dizi [] ver. Kategori fişte yazmadığı için yalnızca firmadan anlaşılamıyorsa ekle. Fişte hiç bulunmayan fisNo/vkn'yi ekleme.`;
}

export const RECEIPT_USER_PROMPT = 'Bu POS fişini ya da faturayı oku ve kurallara uygun JSON döndür.';

/** Yapılandırılmış çıktıyı destekleyen sağlayıcılar için JSON şeması. */
export function receiptJsonSchema(categories: readonly Kategori[] = allCategories()) {
  return {
    type: 'object',
    properties: {
      firmaAdi: { type: 'string' },
      tarih: { type: 'string', description: 'DD.MM.YYYY' },
      toplamTutar: { type: 'number' },
      kdvYuzde1: { type: 'number' },
      kdvYuzde10: { type: 'number' },
      kdvYuzde20: { type: 'number' },
      kategori: { type: 'string', enum: [...categories] },
      fisNo: { type: 'string', description: 'FİŞ NO; yoksa boş' },
      vkn: { type: 'string', description: 'Satıcının VKN (10) ya da TCKN (11) rakamları; yoksa boş' },
      eminOlunmayanlar: { type: 'array', items: { type: 'string', enum: [...RECEIPT_FIELDS] } },
    },
    required: ['firmaAdi', 'tarih', 'toplamTutar', 'kdvYuzde1', 'kdvYuzde10', 'kdvYuzde20', 'kategori', 'fisNo', 'vkn', 'eminOlunmayanlar'],
    additionalProperties: false,
  } as const;
}
