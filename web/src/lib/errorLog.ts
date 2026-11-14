import { isNetworkError } from "@shared/lib/errors";
import { APP_VERSION, isChunkLoadError } from "./appVersion";
import { supabase } from "./supabase";

export interface AppErrorRecord {
  id: number;
  created_at: string;
  context: string;
  message: string;
  detail: string | null;
  app_version: string | null;
  platform: string | null;
}

const TABLE = "app_errors";

/** Son hata kayıtlarını çeker */
export async function listErrors(limit = 100): Promise<AppErrorRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(`Hata kayıtları yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as AppErrorRecord[];
}

/** Tüm hata kayıtlarını siler */
export async function clearErrors(): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().gte("id", 0);
  if (error) {
    throw new Error(`Hata kayıtları silinemedi: ${error.message}`);
  }
}

/** Bir sekmede en fazla bu kadar kayıt gönderilir (döngüye giren bir hata tabloyu doldurmasın) */
const MAX_PER_SESSION = 30;
const seen = new Set<string>();
let sent = 0;
let tableMissing = false;

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Kaydedilmeyecek hatalar: internet kopukluğu, eski sürüm parçası (VersionGuard yeniler), tarayıcı eklentileri */
export function shouldIgnoreError(e: unknown): boolean {
  if (!e) return true;
  if (isNetworkError(e) || isChunkLoadError(e)) return true;
  const msg = describe(e);
  if (/ResizeObserver loop/i.test(msg)) return true;
  const stack = e instanceof Error ? (e.stack ?? "") : "";
  return /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack);
}

/**
 * Beklenmeyen bir hatayı Supabase'e (app_errors) yazar; Ayarlar → Hata Günlüğü'nde mobil kayıtlarla birlikte görünür.
 * Hiçbir zaman hata fırlatmaz, beklemeye gerek yoktur. Aynı sekmede tekrarlanan aynı hata ve oturumsuz durumlar kaydedilmez.
 */
export function reportError(context: string, error: unknown, extra?: string): void {
  void (async () => {
    try {
      if (tableMissing || sent >= MAX_PER_SESSION || shouldIgnoreError(error)) return;
      const message = (describe(error) || "Bilinmeyen hata").slice(0, 2000);
      const key = `${context}|${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      sent++;
      const stack = error instanceof Error && error.stack ? error.stack : "";
      const yer = typeof window !== "undefined" ? `Sayfa: ${window.location.pathname}` : "";
      const detail = [extra, yer, stack].filter(Boolean).join("\n\n").slice(0, 8000) || null;
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const { error: insertError } = await supabase.from(TABLE).insert({
        context: context.slice(0, 100),
        message,
        detail,
        app_version: `web ${APP_VERSION.slice(0, 7) || "yerel"}`.slice(0, 100),
        platform: `web ${ua}`.slice(0, 100),
      });
      // Tablo yoksa (006 kurulumu yapılmamış) bu sekmede bir daha denenmez
      if (insertError && (insertError.code === "PGRST205" || insertError.code === "42P01")) tableMissing = true;
    } catch {
      // Kayıt isteğe bağlı: sessizce geç
    }
  })();
}
