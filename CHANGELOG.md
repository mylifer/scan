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

## 1.0.1
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
