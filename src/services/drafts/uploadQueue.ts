import { prepareDraftImage } from '../image/prepareReceiptImages';
import { revokeBlobUrl } from '../../lib/pendingPhoto';
import { withRetry } from '../../lib/retry';
import { supabase } from '../supabase/client';
import { addDraft } from '../supabase/draftsRepository';
import type { ReceiptDraft } from '../../types/receipt';
import { autoScan } from './draftProcessor';
import { loadPending, markFailed, MAX_ATTEMPTS, type PendingPhoto, persistPhoto, removePending } from './pendingStore';

/**
 * Toplu çekimde fotoğrafları arka planda, sırayla taslağa yükler.
 * Kamera ekranı kapansa da kuyruk devam eder; Toplu Tarama ekranı ilerlemeyi izler.
 * iPhone'da her fotoğraf önce kalıcı klasöre kopyalanır: yükleme başarısız olursa ya da uygulama
 * yükleme bitmeden kapanırsa fotoğraf silinmez; resumePendingUploads ile (açılışta, uygulama öne
 * geldiğinde ya da kullanıcı "Tekrar Dene" deyince) yeniden yüklenir.
 */
export interface UploadState {
  /** Sırada ya da yüklenmekte olan fotoğraf sayısı */
  pending: number;
  /** Bu oturumda yüklenemeyen fotoğraf sayısı */
  failed: number;
  /** Kalıcı kopyası da alınamadığı için tekrar denenemeyen (kaybolan) fotoğraf sayısı */
  lost: number;
  /** Tamamlanan yükleme sayısı (her yüklemede artar; ekranlar yenilemek için izler) */
  completed: number;
}

let state: UploadState = { pending: 0, failed: 0, lost: 0, completed: 0 };
/** Kuyrukta bekleyen ya da yüklenmekte olan kalıcı fotoğraflar (aynı fotoğraf iki kez sıraya girmesin) */
const inFlight = new Set<string>();
const listeners = new Set<(s: UploadState) => void>();
let chain: Promise<void> = Promise.resolve();

function set(patch: Partial<UploadState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getUploadState() {
  return state;
}

export function subscribeUploads(listener: (s: UploadState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function currentOwner(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.user.id ?? '';
}

/** Kuyruğa bir iş ekler: `source` küçültülüp taslak olarak yüklenir. @returns oluşan taslak ya da null */
function schedule(source: Promise<{ uri: string; width: number; pending: PendingPhoto | null }>, scan = false): Promise<ReceiptDraft | null> {
  set({ pending: state.pending + 1 });
  const job = chain.then(async () => {
    const { uri, width, pending } = await source;
    try {
      // Geçici bağlantı kopukluklarında aynı oturumda 2 kez daha denenir (2 sn, 5 sn sonra)
      const draft = await withRetry(async () => addDraft(await prepareDraftImage(uri, width)));
      if (pending) await removePending(pending.key);
      set({ pending: state.pending - 1, completed: state.completed + 1 });
      // Hızlı çekim: yüklenir yüklenmez okumaya al (kullanıcı bu sırada sonrakini çeker)
      if (scan) autoScan(draft);
      return draft;
    } catch {
      // Kalıcı kopya silinmez: uygulama öne gelince ya da "Tekrar Dene" ile yeniden yüklenir
      if (pending) await markFailed(pending.key);
      set({ pending: state.pending - 1, failed: state.failed + 1, lost: state.lost + (pending ? 0 : 1) });
      return null;
    } finally {
      if (pending) inFlight.delete(pending.key);
      // Web'de seçilen fotoğrafın tam çözünürlüklü kopyası yüklendikten sonra bellekte kalmasın
      revokeBlobUrl(uri);
    }
  });
  chain = job.then(() => undefined);
  return job;
}

/**
 * Fotoğrafı kuyruğa ekler; küçültme + yükleme sırayla yapılır (bellek dostu).
 * @param options.scan yüklenince hemen yapay zekâyla okunsun (hızlı çekim)
 */
export function enqueueDraftUpload(uri: string, width: number, options: { scan?: boolean } = {}): Promise<ReceiptDraft | null> {
  // Kalıcı kopya hemen (kuyruğu beklemeden) alınır: uygulama şimdi kapansa bile fotoğraf kaybolmaz
  const source = currentOwner()
    .then((owner) => persistPhoto(uri, width, owner))
    .catch(() => null)
    .then((pending) => {
      if (pending) inFlight.add(pending.key);
      return { uri: pending?.uri ?? uri, width, pending };
    });
  return schedule(source, options.scan);
}

let resuming: Promise<number> | null = null;

/**
 * Yüklenemeden kalan kalıcı fotoğrafları kuyruğa alır (açılışta, uygulama öne geldiğinde, "Tekrar Dene").
 * @param all false ise MAX_ATTEMPTS kez başarısız olanlar atlanır (otomatik denemede); true ise hepsi denenir
 * @returns kuyruğa alınan fotoğraf sayısı
 */
export function resumePendingUploads(all = false): Promise<number> {
  if (resuming) return resuming;
  resuming = (async () => {
    const owner = await currentOwner();
    if (!owner) return 0;
    const items = (await loadPending(owner)).filter((p) => !inFlight.has(p.key) && (all || p.attempts < MAX_ATTEMPTS));
    items.forEach((p) => {
      inFlight.add(p.key);
      schedule(Promise.resolve({ uri: p.uri, width: p.width, pending: p }));
    });
    return items.length;
  })().finally(() => {
    resuming = null;
  });
  return resuming;
}

/** Yüklenemeyip bekleyen (kuyrukta olmayan) kalıcı fotoğraf sayısı */
export async function countStuckUploads(): Promise<number> {
  const owner = await currentOwner();
  if (!owner) return 0;
  return (await loadPending(owner)).filter((p) => !inFlight.has(p.key)).length;
}

/** Bekleyen tüm fotoğrafları yeniden dener (kullanıcı "Tekrar Dene" dediğinde) */
export function retryStuckUploads(): Promise<number> {
  set({ failed: 0, lost: 0 });
  return resumePendingUploads(true);
}

/** Yüklenemeyen fotoğraflardan vazgeçer: kalıcı kopyaları siler (yalnızca kullanıcı onayıyla) */
export async function discardStuckUploads(): Promise<number> {
  const owner = await currentOwner();
  if (!owner) return 0;
  const items = (await loadPending(owner)).filter((p) => !inFlight.has(p.key));
  for (const p of items) await removePending(p.key);
  set({ failed: 0, lost: 0 });
  return items.length;
}

/** Hata sayacını sıfırlar (kullanıcı uyarıyı gördükten sonra). */
export function clearUploadFailures() {
  set({ failed: 0, lost: 0 });
}
