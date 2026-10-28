import { Platform } from 'react-native';

import { isNetworkError } from '../lib/errors';
import { VERSION_LABEL } from '../lib/version';
import { supabase } from './supabase/client';

const TABLE = 'app_errors';
/** Bir oturumda en fazla bu kadar kayıt gönderilir (döngüye giren bir hata tabloyu doldurmasın) */
const MAX_PER_SESSION = 30;

const seen = new Set<string>();
let sent = 0;
let tableMissing = false;

export interface AppErrorRecord {
  id: number;
  created_at: string;
  context: string;
  message: string;
  detail: string | null;
  app_version: string | null;
  platform: string | null;
}

const describe = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === 'string'
      ? e
      : (() => {
          try {
            return JSON.stringify(e);
          } catch {
            return String(e);
          }
        })();

/**
 * Beklenmeyen bir hatayı Supabase'e (app_errors) yazar; Ayarlar → Hata Kayıtları'nda görünür.
 * Hiçbir zaman hata fırlatmaz ve beklemeye gerek yoktur. İnternet hataları, oturum yokken olanlar ve
 * aynı oturumda tekrarlanan aynı hata kaydedilmez.
 */
export function reportError(context: string, error: unknown, extra?: string): void {
  void (async () => {
    try {
      if (tableMissing || sent >= MAX_PER_SESSION || isNetworkError(error)) return;
      const message = (describe(error) || 'Bilinmeyen hata').slice(0, 2000);
      const key = `${context}|${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      sent++;
      const stack = error instanceof Error && error.stack ? error.stack : '';
      const detail = [extra, stack].filter(Boolean).join('\n\n').slice(0, 8000) || null;
      const { error: insertError } = await supabase.from(TABLE).insert({
        context: context.slice(0, 100),
        message,
        detail,
        app_version: VERSION_LABEL.slice(0, 100),
        platform: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim().slice(0, 100),
      });
      // Tablo yoksa (006 kurulumu yapılmamış) bu oturumda bir daha denenmez
      if (insertError && (insertError.code === 'PGRST205' || insertError.code === '42P01')) tableMissing = true;
    } catch {
      // Kayıt isteğe bağlı: sessizce geç
    }
  })();
}

let installed = false;

/** Yakalanmamış hataları ve sonuçlanamayan işlemleri kaydeder (uygulama açılışında bir kez) */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => reportError('yakalanmamış hata', e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => reportError('yakalanmamış işlem hatası', e.reason));
    return;
  }
  const errorUtils = (
    globalThis as {
      ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
    }
  ).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((e, fatal) => {
    reportError(fatal ? 'çökme' : 'yakalanmamış hata', e);
    previous(e, fatal);
  });
}

/** Son hata kayıtları (en yeni önce) */
export async function listErrors(limit = 100): Promise<AppErrorRecord[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppErrorRecord[];
}

/** Tüm hata kayıtlarını siler */
export async function clearErrors(): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().gte('id', 0);
  if (error) throw new Error(error.message);
  seen.clear();
}
