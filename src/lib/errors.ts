/**
 * Teknik hata mesajlarını kullanıcının anlayacağı Türkçeye çevirir.
 * Bilinmeyen hatalar olduğu gibi gösterilir (destek için ipucu olsun diye).
 */
const NETWORK_RE = /network request failed|failed to fetch|networkerror|load failed|internet connection appears to be offline/;

/** Bağlantı kopukluğu mu? (tekrar denemek yerine işi durdurmak için) */
export function isNetworkError(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return NETWORK_RE.test(raw.toLowerCase());
}

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : String(e ?? '');
  const lower = raw.toLowerCase();

  if (NETWORK_RE.test(lower)) {
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
  if (/(fis_no|vkn|notlar|etiketler|receipt_categories|app_errors).*(does not exist|schema cache|could not find)|(does not exist|could not find).*(fis_no|vkn|notlar|etiketler|receipt_categories|app_errors)/.test(lower)) {
    return 'Veritabanı güncellemesi henüz yapılmamış. Ana sayfadaki "Veritabanını güncelle" adımını bir kez tamamlayın.';
  }
  if (/receipts_vkn_check/.test(lower)) return 'VKN 10, TCKN 11 haneli olmalı ve yalnızca rakam içermeli.';
  if (/invalid login credentials/.test(lower)) return 'E-posta ya da şifre hatalı.';
  if (/rate limit|too many requests|for security purposes, you can only request/.test(lower)) {
    return 'Çok sık istek gönderildi. Birkaç dakika (e-posta için bir saate kadar) bekleyip tekrar deneyin.';
  }
  if (/new password should be different/.test(lower)) return 'Yeni şifre eskisinden farklı olmalı.';
  if (/user already registered/.test(lower)) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
  if (/email not confirmed/.test(lower)) return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.';
  return raw || 'Beklenmeyen bir hata oluştu.';
}
