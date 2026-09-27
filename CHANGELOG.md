# Sürüm Geçmişi

Her sürümün yanındaki **commit kodu**, o sürüme geri dönmek için kullanılır.

## Geri dönüş nasıl yapılır?

1. GitHub'da **Actions** sekmesini açın: https://github.com/mylifer/scan/actions
2. Soldan **"Web sürümünü yayınla"** iş akışını seçin → sağdaki **"Run workflow"** düğmesi.
3. **ref** kutusuna aşağıdaki tablodan dönmek istediğiniz sürümün commit kodunu yazın → **Run workflow**.
4. iPhone (Expo Go) için aynısını **"iPhone uygulaması"** iş akışında, `action: update` seçerek yapın.
5. Tekrar en son sürüme dönmek için aynı adımları **ref boş** bırakarak yapın.

> Not: Geri dönüş yalnızca yayını eski koda çevirir; veritabanındaki fişlerinize dokunmaz.

---

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
