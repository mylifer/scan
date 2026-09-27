/**
 * Teknik hata mesajlarını kullanıcının anlayacağı Türkçeye çevirir.
 * Bilinmeyen hatalar olduğu gibi gösterilir (destek için ipucu olsun diye).
 */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : String(e ?? '');
  const lower = raw.toLowerCase();

  if (/network request failed|failed to fetch|networkerror|load failed|internet connection appears to be offline/.test(lower)) {
    return 'İnternet bağlantısı yok gibi görünüyor. Bağlantınızı kontrol edip tekrar deneyin.';
  }
  if (/timeout|timed out|zaman aşımı/.test(lower)) {
    return 'Sunucu zamanında yanıt vermedi. Biraz sonra tekrar deneyin.';
  }
  if (/jwt expired|invalid jwt|refresh token|not authenticated|oturum bulunamadı/.test(lower)) {
    return 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';
  }
  if (/row-level security|violates row-level|permission denied/.test(lower)) {
    return 'Bu işlem için yetkiniz yok. Çıkış yapıp tekrar giriş yapmayı deneyin.';
  }
  if (/payload too large|maximum allowed size|exceeded the maximum/.test(lower)) {
    return 'Fotoğraf çok büyük. Daha yakından ya da daha düşük çözünürlükte çekmeyi deneyin.';
  }
  if (/receipts_kategori_check/.test(lower)) {
    return 'Bu kategori henüz etkin değil. Ana sayfadaki "Veritabanını güncelle" adımını bir kez yapın ya da eski kategorilerden birini seçin.';
  }
  if (/invalid login credentials/.test(lower)) return 'E-posta ya da şifre hatalı.';
  if (/user already registered/.test(lower)) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
  if (/email not confirmed/.test(lower)) return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.';
  return raw || 'Beklenmeyen bir hata oluştu.';
}
