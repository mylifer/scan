# 🧾 Fiş Tarayıcı

Türkiye'deki POS fişlerini kamerayla okuyup gider ve KDV takibi yapan Expo (React Native) uygulaması.

- **Kamera:** Tam ekran, dokunarak netleme, flaş, fiş hizalama çerçevesi
- **Yapay zekâ ile okuma:** Varsayılan Gemini (`gemini-2.5-flash`, yoğunlukta yedek modellere geçer). Claude'a geçmek için `.env` dosyasında tek satırı değiştirmeniz yeterli
- **Düzenlenebilir form:** Okunan değerleri kontrol edip düzeltme, kaydetmeden önce doğrulama (TOPLAM/TOPKDV karışıklığı kontrolü)
- **Supabase:** E-posta ile giriş, `receipts` tablosu (RLS açık), sıkıştırılmış fiş görselleri (~50–120 KB)
- **Toplu tarama:** Arka arkaya çekim / galeriden çoklu seçim → taslaklar Supabase'de saklanır → topluca veya planlanan saatte taranır → tek tek kontrol edilip kaydedilir (`supabase/migrations/002_receipt_drafts.sql` gerekir)
- **Ana sayfa:** Aylık / Yıllık / Tüm Zamanlar; toplam gider, KDV alacağı (%1 / %10 / %20), geçen ayla karşılaştırma, aylık bütçe çubuğu, son 12 ay grafiği, kategori dağılımı, arama, kategori filtresi, sıralama, aylara göre gruplama, kaydırarak silme; internetsizken son veriler gösterilir
- **13 kategori** ve **kategori hafızası:** bir firmayı hangi kategoriyle kaydettiyseniz sonraki fişleri de öyle gelir (`supabase/migrations/004_giyim_category.sql`)
- **Fiş ekleme:** Kamera, galeri, toplu çekim ya da **elle** (fotoğrafsız; sonradan fotoğraf eklenebilir)
- **Fiş detayı:** Düzenleme, tam ekran yakınlaştırılabilir fotoğraf, paylaşma, mükerrer fiş ve şüpheli KDV uyarıları
- **Dışa aktarma:** Excel (.xlsx; çok aylı dönemlerde "Aylar" sayfası) ve Muhasebe Paketi (Excel + tüm fotoğraflar, ZIP; akış olarak üretilir)
- **Ayarlar:** Hesap, aylık bütçe, KDV hatırlatıcısı (iPhone, her ayın 25'i), depolama kullanımı, yapay zekâ modeli, sürüm bilgisi

## iPhone'da kullanım (web sürümü)

Uygulama her güncellemede otomatik olarak **https://mylifer.github.io/scan/** adresinde yayınlanır.
iPhone'da Safari ile açıp Paylaş → **Ana Ekrana Ekle** diyerek uygulama gibi kullanabilirsiniz.
Yayın için GitHub repo ayarlarında şunlar gerekir:

- **Settings → Secrets and variables → Actions** altında `GEMINI_API_KEY` secret'ı
- **Settings → Pages → Source: GitHub Actions**

## iPhone uygulaması (Expo Go, ücretsiz)

Uygulama App Store'daki ücretsiz **Expo Go** içinde çalışır. Her güncellemede `.github/workflows/ios.yml`
EAS Update ile yeni sürümü yayınlar; telefonda uygulamayı kapatıp açmak yeterlidir.
Açma bağlantısı: `exp://u.expo.dev/e4446685-6bd2-4e1c-b0d0-cb1c025e1905?channel-name=production`
Gerekli secret'lar: `EXPO_TOKEN`, `GEMINI_API_KEY`.

## Sürümler ve geri dönüş

Her sürüm ve commit kodu [CHANGELOG.md](CHANGELOG.md) içindedir. Eski bir sürüme dönmek için Actions'ta
iş akışını **ref** kutusuna commit kodunu yazarak çalıştırın (ayrıntılar CHANGELOG'da).

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

### 4. Testler

```bash
npm test                                   # birim testleri (CI'da her yayında çalışır)
NODE_PATH=$(npm root -g) npm run test:e2e  # tarayıcı testleri: web'i dist-e2e/'ye derler, ana akışları dener
```

Uçtan uca testler (`e2e/`) sahte bir Supabase (`https://e2e.supabase.co`) ve sahte Gemini kullanır; gerçek
veritabanına dokunmaz. Fiş tarihleri bugüne göre üretildiği için takvimden bağımsızdır. Playwright ve Chromium
gerekir (`CHROMIUM_PATH` ile tarayıcı yolu verilebilir).

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

Veritabanı ve fotoğraflar satır düzeyinde güvenlikle (RLS) korunur: her kullanıcı yalnızca kendi fişlerini görür.
Açık kalan iki nokta ve yapılması önerilenler:

1. **Yeni hesap açılışını kapatın.** Uygulamayı yalnızca siz kullanıyorsanız: Supabase → Authentication →
   Sign In / Providers → **Allow new users to sign up** kapalı. Böylece başkaları hesap açıp depolamanızı kullanamaz.
2. **Gemini anahtarı uygulama paketindedir** (`EXPO_PUBLIC_*` değişkenleri pakete gömülür). Web sürümünü açan
   biri anahtarı çıkarıp ücretsiz kotanızı tüketebilir; ücretsiz planda para kaybı olmaz. Faturalandırmayı
   açarsanız AI çağrısını bir **Supabase Edge Function** üzerinden yapın (yeni bir `VisionService` adaptörü
   yeterli) ve Google AI Studio'da harcama sınırı koyun.

## Depolama (Supabase Free Plan)

| Kopya | Çözünürlük | Kalite | Boyut |
|---|---|---|---|
| AI'a gönderilen | 1600px genişlik | %75 | Saklanmaz |
| Arşiv (Storage) | 900px genişlik | %45 | ~50–120 KB |

1 GB'lık free plan kotasına yaklaşık 10.000 fiş sığar. Bucket, dosya başına 1 MB sınırıyla (taslaklar AI için daha yüksek çözünürlükte tutulur, kaydedilince silinir) ve yalnızca JPEG kabul edecek şekilde yapılandırılmıştır.
