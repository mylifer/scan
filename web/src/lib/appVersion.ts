/*
 * Yeni sürüm yayınlandıktan sonra açık kalan sekmeler eski JS parçalarını (chunk) isteyebilir.
 * GitHub Pages özel başlık göndermediği için Next.js'in deploymentId koruması çalışmaz; bu yüzden:
 * 1) Parça yükleme hatası görülünce sayfa bir kez yenilenir (döngüye girmemesi için süre korumalı).
 * 2) dist/version.json periyodik okunur; sürüm değiştiyse kullanıcıya "Yenile" önerilir.
 */

/** next.config.ts'teki basePath ile aynı olmalı */
export const BASE_PATH = "/scan";

/** Derlemedeki commit (deploy-web.yml NEXT_PUBLIC_APP_VERSION olarak verir); yerelde boş */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

export const VERSION_URL = `${BASE_PATH}/version.json`;

/** Aynı sekmede art arda otomatik yenilemeyi önleyen süre */
export const RELOAD_GUARD_MS = 30_000;
export const RELOAD_STORAGE_KEY = "scan:chunk-reload-at";

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Failed to load chunk/i,
];

/** Hata, eski/silinmiş bir JS parçasının yüklenememesinden mi kaynaklanıyor? */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const name = typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  const text = `${name} ${message}`;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(text));
}

/** Son otomatik yenilemeden bu yana koruma süresi geçtiyse true */
export function canAutoReload(lastReloadAt: number | null, now: number, guardMs = RELOAD_GUARD_MS): boolean {
  return lastReloadAt === null || !Number.isFinite(lastReloadAt) || now - lastReloadAt > guardMs;
}

/** Sunucudaki sürüm, çalışan sürümden farklı mı? (Sürüm bilinmiyorsa false) */
export function isNewVersion(current: string, remote: unknown): boolean {
  if (!current) return false;
  if (!remote || typeof remote !== "object") return false;
  const commit = (remote as { commit?: unknown }).commit;
  return typeof commit === "string" && commit.length > 0 && commit !== current;
}

/** Parça hatasında sayfayı (koruma süresi içinde en fazla bir kez) yeniler; yenilediyse true döner */
export function reloadForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  let last: number | null = null;
  try {
    const raw = window.sessionStorage.getItem(RELOAD_STORAGE_KEY);
    last = raw ? Number(raw) : null;
  } catch {
    // sessionStorage erişilemezse korumasız devam edilir
  }
  const now = Date.now();
  if (!canAutoReload(last, now)) return false;
  try {
    window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
  } catch {
    // yok say
  }
  window.location.reload();
  return true;
}
