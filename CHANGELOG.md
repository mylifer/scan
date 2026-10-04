# Sürüm Geçmişi

Her sürümün yanındaki **commit kodu**, o sürüme geri dönmek için kullanılır.

## Geri dönüş nasıl yapılır?

1. GitHub'da **Actions** sekmesini açın: https://github.com/mylifer/scan/actions
2. Soldan **"Web sürümünü yayınla"** iş akışını seçin → sağdaki **"Run workflow"** düğmesi.
3. **ref** kutusuna aşağıdaki tablodan dönmek istediğiniz sürümün commit kodunu yazın → **Run workflow**.
4. iPhone (Expo Go) için aynısını **"iPhone uygulaması"** iş akışında, `action: update` seçerek yapın.
5. Tekrar en son sürüme dönmek için aynı adımları **ref boş** bırakarak yapın.

> Not: Geri dönüş yalnızca yayını eski koda çevirir; veritabanındaki fişlerinize dokunmaz.

**Sağlam yedek:** 1.24.0'ın tam hâli GitHub'da ayrı bir dalda saklanıyor: `backup/stable-1.24.0` (commit `070c18b`). Geri dönmek için **ref** kutusuna `070c18b` yazmanız yeterli.

---

## 1.29.1 — `(yayında)`
- Çok büyük bir yedeği geri yüklerken iPhone'un belleği dolup uygulamanın kapanabilmesi düzeltildi (fotoğraflar artık 20'şerli gruplar hâlinde açılıyor)
- Geri yüklemede bir fotoğraf yüklenemezse o fiş eklenmiyor; yedeği yeniden yükleyince fotoğrafıyla birlikte ekleniyor (önceden fotoğrafsız eklenip bir daha düzeltilemiyordu)
- Vergi hatırlatıcısını hızlıca açıp kapatınca bildirimlerin yine de gelmesi düzeltildi
- Ekran okuyucu (VoiceOver) anahtarların adını okuyor

## 1.29.0 — `9a01092`
- **Vergi Takvimi** (Ayarlar → Takip): önümüzdeki 12 ayın KDV, geçici vergi ve yıllık gelir vergisi son günleri; istenirse muhtasar ve Ba-Bs. Son gün hafta sonuna ya da bayrama denk gelirse ilk iş gününe kaydırılır (ör. Nisan 2026 KDV → 1 Haziran). Arife ve 28 Ekim gibi yarım günler turuncu notla işaretlenir. 2026–2027 bayram tarihleri iki ayrı kaynakla doğrulandı
- **Vergi Hatırlatıcısı:** eski "her ayın 25'i" hatırlatıcısının yerine; her son günden 3 gün önce 10:00'da ve son gün 09:00'da bildirim. Açık olan eski hatırlatıcı kendiliğinden yenisine geçer
- **Öne Çıkanlar** (ana sayfa, aylık görünüm): geçen aya göre en çok artan/azalan kategori, en çok harcanan firma, en büyük fiş, KDV oranı ve bu ayın gidişatı. Yapay zekâ kullanmaz, kota harcamaz
- **Tam Yedek** (Ayarlar → Yedek): tüm fişler ve fotoğraflar tek dosyada; iPhone'da Dosyalar → iCloud Drive'a kaydedilebilir. **Yedekten Geri Yükle** hesapta zaten olan fişleri atlar, hiçbir şeyi silmez; aynı yedek iki kez yüklense de kopya oluşmaz
- Düzeltme: Ayarlar'daki anahtarlar (ör. hatırlatıcı) web'de ekran okuyuculara devre dışı görünüyordu

## 1.28.0 — `3f007e8`
- **Toplu çekimde fotoğraf kaybolmuyor (iPhone):** Fotoğraf çekilir çekilmez telefonda kalıcı olarak saklanıyor; uygulama yükleme bitmeden kapanırsa bir sonraki açılışta "Önceki çekimden kalan N fotoğraf yükleniyor" deyip kaldığı yerden yüklüyor
- **Şifremi unuttum:** Giriş ekranında e-posta yazıp "Şifremi Unuttum"a dokunun; gelen bağlantı tarayıcıda açılır, yeni şifre belirlenir, sonra uygulamada yeni şifreyle giriş yapılır. Tek seferlik ayar gerekir: Supabase → Authentication → URL Configuration → Redirect URLs'e `https://mylifer.github.io/scan/` ekleyin

## 1.27.1 — `6d1a0ed`
- Bildirim paketi artık uygulama açılırken değil, yalnızca gerektiğinde ve korumalı yükleniyor (yüklenemezse hatırlatıcı satırı gizlenir, uygulama yine açılır)
- Not: Telefonun 1.21.1'de kalmasının asıl nedeni, Expo Go'daki "Son açılanlar" kaydının eski bir sürüme sabitlenmiş olmasıydı. Uygulamayı her zaman şu bağlantıyla açın: `exp://u.expo.dev/e4446685-6bd2-4e1c-b0d0-cb1c025e1905?channel-name=production`

## 1.27.0 — `e96e222`
- **Kaydetmeden çıkma uyarısı:** Fiş detayında değişiklik yapıp geri dönerseniz, elle eklemede formu doldurup Vazgeç'e basarsanız ya da okunmuş fişi kaydetmeden geri dönerseniz "Kaydetmeden Çık" onayı sorulur (önceden bilgiler sessizce kayboluyordu)
- **Gemini anahtarını sunucuda tutma seçeneği hazır:** `supabase/functions/analyze-receipt` + "Supabase fonksiyonunu yayınla" iş akışı. Varsayılan davranış değişmedi; etkinleştirme adımları README'de
- **Kalıcı tarayıcı testleri:** `e2e/` klasöründe 7 ana akış (`npm run test:e2e`), sahte Supabase ile; gerçek veritabanına dokunmaz

## 1.26.0 — `3e0699e`
İkinci kod incelemesi ve düzeltmeler:
- Gemini yedek modellerinden biri kullanımdan kalkmışsa (404) kalan yedekler denenmiyordu; artık zincir devam ediyor
- Kamera izni bir kez reddedilince "İzin Ver" çalışmıyordu; artık "Ayarları Aç" çıkıyor (iPhone)
- KDV hatırlatıcısı uygulama açıkken gösterilmeyebiliyordu (iPhone)
- Muhasebe Paketi: telefon hafızası dolarsa çökme yerine hata mesajı; hata sonrası yarım dosya kalmıyor
- Web'de onay menüsünün mesajına dokunmak işlemi sessizce iptal ediyordu
- Arka arkaya gelen bildirimlerden ikincisi kaybolabiliyordu
- Kategori hafızası daha az veri indiriyor ve kullanıcıya bağlı
- Tek fiş taramasında fotoğraf bir kez açılıyor (daha az bellek)
- Giriş ekranında çift istek, web'de aynı fotoğrafı tekrar seçememe düzeltildi
- VoiceOver (ekran okuyucu) desteği iyileştirildi
- Altyapı: kullanılmayan iki paket kaldırıldı; web yayını yarıda iptal edilmiyor

## 1.25.0 — `f732eae`
Kod incelemesi ve hata düzeltmeleri (davranışı görünür biçimde değiştirmez, yalnızca hataları giderir):
- "15.000" gibi Türkçe binlik yazımı 15 olarak okunuyordu (bütçe ve tutar alanları)
- Aylar arasında hızlı geçişte başlık bir ayı, liste başka bir ayı gösterebiliyordu; Excel yanlış ayın fişleriyle oluşabiliyordu
- Kaydet'e hızlı çift dokunuşta (iPhone) aynı fiş iki kez kaydedilebilirdi
- Toplu incelemede taslak silinemeyince kaydedilen fiş için "Kaydedilemedi" deniyordu (tekrar kaydedip çift kayıt riski); hızlı geçişte yanlış fotoğraf gösterilebiliyordu
- Toplu taramada tek bir bağlantı hatası kuyruğu sessizce durduruyordu; okunan sonuç kaybolabiliyordu
- Çevrimdışı önbellek kullanıcıya bağlandı (aynı cihazda başka hesap öncekinin verisini görmez) ve boyut sınırı getirildi
- Planlama, plan iptali, taslak silme hataları artık gösteriliyor
- Taslak önizlemeleri 1 saat sonra açılmıyordu
- Muhasebe Paketi (ZIP) artık akış olarak üretiliyor: yıllık binlerce fotoğraflı paket belleği doldurup uygulamayı çökertmez
- Ana sayfada arama/sıralama daha hızlı; kuruş yuvarlama (1,005 → 1,01) ve Excel'de geçersiz karakter düzeltmeleri; geçici dosya/bellek temizliği
- Altyapı: eksik expo-font bağımlılığı eklendi; iPhone yayınına lint denetimi; CI'da gizli anahtarlar güvenli aktarılıyor

## 1.24.0 — `6e88335`
- Fiş no, vergi no, ödeme şekli ve not alanları (1.22.0) isteğiniz üzerine kaldırıldı; form, Excel ve mükerrer kontrolü 1.21.1'deki hâline döndü. KDV hatırlatıcısı ve diğer özellikler duruyor
- 1.22.0'daki veritabanı güncellemesini yaptıysanız bir şey yapmanıza gerek yok; eklenen boş sütunlar zararsızdır

## 1.23.0 — `e23b6ac`
- **KDV hatırlatıcısı (iPhone):** Ayarlar → Takip → KDV Hatırlatıcısı açılınca her ayın 25'i saat 10:00'da "geçen ayın fişlerini muhasebecinize gönderin" bildirimi gelir (beyanname son günü ayın 28'i). İlk açılışta bildirim izni istenir. Web sürümünde bu ayar görünmez

## 1.22.0 — `f463693`
- **Fiş ayrıntıları:** Satıcının vergi numarası (VKN/TCKN), fiş numarası ve ödeme şekli (Kart/Nakit) artık yapay zekâ tarafından fişten okunur ve kaydedilir; isteğe bağlı not alanı eklendi. Hepsi Excel'e yeni sütunlar olarak (muhasebe kaydı için), paylaşılan fiş metnine ve aramaya dahil
- **Daha iyi mükerrer kontrolü:** Aynı satıcı vergi no + aynı fiş no, tutar yanlış okunmuş olsa bile aynı fiş olarak uyarılır
- Tek seferlik veritabanı güncellemesi gerekir: ana sayfadaki "Veritabanını güncelle" satırı (`supabase/migrations/005_receipt_details.sql`; önceki kategori kurulumlarını da içerir). Güncelleme yapılana kadar yeni alanlar gizli kalır, uygulama eskisi gibi çalışır

## 1.21.1 — `d25cb05`
- Toplu taramada indirilen geçici fotoğraflar işlendikten sonra temizlenir (bellek ve telefon alanı)
- Ekran okuyucu (VoiceOver) için taslak kutucuklarına, kamera ve grafik düğmelerine açıklamalar eklendi

## 1.21.0 — `ea9dc4d`
- **Aylara göre gruplama:** Yıllık ve Tüm Zamanlar görünümünde (tarihe göre sıralıyken) fişler ay başlıkları altında listelenir: "Eylül 2026 · 12 fiş · ₺8.450"

## 1.20.0 — `dfbb458`
- **Aylık bütçe:** Ayarlar → Takip → Aylık Bütçe. Ana sayfanın özet kartında (aylık görünüm) çubuk ve "₺X kaldı" / "₺X aşıldı" görünür; %80'den sonra turuncu, aşılınca kırmızı. Çubuğa dokunarak bütçe değiştirilebilir. Bu cihazda saklanır, kurulum gerektirmez

## 1.19.1 — `ebbee16`
- İç düzenleme: ana sayfa kodu küçük parçalara ayrıldı (özet kartı, dönem seçici, dışa aktarma, kategoriler, fiş satırı). Görünüm ve davranış aynı

## 1.19.0 — `e04361f`
- **Kota dolunca planla:** Toplu tarama Gemini kotası/yoğunluğu yüzünden durursa Toplu Tarama ekranında nedeni ve "Kalan N Fişi Planla" düğmesi çıkar; önerilen saat günlük hakkın yenilendiği saattir

## 1.18.0 — `6f2e789`
- **Sıralama:** Fişler listesinin sağ üstünden En Yeni / En Eski / En Yüksek Tutar / En Düşük Tutar
- **Fişi paylaş:** Fiş detayında "Paylaş" ile fotoğraf ve bilgiler (firma, tarih, tutar, KDV dilimleri) WhatsApp, Mail vb. ile tek dokunuşta gönderilir. Paylaşım menüsü olmayan bilgisayar tarayıcılarında bilgiler panoya kopyalanır

## 1.17.0 — `0d2907d`
- **İnternetsiz açılış:** Ana sayfa son yüklenen verileri cihazda saklar; bağlantı yokken boş kalmaz, üstte "Çevrimdışı · Son veriler (saat)" yazar. Bağlantı gelince dokunarak yenilenir. Açılış da daha hızlı (önce kayıtlı veri, sonra güncel veri). Çıkış yapınca bu kayıtlar silinir

## 1.16.0 — `7ccb3b1`
- **Sonradan fotoğraf ekleme:** Fiş detayında "Fotoğraf Ekle" (fotoğrafsız, elle eklenen fişler için) ya da "Fotoğrafı Değiştir"; kamerayla çekilebilir veya galeriden seçilebilir. Eski fotoğraf silinir, yer kaplamaz

## 1.15.0 — `95e14eb`
- **Kategori hafızası:** Bir firmanın fişini daha önce hangi kategoriyle kaydettiyseniz, o firmanın yeni fişlerinde yapay zekânın tahmini yerine sizin seçiminiz kullanılır ("Kategori, bu firmanın önceki fişinizden alındı" notu çıkar). "MİGROS TİCARET A.Ş." ile "Migros Tic. AŞ" aynı firma sayılır. Toplu taramada da çalışır

## 1.14.0 — `d99fe38`
- **Giyim kategorisi** (kıyafet, ayakkabı, iş kıyafeti). Kurulum kodu güncellendi (`004_giyim_category.sql`): 1.13.0 kurulumunu yapmış olsanız da olmasanız da ana sayfadaki "Yeni kategorileri etkinleştir" adımını bir kez yapmanız yeterli

## 1.13.0 — `eb517e6`
- **7 yeni kategori:** Ulaşım (taksi, otopark, otoyol), Araç Bakım (servis, lastik, yıkama), Konaklama, İletişim (telefon, internet), Faturalar (elektrik, su, doğalgaz), Kargo ve Diğer. Yapay zekâ fişleri bu kategorilere de ayırır
- Tek seferlik kurulum gerekir: ana sayfadaki "Yeni kategorileri etkinleştir" satırı adım adım anlatır (`supabase/migrations/003_more_categories.sql`). Mevcut fişler etkilenmez
- Kurulum yapılmadan yeni bir kategoriyle kaydedilirse anlaşılır bir uyarı çıkar

## 1.12.1 — `a2e3620`
- **Düzeltme (iPhone, iOS 26):** Arama çubuğu ekranın altına inip "Elle / Fiş Tara" düğmelerinin üstüne biniyordu; artık başlığın altında sabit

## 1.12.0 — `470136b`
- **Elle fiş ekleme:** Ana sayfanın altındaki "Elle" düğmesiyle fotoğrafsız fiş eklenebilir (e-posta ile gelen e-Arşiv faturaları, kaybolan fişler). Aynı fiş uyarısı burada da çalışır

## 1.11.0 — `a8b966d`
- **Geçen ayla karşılaştırma:** Aylık özet kartında "Geçen ay ₺X"; geçmiş aylarda ayrıca "%12 fazla / az" (bu ay bitmediği için yüzde gösterilmez)
- **Tüm Zamanlarda Ara:** Arama o ayda sonuç bulamazsa tek dokunuşla tüm fişlerde arar

## 1.10.0 — `aa91707`
- **Yeni sürüm bildirimi (web / Ana Ekran):** iPhone eski sürümü önbellekte tutuyorsa ana sayfanın üstünde "Yeni sürüm hazır" satırı çıkar; dokununca güncellenir

## 1.9.0 — `3373880`
- **Excel'de "Aylar" sayfası:** Fişler birden çok aya yayılıyorsa (yıllık / tüm zamanlar) ay ay fiş sayısı, toplam, %1/%10/%20 KDV ve KDV hariç tutar; muhasebeci aylık KDV beyannamesini doğrudan buradan okuyabilir
- **"Taslak Olarak Sakla":** Tek fiş taramasında Gemini yoğun ya da kota doluysa fotoğraf kaybolmaz; tek dokunuşla taslaklara eklenir, sonra Toplu Tarama'dan taranır
- README güncellendi: güncel özellikler, Expo Go, geri dönüş ve güvenlik önerileri

## 1.8.0 — `3b5da77`
- **Yıllık görünüm:** Ana sayfada Aylık / Yıllık / Tüm Zamanlar. Yıllar arasında oklarla gezilebilir; Excel ve Muhasebe Paketi o yılın fişleriyle "Fisler_2026.xlsx" gibi adlandırılır (yıllık gelir vergisi beyannamesi için)
- Görünümler arası geçişte seçili zaman korunur (2025 yılındayken "Aylık"a basınca Aralık 2025 açılır)
- Grafikte "Bu aya git" artık her görünümde çalışır

## 1.7.0 — `20ef4f7`
- **Toplu çekimde bekleme yok:** Fotoğraflar arka planda sırayla yükleniyor; kameradan hemen sonraki fişe geçebilirsiniz. Toplu Tarama ekranında "N fotoğraf yükleniyor…" satırı görünür
- **Taslak menüsü:** Bir taslağa dokununca: Fotoğrafı Görüntüle, (hatalıysa) Tekrar Tara, Taslağı Sil
- **Tüm Taslakları Sil** düğmesi (onay sorarak)

## 1.6.0 — `3ab4ef2`
- **Muhasebe Paketi (ZIP):** Dönemin Excel dosyası + tüm fiş fotoğrafları tek dosyada; fotoğraflar "2026-09-14_migros_337,30.jpg" gibi adlandırılır. İndirme ilerlemesi gösterilir
- **Düzeltme (iPhone):** Toplu taramada taslak fotoğrafının indirilmesi iPhone'da başarısız olabiliyordu (React Native'de Blob'dan bayt okunamıyor); artık dosya olarak indiriliyor

## 1.5.0 — `793eeb2`
- **Son 12 Ay grafiği** (Sağlık uygulaması tarzı): her ay KDV hariç tutar + KDV olarak; çubuğa dokununca o ayın toplamı ve KDV'si üstte görünür, aylık görünümde "Bu aya git" ile o aya geçilir. Renkler açık ve koyu modda renk körlüğü denetiminden geçirildi

## 1.4.0 — `055a755`
- **Tam ekran fotoğraf görüntüleyici:** Fiş fotoğrafına dokununca tam ekran açılır; iki parmakla yakınlaştırma, sürükleyerek gezinme, çift dokunarak yakınlaştırma/sıfırlama (Fotoğraflar uygulaması gibi)

## 1.3.0 — `949fdb0`
- **Mükerrer fiş uyarısı:** Aynı tarih ve tutarda bir fiş zaten kayıtlıysa kaydetmeden önce sorar (tek tarama, toplu inceleme ve düzenlemede)
- **Akıllı uyarılar:** İleri tarih, bir yıldan eski tarih, %20 sınırını aşan KDV (matrah/KDV karışması) ve hiç KDV girilmemesi durumunda formun üstünde turuncu uyarı

## 1.2.0 — `dce4791`
- **Arama:** Firma adına ya da tutara göre ("migros", "337", "1.500"). iPhone'da büyük başlığın altındaki sistem arama çubuğu; Türkçe harf ve büyük/küçük harf farkı gözetmez
- **Kategori filtresi:** Kategoriler bölümünde bir kategoriye dokununca liste o kategoriye göre süzülür; tekrar dokununca kaldırılır

## 1.1.0 — `feccd16`
- **Ayarlar ekranı** (sol üstteki profil simgesi): hesap bilgisi, fiş sayısı, fotoğrafların 1 GB'lık ücretsiz alandan ne kadar kullandığı (gösterge), tüm fişleri Excel'e aktarma, kullanılan yapay zekâ modeli, sürüm ve sürüm geçmişi, çıkış

## 1.0.3 — `e427d45`
- Beklenmeyen bir hatada beyaz ekran yerine "Bir Şeyler Ters Gitti" ekranı ve **Tekrar Dene** düğmesi
- Teknik hata mesajları anlaşılır Türkçeye çevrildi (internet yok, oturum süresi doldu, hatalı şifre vb.)

## 1.0.2 — `b76dd8e`
- 34 otomatik test (tutar/tarih okuma, AI yanıtı çözümleme, form doğrulama, Excel, planlama)
- Kod denetimi (lint) ve testler her yayından önce çalışır; hata varsa yayın yapılmaz
- Gece yarısını geçince elle girilen fişin tarihinin dün kalması düzeltildi
- React uyarıları giderildi (animasyon ve durum yönetimi)

## 1.0.1 — `905e2f5`
- Sürüm numarası uygulamada görünür (ör. "Sürüm 1.0.1 (a1b2c3d)")
- Yayın iş akışlarına **geri dönüş** (ref) seçeneği
- Bu sürüm geçmişi dosyası

## 1.0.0 — `03db3f4` ✅ kararlı
İlk kararlı sürüm.
- Tek fiş tarama (Gemini, yedek modellerle), düzenlenebilir form, Supabase'e kayıt
- Toplu tarama: taslaklar, toplu okuma, planlı tarama, inceleme akışı
- Apple tasarım dili (SF Symbols, gruplu listeler, karanlık mod, buzlu cam çubuklar)
- Aylık / Tüm zamanlar özeti, kategori ve KDV dağılımı
- Fiş düzenleme ve silme (kaydırarak silme dahil)
- Excel'e aktarma (Fişler + Özet sayfaları)
- Uygulama ikonu; web (GitHub Pages) ve iPhone (Expo Go) yayınları

### 1.0.0 öncesi önemli ara noktalar
| Commit | Açıklama |
|---|---|
| `bba59de` | Yeni tasarım + ana sayfa zıplama düzeltmesi |
| `a6b57e9` | Apple tarzı yeniden tasarım |
| `b350e1f` | Eski tasarım, toplu tarama ve kurulum ekranı dahil son sürüm |
