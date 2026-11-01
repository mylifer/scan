# SCAN PROJESİ — CLAUDE CODE DEVİR VE GELİŞTİRME YÖNERGESİ (HANDOVER)
**Tarih:** 1 Kasım 2026  
**Dönem:** v1.48.0'dan Web 1.0.21'e Geçiş & Güncel Mimari Durumu  
**Mevcut Git Dalı:** `claude/pos-receipt-scanner-app-tk3b0z`  
**Canlı Web Yayını:** https://mylifer.github.io/scan/  

---

## 1. YÖNETİCİ ÖZETİ VE MİMARİ DÖNÜŞÜM

Claude Code'un bıraktığı **v1.48.0** sürümünden itibaren projede iki paralel ve köklü dönüşüm gerçekleştirilmiştir:

1. **Mobil Uygulama (Expo SDK 58 / React Native):** Kök dizinde (`src/`) korunmuş, test kapsamı 211 teste yükseltilmiş, e-fatura PDF blob hatası çözülmüş ve mobil kararlılığı %100 muhafaza edilmiştir.
2. **Yeni Web Mimarisi (`web/` — Next.js 16 + shadcn/ui):** Mobil web kısıtlamalarını aşmak ve tam teşekküllü bir masaüstü FinTech SaaS paneli sunmak amacıyla, bağımsız bir **Next.js 16 (App Router), React 19, Tailwind CSS v4 ve resmi shadcn/ui** projesi kurulmuştur. Web 0.1.0'dan Web 1.0.21'e kadar 21+ sürüm geliştirilerek canlıya alınmıştır.

---

## 2. GERÇEKLEŞTİRİLEN BÜTÜN GELİŞTİRMELER (KRONOLOJİK DÖKÜM)

### Faz 1: Hibrit/Mobil Düzeltmeleri ve İlk Web Genişletmeleri (v1.49.0 – v1.52.1)
- **1.49.0 (`7094d8a`):** Web arayüzünün ilk shadcn/ui tasarım sistemi ile yenilenmesi.
- **1.50.0 (`243b69f`):** e-Faturalarda satır içi anında PDF önizleme penceresi (modal) ve hover anında arka planda çeken sıfır gecikmeli `pdfCache` mimarisi.
- **1.50.1 (`d10e740`):** Yeni derleme sonrası tarayıcıdaki açık sekmelerde "Loading module failed" (404 chunk) hatasını önleyen CI chunk önbellekleme ve ErrorBoundary otomatik yenileme sistemi.
- **1.51.0 (`d055851`):** e-Faturalarda tekli ve çoklu onay kutusu seçimi; toplu Excel (`.xlsx`) ve toplu PDF paketi (`ZIP` / `ZipStream`) dışa aktarımı.
- **1.51.1 (`85bb546`):** Tablo onay kutusu sütun hizalama, mükerrer kutuların temizlenmesi ve ekran altına sabit yüzen eylem çubuğu (`floating bar`).
- **1.52.0 (`f7f5fc8`):** Web panelinin tüm iç sayfalarının (Fişler, e-Faturalar, KDV Dengesi, Ayarlar, Fiş/Fatura Detayları, Kategoriler, Firmalar, Vergi Takvimi, Çöp Kutusu) masaüstü web UX standartlarına kavuşturulması.
- **1.52.1 (`4aaeba6`):** iOS mobil uygulamasında PDF açılışında yaşanan `Creating blobs from 'ArrayBuffer' are not supported` hatasının düzeltilmesi (`pdfCache` tarayıcı/mobil izolasyonu).

---

### Faz 2: Bağımsız Next.js 16 Web Dashboardu (`web/` Klasörü, Web 0.1.0 – Web 1.0.0)
- **Web 0.1.0 (`b6cd354`):** Next.js 16 (App Router, static export, `basePath: /scan`), React 19, Tailwind CSS v4 ve shadcn/ui iskeletinin kurulması.
- **Web 0.2.0 (`100998a`):** Fişler ekranı, filtreler, fiş düzenleme formu, toplu Excel ve fotoğraflı muhasebe paketi (ZIP) indirme motoru.
- **Web 0.3.0 (`31730c8`):** e-Faturalar ekranı, iframe tabanlı PDF önizleme dialogu, UBL fatura detayları modalı, dönem matrah/KDV analiz dialogu.
- **Web 0.4.0 (`b981f30`):** KDV takibi, Türkiye mali mevzuatına uygun Vergi Takvimi (resmi tatil ve hafta sonu ertelemeleriyle), Bütçe takip ekranı, Firma listesi ve benzer firma adı birleştirme önerileri (`FirmMergeDialog`), 25 hazır + özel Kategori yönetimi.
- **Web 0.5.0 (`b74b5f6`):** Ayarlar merkezi, 30 günlük otomatik geri dönüşümlü Çöp Kutusu (`TrashTab`), tam ZIP yedekleme ve akıllı mükerrer korumalı geri yükleme (`BackupTab`), sistem hata günlüğü ve Gemini Edge Function üzerinden masaüstü fiş tarama (`ReceiptForm` & `vision.ts`).
- **Web 1.0.0 (`f702dc1`):** `.github/workflows/deploy-web.yml` iş akışının Next.js statik çıktısına (`web/out -> dist/`) geçirilerek GitHub Pages'e canlı yayına alınması (eski sürümlere dönüş için Expo fallback mimarisi korundu).

---

### Faz 3: Apple Native Glass Tasarımı, Tipografi ve Finansal Motor Geliştirmeleri (Web 1.0.1 – Web 1.0.21)
- **Web 1.0.1 (`934f076`):** Sidebar responsive davranışı, turkuaz dikey aktif haplar (`before:bg-primary`), mobil yan çekmece (`Sheet`) ve mobil alt gezinti çubuğu (`MobileNav`).
- **Web 1.0.2 (`e47bbec`):** Modal genişlik sınırlamalarının (`sm:max-w-sm`) kaldırılarak `max-w-7xl` seviyesine çıkarılması, UBL 7 sütunlu fatura kalem tablosundaki yatay kaydırma ve taşma sorunlarının giderilmesi.
- **Web 1.0.3 (`07bd0c5`):** Kenar çubuğunun modern SaaS ve FinTrack mimarisine göre baştan tasarlanması, "+ Yeni Fiş Tara" birincil CTA butonu, daraltılmış simge modu (`collapsed`), kenar çubuğuna entegre canlı aylık harcama kartı (`SidebarMonthlyCard`).
- **Web 1.0.4 (`f662a30`):** Radix UI ve Tailwind v4 uyumsuzluğu yaratan sahte state seçicilerinin resmi shadcn `data-[state=active/checked/open]` standardına dönüştürülmesi, koyu mod kart kenarlıkları ve overlay kontrast optimizasyonları.
- **Web 1.0.5 (`8602e2d`):** QNB eSolutions servisinin yeni kesilen giden faturalarda KDV'yi gecikmeli bildirmesi sorununu çözen **UBL XML Fallback** motoru. Eksik KDV'li faturaların XML'i arka planda çözümlenerek KDV tutarı ve matrahı anında listeye ve dönem toplamına yansıtılır. **Ayrı bir `ublFallback.ts` dosyası yoktur:** mantık `supabase/functions/qnb-efatura/index.ts` içindeki `tutarlariTamamla` fonksiyonunda (sunucu) ve `efatura-view.tsx` içindeki `handleDetayLoaded` geri çağrısındadır (detay açılınca istemcide tamamlama).
- **Web 1.0.6 (`6d76edb`):** e-Faturalar tablosunda sütun başlıklarına tıklanarak çift yönlü sıralama (Tarih, Firma Türkçe alfabe sıralaması `Intl.Collator("tr-TR")`, Tür, KDV ve Toplam Tutar).
- **Web 1.0.7 (`e681030`):** Daraltılmış kenar çubuğunda logo ve menü butonlarının 48px sınırında taşmasını önleyen `size-9` ve Tooltip mimarisi.
- **Web 1.0.8 – 1.0.9 (`2067979`, `6973d5e`):** Sistem genelinde Geist font ailesine geçilmesi, modal tutar özetlerindeki `font-mono` sınıflarının temizlenerek standart Geist Sans `tabular-nums` tipografisine kavuşturulması.
- **Web 1.0.10 (`2300c7b`):** e-Fatura detay modalının 7 sütunlu kalem tablosuna kusursuz sığdırılması, tablodaki satır içi fatura görüntüleme butonunun turkuaz birincil aksiyona (`[ 📄 Görüntüle ]`) dönüştürülmesi.
- **Web 1.0.11 (`629f858`):** UI geneline akıcı sayfa geçiş animasyonları (`template.tsx`), taktil dokunsal basılma geri bildirimi (`active:scale-[0.98]`), modal/çekmece 200ms `ease-out` yumuşak eğrileri.
- **Web 1.0.12 (`c7d56e0`):** Vergi Takvimi tablosunda vadesi geçmiş kayıtların varsayılan olarak gizlenmesi, "Geçmiş satırları göster" onay kutusu ve dinamik geçmiş sayacı rozeti.
- **Web 1.0.13 (`687d3b2`):** Fişler sayfasında hantal 16 seçenekli açılır menünün kaldırılarak Apple Native `[Tüm Zamanlar | Aylık | Yıllık]` segmented switch ve ay stepper'ına (`‹ [Ay] ›`) geçilmesi; muhasebeye gönderilen fişlerin düşülen KDV izolasyonu ve **devreden KDV hesaplama motoru**.
- **Web 1.0.14 (`caf3fdc`):** Fişler sayfasında **Apple Native Glass (macOS Tahoe & Apple Wallet)** tasarımına geçilmesi: Frosted glass kartlar (`backdrop-blur-xl bg-card/75 border-border/80`), squircle monogram ikonları, 4 hiyerarşik finansal kart ve Apple Wallet tarzı boş durum ekranı.
- **Web 1.0.15 (`a261b27`):** Sistem genelinde Geist harici tüm fontların ve `font-mono` kalıntılarının temizlenmesi, Türkçe karakter (`latin-ext`) desteğinin garantiye alınması.
- **Web 1.0.16 – 1.0.18 (`fe080cb`, `11ad07b`):** Emojiler yerine **Seçenek 02: Minimalist Monogram & Status Dot** (Linear & Swiss B2B Enterprise) stiline geçilmesi: 25 kategori için neon dairesel durum noktası (`dotColor`), 2 harfli büyük monogram (`AK`, `RE`, `MA`, `TE` vb.) ve yarı saydam Geist rozetleri.
- **Web 1.0.17 – 1.0.19 (`4059c80`, `08629ae`):** Koyu modda tablolardaki parlak beyaz ızgara hissinin tamamen yok edilmesi; satır çizgisi opaklığının `%14` -> `%5` -> **ultra-soft %2 (`rgba(255, 255, 255, 0.02) !important`)** seviyesine indirilmesi.
- **Web 1.0.20 (`f1bdd62`):** e-Faturalar sayfasındaki üst metrik kartlarının da Apple Native Glass tasarımına geçirilmesi (4 kart: Toplam Belge, Toplam Tutar, Net KDV, Dönem Analizi).
- **Web 1.0.21 (`b009dbb`):** e-Faturalar sayfasına Apple Segmented Switch ile **"Tümünü Göster (O Tarihe Kadar)"** dönemi eklenmesi. QNB portalındaki ilk faturadan seçilen aya kadar 3'erli paralel sorguyla tüm faturaları çeken ve tekilleştiren `fetchAllFaturalar` motoru.
- **Web 1.0.22 (EN GÜNCEL SÜRÜM):** İnceleme düzeltmeleri.
  - *"Tümünü Göster" artık eksik veriyi sessizce göstermiyor:* Yüklenemeyen aylar ve QNB'den gelen uyarılar kalıcı bir uyarı şeridinde gösterilir. Hiçbir ay yüklenemezse hata verilir. Eksik sonuç önbelleğe alınmaz. Kapsam sınırı (36 ay, ilk ay bilinmiyorsa 12 ay) bilgi notu olarak yazılır.
  - *Yeni sürüm koruması:* Önceki yayınların `_next/static` parçaları 30 gün saklanır. Açık sekmeler `version.json` dosyasını okuyup "Yenile" bildirimi gösterir. Eski parça hatasında sayfa bir kez otomatik yenilenir (`VersionGuard`, `(app)/error.tsx`).

---

## 3. PROJE YAPISI VE ÇALIŞMA DİZİNLERİ

```
scan/
├── src/                         # Expo / React Native Mobil Uygulama Kaynak Kodları (SDK 58)
│   ├── app/                     # Expo Router dosya tabanlı rotaları
│   ├── components/              # Mobil bileşenler
│   ├── lib/                     # Ortak saf TypeScript yardımcıları ve algoritmaları
│   └── __tests__/               # Kök testleri (Node native test runner, 211 test)
├── web/                         # YENİ Next.js 16 Masaüstü Web Uygulaması
│   ├── src/
│   │   ├── app/                 # Next.js 16 App Router
│   │   │   ├── (app)/           # Korumalı SaaS paneli rotaları
│   │   │   │   ├── fisler/      # Fişler & Giderler (Apple Native Glass)
│   │   │   │   ├── efaturalar/  # e-Faturalar & UBL Görüntüleyici & Tümünü Göster
│   │   │   │   ├── kdv/         # KDV Dengesi ve Raporlama
│   │   │   │   ├── butce/       # Harcama & Kategori Bütçeleri
│   │   │   │   ├── firmalar/    # Firma Listesi & Birleştirme
│   │   │   │   ├── kategoriler/ # Monogram Kategori Yönetimi
│   │   │   │   ├── vergi-takvimi/# Akıllı Vergi Yükümlülükleri
│   │   │   │   ├── ayarlar/     # Ayarlar, Çöp Kutusu, Yedekleme, Hata Günlüğü
│   │   │   │   ├── layout.tsx   # Dashboard Layout (Sidebar + Header)
│   │   │   │   └── template.tsx # Sayfa geçiş animasyonu (slide & fade)
│   │   │   ├── globals.css      # Tailwind v4 tema değişkenleri ve ultra-soft satır çizgileri
│   │   │   └── layout.tsx       # Root layout, Geist font tanımları (latin-ext)
│   │   ├── components/          # shadcn/ui & sayfa bileşenleri
│   │   └── lib/                 # Web veri katmanı ve algoritmaları (10 dosya, 34 Vitest testi)
├── .github/workflows/
│   ├── deploy-web.yml           # Web uygulamasını GitHub Pages'e derleyip yayınlayan iş akışı
│   └── ios.yml                  # iOS TestFlight ve App Store derleme iş akışı
└── CHANGELOG.md                 # Tüm sürümlerin ve commit kodlarının eksiksiz günlüğü
```

---

## 4. KRİTİK GELİŞTİRME YÖNERGELERİ & KURALLAR

Claude Code olarak projede çalışırken aşağıdaki kurallara **mutlaka** uyunuz:

### A. Tipografi ve Stil Kuralları
1. **Yalnızca Geist Fontu:** Sistemde `font-mono`, `Inter` veya sistem fontu kullanılmaz. Parasal değerler, tarihler ve kodlarda `font-mono` yerine `Geist Sans` ile birlikte `tabular-nums` sınıfı kullanılır (`latin-ext` destekli).
2. **Kategori Rozetleri:** Emojiler kesinlikle kullanılmaz. `CategoryBadge` bileşeni kullanılır (`dotColor` parıltılı neon nokta + 2 harfli büyük harf monogram).
3. **Koyu Mod Tablo Çizgileri:** Tablolarda yüksek kontrastlı border kullanılmaz. `.dark table tbody tr` satırları `rgba(255, 255, 255, 0.02)` ultra-soft sınır seviyesindedir.
4. **Cam Efekti (Apple Native Glass):** Özet metrik kartları ve paneller `rounded-2xl border border-border/80 dark:border-white/[0.05] bg-card/75 backdrop-blur-xl p-4.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)]` standardındadır.

### B. e-Fatura ve Finansal Hesaplamalar
1. **UBL KDV Fallback:** Yeni kesilen giden faturalarda QNB servisinden KDV boş gelebilir. Mantık `supabase/functions/qnb-efatura/index.ts` → `tutarlariTamamla` içindedir (ayrı `ublFallback.ts` dosyası **yoktur**). Bilinen sınırlar: yalnızca KDV *boş* (`typeof kdv !== 'number'`) ise tamamlanır, `0` gelen KDV tamamlanmaz; istek başına en fazla 25 fatura UBL'den (5'erli paralel) tamamlanır. Fonksiyon değişikliği `supabase-functions.yml` ile yayınlanır. Bozulmamalıdır.
2. **Tümünü Göster Modu:** e-Faturalarda "Tümünü Göster" açıkken tarihe göre kümülatif sorgu (`fetchAllFaturalar`, `web/src/lib/efatura.ts`) çalışır. QNB API kotasını korumak için sorgular `limit: 3` eşzamanlı parçalarla gönderilir. Saf yardımcılar test edilir: `tumuAyAraligi` (ay aralığı, `TUMU_MAX_AY = 36`, `TUMU_VARSAYILAN_AY = 12`) ve `aySonuclariniBirlestir` (tekilleştirme, uyarıları koruma, eksik ay bildirimi). Kurallar: eksik sonuç (yüklenemeyen ay veya alınamayan ilk ay) **önbelleğe alınmaz**, hiçbir ay yüklenemezse hata fırlatılır, uyarılar kullanıcıya gösterilir.
3. **Devreden KDV Mantığı:** Muhasebeciye teslim edilmiş fişler geçmiş aylar hesabında kalır; teslim edilmemiş fişler ise bulunulan aya devreden KDV olarak yansıtılır.

### C. Yeni Sürüm Koruması (Chunk 404)
GitHub Pages özel header göndermediği için Next.js'in `deploymentId` sürüm uyumsuzluğu koruması çalışmaz. Yerine şunlar kullanılır, kaldırılmamalıdır:
1. `deploy-web.yml` önceki yayınların `_next/static` parçalarını `actions/cache` ile saklar (30 günden eskiler budanır) ve yeni pakete ekler.
2. `deploy-web.yml` `NEXT_PUBLIC_APP_VERSION` (commit) değerini derlemeye verir ve `dist/version.json` yazar. `web/src/components/version-guard.tsx` bu dosyayı odak/görünürlük değişiminde ve 5 dakikada bir okur; sürüm değiştiyse kalıcı "Yenile" bildirimi gösterir.
3. Parça yükleme hatasında (`isChunkLoadError`, `web/src/lib/appVersion.ts`) sayfa 30 sn korumalı olarak bir kez yenilenir. Panel hata sınırı: `web/src/app/(app)/error.tsx` (Next 16'da prop adı `reset` değil `retry`).

### D. Derleme, Test ve Kalite Kapıları
Herhangi bir görevi tamamlamadan önce kök ve web dizinlerinde kalite kapılarını çalıştırınız:

```bash
# 1. Kök testleri (Mobil & ortak kodlar - 211 test):
npm test -- --run
npx expo lint
npx tsc --noEmit

# 2. Web uygulaması kontrolleri (34 test):
cd web
npm run typecheck
npm run lint
npm test
npm run build
cd ..
```

### E. Yayınlama ve Sürüm Takibi
1. Yapılan her geliştirmeyi `CHANGELOG.md` dosyasına yeni bir `## Web X.X.X — <commit>` başlığıyla ekleyiniz.
2. `claude/pos-receipt-scanner-app-tk3b0z` dalına push yapıldığında GitHub Actions (`deploy-web.yml`) otomatik olarak Next.js web uygulamasını derleyip GitHub Pages'e yayınlar. Başka bir dalda (ör. Claude Code oturum dalı) yapılan değişiklikler, bu dala birleştirilene kadar yayına çıkmaz.
3. API anahtarlarının istemci tarafı kodlara gömülmediğinden emin olunuz (CI kontrolü `AIza` anahtarlarını denetler).
