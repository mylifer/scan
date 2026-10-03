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
        const uri = await downloadDraftImage(d.image_path);
        const image = await prepareAiImage(uri, DRAFT_WIDTH).finally(() => releaseLocal(uri));
        result = (await applyLearnedCategory(await getVisionService().analyzeReceipt(image))).data;
      } catch (e) {
        await updateDraft(d.id, { status: 'failed', error: errorMessage(e) }).catch(() => {});
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
      } catch (e) {
        set({ stoppedReason: `Sonuç kaydedilemedi: ${errorMessage(e)}`, done: i + 1 });
        onItemDone?.();
        break;
      }
      set({ done: i + 1 });
      onItemDone?.();
      if (i < drafts.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  } finally {
    set({ running: false });
  }
  return ok;
}
