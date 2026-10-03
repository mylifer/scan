import { prepareDraftImage } from '../image/prepareReceiptImages';
import { revokeBlobUrl } from '../../lib/pendingPhoto';
import { supabase } from '../supabase/client';
import { addDraft } from '../supabase/draftsRepository';
import { loadPending, markFailed, type PendingPhoto, persistPhoto, removePending } from './pendingStore';

/**
 * Toplu çekimde fotoğrafları arka planda, sırayla taslağa yükler.
 * Kamera ekranı kapansa da kuyruk devam eder; Toplu Tarama ekranı ilerlemeyi izler.
 * iPhone'da her fotoğraf önce kalıcı klasöre kopyalanır: uygulama yükleme bitmeden kapanırsa
 * bir sonraki açılışta resumePendingUploads ile kaldığı yerden yüklenir.
 */
export interface UploadState {
  /** Sırada ya da yüklenmekte olan fotoğraf sayısı */
  pending: number;
  /** Bu oturumda yüklenemeyen fotoğraf sayısı */
  failed: number;
  /** Tamamlanan yükleme sayısı (her yüklemede artar; ekranlar yenilemek için izler) */
  completed: number;
}

let state: UploadState = { pending: 0, failed: 0, completed: 0 };
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

/** Kuyruğa bir iş ekler: `source` küçültülüp taslak olarak yüklenir */
function schedule(source: Promise<{ uri: string; width: number; pending: PendingPhoto | null }>): Promise<boolean> {
  set({ pending: state.pending + 1 });
  const job = chain.then(async () => {
    const { uri, width, pending } = await source;
    try {
      await addDraft(await prepareDraftImage(uri, width));
      if (pending) await removePending(pending.key);
      set({ pending: state.pending - 1, completed: state.completed + 1 });
      return true;
    } catch {
      // Kalıcı kopya bir sonraki açılışta tekrar denenir (en fazla MAX_ATTEMPTS kez)
      if (pending) await markFailed(pending.key);
      set({ pending: state.pending - 1, failed: state.failed + 1 });
      return false;
    } finally {
      // Web'de seçilen fotoğrafın tam çözünürlüklü kopyası yüklendikten sonra bellekte kalmasın
      revokeBlobUrl(uri);
    }
  });
  chain = job.then(() => undefined);
  return job;
}

/** Fotoğrafı kuyruğa ekler; küçültme + yükleme sırayla yapılır (bellek dostu). */
export function enqueueDraftUpload(uri: string, width: number): Promise<boolean> {
  // Kalıcı kopya hemen (kuyruğu beklemeden) alınır: uygulama şimdi kapansa bile fotoğraf kaybolmaz
  const source = currentOwner()
    .then((owner) => persistPhoto(uri, width, owner))
    .catch(() => null)
    .then((pending) => ({ uri: pending?.uri ?? uri, width, pending }));
  return schedule(source);
}

let resumed = false;

/**
 * Önceki oturumda yüklenemeden kalan fotoğrafları kuyruğa alır (açılışta bir kez, giriş yapıldıktan sonra).
 * @returns kuyruğa alınan fotoğraf sayısı
 */
export async function resumePendingUploads(): Promise<number> {
  if (resumed) return 0;
  resumed = true;
  const owner = await currentOwner();
  if (!owner) {
    resumed = false;
    return 0;
  }
  const items = await loadPending(owner);
  items.forEach((p) => schedule(Promise.resolve({ uri: p.uri, width: p.width, pending: p })));
  return items.length;
}

/** Hata sayacını sıfırlar (kullanıcı uyarıyı gördükten sonra). */
export function clearUploadFailures() {
  set({ failed: 0 });
}
