import { errorMessage, isNetworkError } from '../../lib/errors';
import type { ReceiptData, ReceiptDraft } from '../../types/receipt';
import { DRAFT_WIDTH, prepareAiImage } from '../image/prepareReceiptImages';
import { downloadDraftImage, updateDraft } from '../supabase/draftsRepository';
import { releaseLocal } from '../supabase/storageFiles';
import { applyLearnedCategory } from '../supabase/receiptsRepository';
import { getVisionService, VisionServiceError } from '../vision';

/**
 * Taslakları sırayla AI'a gönderir. Uygulama genelinde tek bir kuyruk çalışır;
 * ekranlar ilerlemeyi subscribeProcessor ile izler.
 */
export interface ProcessorState {
  running: boolean;
  done: number;
  total: number;
  /** Kuyruk erken durduysa (kota/yoğunluk) nedeni */
  stoppedReason: string | null;
}

/** Ücretsiz planın dakikalık sınırına takılmamak için istekler arası bekleme */
const PAUSE_MS = 4000;

let state: ProcessorState = { running: false, done: 0, total: 0, stoppedReason: null };
const listeners = new Set<(s: ProcessorState) => void>();

/** Taslak başına durum değişikliği (hızlı çekimde kamera ve inceleme ekranı izler) */
export type DraftScanStatus = 'processing' | 'ready' | 'failed';
const draftListeners = new Set<(id: string, status: DraftScanStatus) => void>();
const emitDraft = (id: string, status: DraftScanStatus) => draftListeners.forEach((l) => l(id, status));

export function subscribeDraftStatus(listener: (id: string, status: DraftScanStatus) => void): () => void {
  draftListeners.add(listener);
  return () => draftListeners.delete(listener);
}

/** Son AI isteğinin zamanı: istekler arasında en az PAUSE_MS olsun (ardışık kuyruklarda da) */
let lastRequestAt = 0;
async function waitForSlot() {
  const wait = lastRequestAt + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function set(patch: Partial<ProcessorState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getProcessorState() {
  return state;
}

export function subscribeProcessor(listener: (s: ProcessorState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Taranabilir durumdaki taslaklar: bekleyen, hatalı ya da yarıda kalmış olanlar. */
export function isScannable(d: ReceiptDraft) {
  return d.status === 'pending' || d.status === 'failed' || (d.status === 'processing' && !state.running);
}

export function isDue(d: ReceiptDraft, now = new Date()) {
  return d.status === 'scheduled' && !!d.scheduled_for && new Date(d.scheduled_for) <= now;
}

/**
 * Verilen taslakları tarar. Zaten çalışan bir kuyruk varsa hiçbir şey yapmaz.
 * @returns başarıyla okunan taslak sayısı
 */
export async function processDrafts(drafts: ReceiptDraft[], onItemDone?: () => void): Promise<number> {
  if (state.running || !drafts.length) return 0;
  set({ running: true, done: 0, total: drafts.length, stoppedReason: null });
  let ok = 0;
  try {
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      let result: ReceiptData;
      try {
        await updateDraft(d.id, { status: 'processing', error: null });
        emitDraft(d.id, 'processing');
        const uri = await downloadDraftImage(d.image_path);
        const image = await prepareAiImage(uri, DRAFT_WIDTH).finally(() => releaseLocal(uri));
        await waitForSlot();
        result = (await applyLearnedCategory(await getVisionService().analyzeReceipt(image))).data;
      } catch (e) {
        await updateDraft(d.id, { status: 'failed', error: errorMessage(e) }).catch(() => {});
        emitDraft(d.id, 'failed');
        // Kota/yoğunluk ya da bağlantı kopukluğu: kalanları denemek boşuna; olduğu gibi bırak
        if ((e instanceof VisionServiceError && (e.kind === 'quota' || e.kind === 'busy')) || isNetworkError(e)) {
          set({ stoppedReason: e instanceof VisionServiceError ? e.message : errorMessage(e), done: i + 1 });
          onItemDone?.();
          break;
        }
        set({ done: i + 1 });
        onItemDone?.();
        continue;
      }
      // Okuma başarılı (kota harcandı): sonucu kaydetmeyi bir kez daha dene; yine olmazsa
      // taslağı 'failed' yapma (sonuç kaybolmasın) — kuyruğu durdur, taslak tekrar taranabilir kalır
      try {
        await updateDraft(d.id, { status: 'ready', result, scheduled_for: null, error: null }).catch(() =>
          updateDraft(d.id, { status: 'ready', result, scheduled_for: null, error: null }),
        );
        ok++;
        emitDraft(d.id, 'ready');
      } catch (e) {
        emitDraft(d.id, 'failed');
        set({ stoppedReason: `Sonuç kaydedilemedi: ${errorMessage(e)}`, done: i + 1 });
        onItemDone?.();
        break;
      }
      set({ done: i + 1 });
      onItemDone?.();
    }
  } finally {
    set({ running: false });
  }
  return ok;
}

/**
 * Hızlı çekim: fotoğraf taslak olarak yüklenir yüklenmez okumaya alınır; kullanıcı bu sırada
 * sonraki fişi çeker. Kuyruk çalışırken gelenler sıraya eklenir. Kota/yoğunluk nedeniyle durursa
 * kalanlar taslak olarak bekler (Toplu Tarama'dan taranabilir).
 */
const autoQueue: ReceiptDraft[] = [];
let autoLoop: Promise<void> | null = null;

/** Okuma sırasında bekleyen ya da işlenen fiş var mı */
export function isAutoScanBusy(): boolean {
  return state.running || autoQueue.length > 0;
}

function waitUntilIdle(): Promise<void> {
  if (!state.running) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = subscribeProcessor((s) => {
      if (!s.running) {
        unsub();
        resolve();
      }
    });
  });
}

export function autoScan(draft: ReceiptDraft): void {
  autoQueue.push(draft);
  set({}); // izleyenler "bekleyen var" durumunu görsün
  if (autoLoop) return;
  autoLoop = (async () => {
    try {
      while (autoQueue.length) {
        if (state.running) {
          await waitUntilIdle();
          continue;
        }
        const batch = autoQueue.splice(0);
        await processDrafts(batch);
        if (state.stoppedReason) {
          // Kalanları denemek boşuna (kota/bağlantı); taslak olarak bekler
          autoQueue.splice(0).forEach((d) => emitDraft(d.id, 'failed'));
          break;
        }
      }
    } catch {
      autoQueue.splice(0).forEach((d) => emitDraft(d.id, 'failed'));
    } finally {
      autoLoop = null;
      set({});
    }
  })();
}
