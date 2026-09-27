# 🧾 Fiş Tarayıcı

Türkiye'deki POS fişlerini kamerayla okuyup gider ve KDV takibi yapan Expo (React Native) uygulaması.

- **Kamera:** Tam ekran, dokunarak netleme, flaş, fiş hizalama çerçevesi
- **Yapay zekâ ile okuma:** Varsayılan Gemini (`gemini-flash-latest`). Claude'a geçmek için `.env` dosyasında tek satırı değiştirmeniz yeterli
- **Düzenlenebilir form:** Okunan değerleri kontrol edip düzeltme, kaydetmeden önce doğrulama (TOPLAM/TOPKDV karışıklığı kontrolü)
- **Supabase:** E-posta ile giriş, `receipts` tablosu (RLS açık), sıkıştırılmış fiş görselleri (~50–120 KB)
- **Dashboard:** Bu ayki toplam gider, KDV alacağı (%1 / %10 / %20), kategori dağılımı, son fişler

## iPhone'da kullanım (web sürümü)

Uygulama her güncellemede otomatik olarak **https://mylifer.github.io/scan/** adresinde yayınlanır.
iPhone'da Safari ile açıp Paylaş → **Ana Ekrana Ekle** diyerek uygulama gibi kullanabilirsiniz.
Yayın için GitHub repo ayarlarında şunlar gerekir:

- **Settings → Secrets and variables → Actions** altında `SUPABASE_PUBLISHABLE_KEY` ve `GEMINI_API_KEY` secret'ları
- **Settings → Pages → Source: GitHub Actions**

## Kurulum (geliştirici)

### 1. Supabase

1. Supabase Dashboard'da **SQL Editor**'ü açın, `supabase/migrations/001_receipts.sql` dosyasının içeriğini yapıştırıp çalıştırın.
   Bu işlem tabloyu, RLS kurallarını ve özel `receipt-images` bucket'ını oluşturur.
2. **Authentication > Providers > Email** ayarının açık olduğundan emin olun.
   Kayıt olurken doğrulama e-postası beklemek istemiyorsanız "Confirm email" seçeneğini kapatabilirsiniz.
3. **Project Settings > API** sayfasından Project URL ve Publishable key (ya da eski adıyla `anon` key) değerlerini alın.

### 2. Ortam değişkenleri

```bash
cp .env.example .env
```

`.env` dosyasını doldurun: Supabase URL ve anahtarı, [Google AI Studio](https://aistudio.google.com/apikey)'dan alacağınız Gemini API anahtarı.

### 3. Çalıştırma

```bash
npm install
npx expo start
```

Telefonda **Expo Go** ile QR kodu okutun. Native modül eklerseniz development build gerekir:
`npx expo run:android` / `npx expo run:ios`.

## Mimari: VisionService

```
src/services/vision/
├── VisionService.ts        ← arayüz: analyzeReceipt(image) → ReceiptData
├── receiptPrompt.ts        ← ortak system prompt + JSON şeması
├── parseReceiptJson.ts     ← ortak doğrulama/normalize (sayı, tarih, kategori)
├── GeminiVisionAdapter.ts  ← @google/genai
├── ClaudeVisionAdapter.ts  ← Anthropic Messages API (hazır, çalışır durumda)
└── index.ts                ← getVisionService(): env'e göre adapter seçer
```

Ekranlar yalnızca `getVisionService()` fonksiyonunu kullanır. **Claude'a geçmek için:**

```env
EXPO_PUBLIC_VISION_PROVIDER=claude
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

Yeni bir sağlayıcı eklemek için `VisionService` arayüzünü uygulayan bir sınıf yazıp `index.ts` dosyasındaki `switch` bloğuna ekleyin.

## ⚠️ Güvenlik notu

`EXPO_PUBLIC_*` değişkenleri uygulama paketine gömülür. Uygulamayı açan biri API anahtarını çıkarabilir.
Kişisel kullanım için kabul edilebilir, ama uygulamayı başkalarıyla paylaşacaksanız AI çağrısını bir
**Supabase Edge Function** üzerinden yapın. Bu durumda yeni bir `EdgeFunctionVisionAdapter` yazmanız yeterli,
uygulamanın geri kalanı değişmez. Google AI Studio'da anahtarınıza kota ve uygulama kısıtlaması tanımlamanız da önerilir.

## Depolama (Supabase Free Plan)

| Kopya | Çözünürlük | Kalite | Boyut |
|---|---|---|---|
| AI'a gönderilen | 1600px genişlik | %75 | Saklanmaz |
| Arşiv (Storage) | 900px genişlik | %45 | ~50–120 KB |

1 GB'lık free plan kotasına yaklaşık 10.000 fiş sığar. Bucket, dosya başına 500 KB sınırıyla ve yalnızca JPEG kabul edecek şekilde yapılandırılmıştır.
