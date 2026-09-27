import { prepareDraftImage } from '../image/prepareReceiptImages';
import { addDraft } from '../supabase/draftsRepository';

/**
 * Toplu çekimde fotoğrafları arka planda, sırayla taslağa yükler.
 * Kamera ekranı kapansa da kuyruk devam eder; Toplu Tarama ekranı ilerlemeyi izler.
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

/** Fotoğrafı kuyruğa ekler; küçültme + yükleme sırayla yapılır (bellek dostu). */
export function enqueueDraftUpload(uri: string, width: number): Promise<boolean> {
  set({ pending: state.pending + 1 });
  const job = chain.then(async () => {
    try {
      await addDraft(await prepareDraftImage(uri, width));
      set({ pending: state.pending - 1, completed: state.completed + 1 });
      return true;
    } catch {
      set({ pending: state.pending - 1, failed: state.failed + 1 });
      return false;
    }
  });
  chain = job.then(() => undefined);
  return job;
}

/** Hata sayacını sıfırlar (kullanıcı uyarıyı gördükten sonra). */
export function clearUploadFailures() {
  set({ failed: 0 });
}
