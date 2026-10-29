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

## 1.46.1 — `KOD`
- e-Faturalar listesinde **sıralama**: liste başlığının sağındaki düğmeyle En Yeni, En Eski, En Yüksek/Düşük Tutar, En Yüksek KDV, Firma (A–Z). Seçim telefonda hatırlanır

## 1.46.0 — `f29a349`
- **Yeni gezinme: alt sekmeler.** Fişler · e-Faturalar · KDV · Ayarlar. Ayarlar artık açılır pencere değil; e-Faturalar ve KDV ana sekme. Fiş, fatura detayı, kamera gibi ekranlar sekmenin üstünde açılır, geri tuşu hep geldiğiniz sekmeye döner
- **KDV sekmesi (yeni):** Seçilen ay için *Kestiğim KDV* (giden faturalar; alıcının ödediği tevkifat düşülerek beyan edilecek tutar), *Düşebileceğim KDV* (gelen e-Faturalar ve taranan fişler, ayrı satırlarda) ve *Bu ay ödenecek / sonraki aya devreden KDV*. Hem e-Faturası hem fişi olan alışveriş iki kez sayılmaz (aynı gün, aynı tutar, aynı VKN). İade faturaları ayrı gösterilir. Renkler anlam taşımaz; her rakamın ne olduğu yanında yazar
- Tüm Aylar (genel özet) ve Vergi Takvimi KDV sekmesinden açılır
- e-Faturalar ve KDV sekmeleri aynı ayın verisini QNB'ye iki kez sormaz

## 1.45.1 — `03f263c`
- e-Fatura Özeti: olağan dışı yüksek tutarlı giden faturalar artık varsayılan olarak toplamlara katılmıyor ("Toplamlara Dahil Et" anahtarıyla geri alınabilir). Aylık listede de KDV ve tutar toplamına girmiyor, satırında "Toplama dahil değil" yazıyor

## 1.45.0 — `c00fd55`
- **e-Fatura Özeti (yeni ekran):** e-Faturalar → Genel Özet. İlk faturadan bugüne gelen/giden sayıları, matrah, hesaplanan ve indirilecek KDV, fark, tevkifat, iade faturalarının KDV'si (ayrı), indirilecek KDV'nin oranlara dağılımı, yıllık ve aylık döküm. Olağan dışı yüksek tutarlı giden faturalar ayrıca uyarılır. Geçmiş aylar telefonda saklanır
- **Aylık listelerde KDV:** Her faturanın KDV'si satırda; Özet'te dönemin KDV toplamı ve matrahı, iade faturaları ayrı
- Gönderilmemiş taslak faturalar artık listede görünmüyor (QNB kontrolünde hesaba katılıyor)
- Bazı faturalarda alıcı/satıcı adı yerine VKN görünüyordu; düzeltildi

## 1.44.0 — `b24caa5`
- **QNB kontrolü:** Her ay, listedeki e-Fatura sayısı QNB'nin kendi sayımıyla karşılaştırılır (Özet'te "QNB Kontrolü"). Eksik varsa taşınmış eski faturalar kendiliğinden aranır — artık gelen faturalarda da ve listenin bir kısmı eksik olduğunda da. Yine eksik kalırsa uyarı çıkar
- **Son 12 Ayı Denetle:** e-Faturalar ekranının altında; her ay için gelen/giden sayısını QNB'ninkiyle karşılaştırır
- Eksik alıcı/tarih/tutar bilgileri daha hızlı tamamlanır (5'erli, en fazla 25 fatura)

## 1.43.7 — `8a96b10`
- Eski (QNB'nin taşıdığı) giden faturalar: ek tarama tutar ve durum sorgularıyla ETTN'leri bulur; alıcı, tarih ve tutar faturanın kendisinden tamamlanır. Detay ve PDF, normal indirme olmazsa "taşınan belgeler" metodundan alınır
- e-Arşiv oluşturma zamanı sorgusu QNB'nin istediği YYYYAAGGSSDDSS biçiminde

## 1.43.6 — `8721918`
- Giden listesi boşsa ek tarama: QNB'nin giden belge sayısı, portal (gönderim tarihi), web servis (belge tarihi) ve e-Arşiv (oluşturma zamanı); bulunanlar listeye eklenir, sonuçlar notta yazar

## 1.43.5 — `37986f1`
- Giden e-Faturalarda tutar 0 görünüyordu: Türkçe biçimli tutarlar (1.234,56) okunuyor; tutar yine yoksa QNB'nin tutar sorgusundan ya da faturanın kendisinden tamamlanıyor

## 1.43.4 — `239427e`
- Giden portal e-Faturaları: QNB'nin istediği belgeVersiyon eklendi; başka zorunlu alan isterse bilinen varsayılanla kendiliğinden yeniden denenir, sayfalı sonuçlar da okunur

## 1.43.3 — `64af47f`
- Giden e-Faturalar: QNB portalından kesilen faturalar da listeleniyor (gidenBelgeleriListelePortal); alıcı unvanı ve tutarıyla

## 1.43.2 — `7351c23`
- e-Faturalar: farklı tarih biçimleri (15.10.2026, saatli, epoch) tanınıyor; tarihi tanınmayan e-Arşiv faturası artık listeden düşmüyor
- Giden listesi boşsa QNB e-Arşiv servisinin kaç kayıt döndürdüğü yazıyor

## 1.43.1 — `c0b9f5a`
- Giden e-Arşiv faturaları: QNB sayfa başına en fazla 100 fatura kabul ediyor; sorgu 100'lük sayfalarla yapılıyor, tarih YYYYAAGG

## 1.43.0 — `23a9b00`
- **Fatura PDF'i:** Fatura detayında "PDF'i Aç": iPhone'da paylaşım menüsü (Dosyalar'a kaydet, yazdır, gönder), web'de indirilir
- **Giden e-Arşiv faturaları:** Sorgu, QNB'nin beklediği alanlarla düzeltildi (mukellefVkn, faturaTarihiBaslangic/Bitis)
- e-Arşiv faturalarına da dokunulabilir: kalemler, KDV ve PDF

## 1.42.0 — `7c4e522`
- **e-Fatura detayı:** e-Faturalar'da bir faturaya dokununca kalemler (miktar, birim fiyat, KDV oranı), KDV dökümü, ara toplam ve ödenecek tutar görünür (QNB'den faturanın kendisi okunur)
- **Giden e-Arşiv faturaları:** Giden sekmesinde e-Fatura ile birlikte e-Arşiv faturaları da listelenir; iptal edilenler işaretlenir ve toplama girmez. e-Arşiv alınamazsa sebebi ekranda yazar
- e-Arşiv servisinde giriş sorunu olursa gelen faturalar etkilenmez

## 1.41.3 — `f0cd4bc`
- e-Faturalar: QNB hesabı bloke olduğunda açık uyarı ("portaldan/destekten açtırın"); sunucu bu durumda 1 saat QNB'ye istek atmaz
- "Tekrar dene"ye dokununca "Deneniyor…" göstergesi

## 1.41.2 — `2f12c1d`
- e-Faturalar: QNB şifresinin sonunda yapıştırırken gelen satır sonu/boşluk girişi bozuyordu; QNB bilgileri artık kenar boşluklarından temizleniyor
- Yayın iş akışı QNB secret'larının biçimini (değerleri göstermeden) denetliyor

## 1.41.1 — `a59928f`
- e-Faturalar'da "yetkisi yok" uyarısı artık giriş yapılan e-postayı da gösteriyor; uzun hata mesajları kesilmeden okunuyor
- `QNB_ALLOWED_EMAILS` içinde tırnak, noktalı virgül ya da boşluk olsa da adres tanınıyor

## 1.41.0 — `e595c65`
- **e-Faturalar (QNB eSolutions):** Ayarlar → e-Faturalar. Gelen ve giden e-faturalar ay ay; satıcı/alıcı unvanı, fatura tarihi, belge no ve tutarı, üstte fatura sayısı ve dönem toplamı. Yalnızca görüntüleme, QNB'de hiçbir şey değiştirilmez
- QNB bilgileri uygulamada değil, Supabase'de saklanır (`qnb-efatura` fonksiyonu); faturaları yalnızca izin verilen hesap görür
- QNB girişi başarısız olursa otomatik tekrar denenmez (hesap kilitlenmesin)

## 1.40.0 — `f5e5b83`
- **Tüm Fişler'de toplu işaretleme:** "Seç" → "Tümünü Seç" (arama ve filtreye uyan bütün fişler, farklı aylar dahil) → "Gönderildi". "Yalnızca Gönderilmemişler" filtresi burada da var
- **iPhone'da "Yeni sürüm hazır":** Yeni güncelleme indirilince ana sayfada uyarı çıkar, dokununca hemen yüklenir (önceden uygulamayı tamamen kapatıp açmak gerekiyordu)
- Çok sayıda fiş birlikte işaretlenirken ya da kategorisi değiştirilirken istekler 100'erli gruplara bölünüyor

## 1.39.0 — `5405738`
- **Muhasebeciye gönderildi işareti:** Fişin detayında "Muhasebeciye Gönderildi" anahtarı; ana sayfada "Seç" → "Gönderildi" ile birden fazla fiş birlikte işaretlenir ya da işareti kaldırılır. Gönderilen fişlerin satırında yeşil kâğıt uçak simgesi görünür
- **Dışa aktarımda hariç tutma:** Excel ve Muhasebe Paketi'nin üstünde "Gönderilenleri Hariç Tut" anahtarı (son seçiminiz hatırlanır); altında kaç fişin aktarılacağı yazar. Dışa aktarım hiçbir fişi kendiliğinden işaretlemez
- "Yalnızca Gönderilmemişler" filtresi (dönemde gönderilmiş fiş varsa listenin üstünde)
- Gönderilmiş bir fişin tutarı ya da tarihi düzeltilirse, düzeltilmiş hâlinin de gönderilebilmesi için işaretin kaldırılması önerilir
- Seçim çubuğundaki düğme yazıları dar ekranda iki satıra kaymıyor

## 1.38.0 — `01c4d83`
- **e-Arşiv / e-Fatura PDF'i:** Elle Fiş Ekle → "PDF'ten Doldur" ile mailden gelen faturanın PDF'i seçilir, yapay zekâ satıcıyı, tarihi, ödenecek tutarı, KDV'yi, fatura numarasını ve satıcının VKN'sini doldurur (alıcının numarası karıştırılmaz)
- **Fatura karekodu:** Elle Fiş Ekle → "Karekodu Okut" ile e-Arşiv/e-Fatura çıktısındaki GİB karekodu okunur; tutar, KDV, tarih, fatura no ve VKN yapay zekâsız ve hatasız gelir. Firma adı karekodda olmadığı için bu VKN ile daha önce kaydettiğiniz fişten alınır (yoksa yazmanız istenir)
- **Face ID kilidi:** Ayarlar → Güvenlik. Açıkken uygulama açılışta ve 1 dakikadan uzun arka planda kaldıktan sonra Face ID ister (olmazsa telefon şifresi); uygulama değiştiricide içerik gizlenir
- **Ana ekran kısayolları:** Uygulama simgesine basılı tutunca Fiş Tara, Fatura Karekodu Okut, Elle / PDF Fatura Ekle ve Toplu Tarama
- **iPad desteği:** Uygulama iPad'e de kurulabiliyor; listeler geniş ekranda ortada, okunabilir genişlikte
- Face ID, kısayollar ve iPad yeni TestFlight derlemesiyle gelir; Expo Go'da ve eski derlemede bu özellikler görünmez (uygulama sorunsuz çalışmaya devam eder)

## 1.37.0 — `added62`
- **Güvenlik:** Fişler artık uygulamanın Supabase sunucusundaki fonksiyonla okunuyor. Gemini anahtarı web sürümünün ve iPhone uygulamasının içinde bulunmuyor; yayın sırasında pakette anahtar bulunursa yayın durduruluyor. Fonksiyonu yalnızca giriş yapmış kullanıcı çağırabiliyor (oturum sunucuda doğrulanıyor). Yayın öncesi canlı sistemde geçici bir test hesabıyla uçtan uca deneniyor. (Not: 1.30.0'dan eski bir sürüme geri dönülürse fiş okuma çalışmaz.)
- **Fiş no ve VKN/TCKN:** Yapay zekâ fişteki fiş numarasını ve firmanın vergi/TC kimlik numarasını da okuyor; formda düzeltilebiliyor. VKN/TCKN'nin kontrol hanesi doğrulanıyor, tutmazsa uyarı çıkıyor (okuma hatası olabilir)
- **Daha güvenilir mükerrer uyarısı:** Fiş no ve VKN varsa onlarla karşılaştırılıyor. Aynı gün aynı tutarlı iki ayrı fiş (farklı fiş no) artık yanlışlıkla "zaten kayıtlı" sayılmıyor; tutarı yanlış okunmuş aynı fiş ise yakalanıyor
- **Not ve etiketler:** Her fişe not ve etiket (ör. "X projesi", "müşteri yemeği") eklenebiliyor; daha önce kullanılan etiketler öneri olarak çıkıyor. Arama not, etiket (#proje), fiş no ve VKN'de de çalışıyor; etiketler fiş satırında görünüyor
- **12 yeni kategori:** Sağlık, Eğitim, Kira, Sigorta, Abonelik, Reklam, Vergi ve Harç, Banka Masrafı, Yapı Market, Kişisel Bakım, Hediye, Eğlence (toplam 25)
- **Kendi kategorileriniz:** Kategori seçicide arama yapıp yazdığınız adı tek dokunuşla kategori olarak ekleyebiliyorsunuz. Ayarlar → Kategoriler'den yeniden adlandırma ve silme yapılabiliyor (fişler yeni ada ya da seçtiğiniz kategoriye taşınıyor). Yapay zekâ kendi kategorilerinizi de seçebiliyor
- Excel'e Fiş No, VKN/TCKN, Etiketler ve Not sütunları eklendi; paylaşım metni ve tam yedek de bu bilgileri içeriyor (eski yedekler okunmaya devam ediyor)
- **Hata kayıtları:** Uygulamada beklenmeyen bir hata olursa Ayarlar → Hata Kayıtları'nda görünüyor; ayrıntısı kopyalanıp paylaşılabiliyor (internet kesintileri ve yapay zekâ yoğunluğu kaydedilmiyor)
- Veritabanı güncellemesi (006) GitHub Actions ile otomatik uygulanıyor; yapılmamışsa ana sayfada "Veritabanını güncelle" adımı çıkıyor

## 1.36.0 — `2073e0b`
- **Yeni uygulama simgesi:** fiş, tarama köşeleri ve yeşil tarama çizgisi. iPhone, Android ve web (ana ekrana ekleme) simgelerinin hepsi yenilendi. TestFlight'ta görünmesi için yeni derleme gerekir; Expo Go kendi simgesini göstermeye devam eder
- Android'de simgenin arkasında ikinci, büyük bir fiş görünüyordu; artık yalnızca mavi zemin var

## 1.35.2 — `302643a`
- TestFlight derlemesi artık GitHub'dan tek tıkla yapılıyor (bilgisayar gerekmez). Uygulamanın teknik adı Türkçe harfsiz "FisTarayici" oldu; telefonda görünen adı yine "Fiş Tarayıcı"

## 1.35.1 — `a0eac38`
- Fotoğraflı Excel ve Muhasebe Paketi: dosyanın sonu bazen eksik yazılıyordu; Excel açarken "bazı öğelerde sorun" uyarısı veriyordu. Artık dosya eksiksiz yazılıyor

## 1.35.0 — `e2cbc14`
- **TestFlight hazırlığı:** uygulama artık Expo Go'nun yanında kendi adı ve simgesiyle TestFlight'tan da kurulabilecek. Aynı güncellemeler ikisine birden gider
- TestFlight uygulamasında bildirim izni uyarısı "Expo Go" yerine "Fiş Tarayıcı" diyor; bildirimlerdeki "Fiş Tarayıcı" alt başlığı yalnızca Expo Go'da ekleniyor (kendi uygulamasında ad zaten görünüyor)

## 1.34.4 — `3e59de5`
- Vergi hatırlatıcısı ve aylık özet bildirimlerinde başlığın altında artık **"Fiş Tarayıcı"** yazıyor. Uygulama Expo Go içinde çalıştığı için iPhone bildirimi Expo Go adı ve simgesiyle gösteriyor (bu, Expo Go'nun sınırı); alt başlık bildirimin bu uygulamadan geldiğini belli ediyor. Zaten kurulu bildirimler uygulama bir kez açılınca yenilenir

## 1.34.3 — `095fc91`
- Fotoğraflı Excel: fotoğraf sayfasındaki "← Fişlere dön" artık belirgin bir düğme (mavi çerçeveli, büyük yazı) ve fotoğrafı aşağı kaydırınca da en üstte sabit kalıyor

## 1.34.2 — `bb022c0`
- Fotoğraflı Excel: küçük fotoğrafa tıklayınca bazen başka bir fişin fotoğrafı görünüyordu (kayma). Artık her fişin fotoğrafı kendi sayfasında ("Fiş 1", "Fiş 2"…) ve tıklayınca doğrudan o fotoğraf açılıyor

## 1.34.1 — `9fc825d`
- Muhasebe Paketi (ZIP) Mac'te çift tıklayınca açılmıyordu ("Hata 0 - Tanımsız hata"); artık Arşiv İzlencesi dahil her programla açılıyor. Fotoğraflı Excel dosyası da aynı yöntemle yazılıyor

## 1.34.0 — `4b68eab`
- **Fotoğraflı Excel:** "Excel'e Aktar" artık fiş fotoğraflarını da Excel'in içine koyuyor. Her fişin yanında küçük fotoğrafı var; fotoğrafa tıklayınca tam boyutu açılıyor, oradan "← Fişlere dön" ile geri dönülüyor. Muhasebeciye tek dosya göndermek yeterli
- İndirilemeyen fotoğraf olursa Excel yine oluşuyor, o fişin yanında "indirilemedi" yazıyor

## 1.33.1 — `9af8ac6`
- Expo SDK 58'e geçildi: Expo Go'nun yeni sürümü SDK 57 projelerini açmıyordu ("Project is incompatible with this version of Expo Go")

## 1.33.0 — `781fd32`
- **Son Eklenenler** (ana sayfa): uygulamaya en son eklediğiniz 30 fiş, eklenme zamanıyla (fiş üzerindeki tarihten bağımsız)
- **Çoklu** düğmesi (ana sayfanın altında): "Arka Arkaya Çek" ya da "Galeriden Seç (en fazla 50)". Fişler arka planda okunur, okunanlar sırayla incelemeye gelir
- Kamerada ilk fişten sonra "Sıradakini çekin; bitince İncele'ye basın" ipucu

## 1.32.1 — `2412ed4`
- Gemini kotası dolup okuma durunca kamerada bazı fişlerin "okunuyor" işareti dönmeye devam ediyordu; artık "okunamadı" görünüyor
- Hızlı çekim sürerken Toplu Tarama açılırsa okunmuş fişler tekrar "Şimdi Tara"ya düşüp ikinci kez okunabiliyordu (boşuna kota); liste artık canlı güncelleniyor
- Tüm Fişler ve Firma Detayı'nda "daha göster" ile açılan fişler, bir fişe girip geri dönünce kapanmıyor
- Tüm Fişler'in çevrimdışı kopyası binlerce fişte de saklanıyor
- Adında "%25" gibi ifadeler geçen firmaların detay sayfası boş açılıyordu

## 1.32.0 — `f804819`
- **Hızlı çekim:** "Fiş Tara"da fotoğrafı çektikten sonra kamera açık kalır; fiş arka planda Gemini'ye gider, siz hemen sonrakini çekersiniz. Üstte "3 fiş · 1 okunuyor · 2 hazır" gibi durum, köşedeki küçük resimde son fişin durumu görünür
- **İncele:** okunan fişleri sırayla açar; okunmakta olanlar hazır oldukça sıraya eklenir. Çıkarsanız okuma arka planda sürer, fişler ana sayfadaki Taslaklar'da bekler
- Toplu Tarama'da "İncele ve Kaydet" artık okuma sürerken de kullanılabilir

## 1.31.0 — `c063a3d`
- **Tüm Fişler** (ana sayfa → Tüm Fişler): bugüne kadar girilen bütün fişler, aylara göre gruplu; toplam gider ve KDV, arama ve sıralama
- **Firmalar** (ana sayfa → Firmalar): fiş girilen tüm firmalar, toplam harcama, fiş sayısı ve son fiş tarihiyle; aranabilir, sıralanabilir
- **Firma Detayı:** firmaya dokununca o firmanın toplamı, KDV alacağı, KDV dağılımı (%1/%10/%20), ortalama fiş, ilk/son fiş tarihi ve tüm fişleri

## 1.30.0 — `9018e9b`
- **Son Silinenler (çöp kutusu):** Silinen fiş 30 gün boyunca Ayarlar → Son Silinenler'de durur, fotoğrafıyla birlikte geri alınabilir; süre dolunca kalıcı silinir. Veritabanı güncellemesi yapıldı (005)
- **Firma Adlarını Birleştir** (Ayarlar → Veriler): "MİGROS TİCARET A.Ş.", "Migros", "MIGROS" gibi yazımları tek ada toplar; hangi adın kullanılacağını ve hangi yazımların dahil olacağını siz seçersiniz
- **Toplu düzenleme:** Ana sayfada sağ üstteki "Seç" ile birden çok fişi işaretleyip kategorisini tek seferde değiştirin ya da silin
- **KDV oranı kontrolü:** Kategoriye göre pek görülmeyen KDV dilimi girilirse uyarır (ör. akaryakıtta %10, restoranda %1). Kaydı engellemez
- **Emin olunamayan alanlar:** Yapay zekâ fişte net okuyamadığı alanları turuncu işaretler; düzeltince işaret kalkar. Ek istek harcamaz
- **Aylık Özet Bildirimi** (Ayarlar → Takip): her ayın 1'inde geçen ayın gider, KDV ve fiş sayısı; dokununca o ayın özeti açılır

## 1.29.1 — `b08221d`
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
