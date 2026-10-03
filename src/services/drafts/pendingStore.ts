import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Toplu çekimde henüz yüklenmemiş fotoğrafların kalıcı listesi (iPhone).
 * Fotoğraf çekilir çekilmez uygulamanın kalıcı klasörüne kopyalanır; yükleme bitince silinir.
 * Uygulama yükleme sırasında kapanırsa bir sonraki açılışta kaldığı yerden yüklenir.
 */
export interface PendingPhoto {
  key: string;
  uri: string;
  width: number;
  /** Fotoğrafı çeken kullanıcı (başka hesapla açılırsa onun taslaklarına yüklenmesin) */
  owner: string;
  attempts: number;
}

const STORAGE_KEY = 'pending-uploads:v1';
/** Bozuk bir dosya her açılışta sonsuza dek denenmesin */
export const MAX_ATTEMPTS = 3;

function folder() {
  const dir = new Directory(Paths.document, 'pending-uploads');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function readList(): Promise<PendingPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingPhoto[]) : [];
  } catch {
    return [];
  }
}

async function writeList(list: PendingPhoto[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // depolama kapalıysa kalıcılık olmadan devam (yükleme yine denenir)
  }
}

// Liste güncellemeleri sırayla yapılsın (art arda çekimlerde yarış olmasın)
let lock: Promise<unknown> = Promise.resolve();
function update<T>(fn: (list: PendingPhoto[]) => Promise<T> | T): Promise<T> {
  const run = lock.then(async () => {
    const list = await readList();
    const result = await fn(list);
    await writeList(list);
    return result;
  });
  lock = run.catch(() => undefined);
  return run;
}

/** Fotoğrafı kalıcı klasöre kopyalayıp listeye ekler; başarısızsa null (yükleme özgün dosyayla sürer). */
export async function persistPhoto(uri: string, width: number, owner: string): Promise<PendingPhoto | null> {
  try {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const target = new File(folder(), `${key}.jpg`);
    await new File(uri).copy(target);
    const item: PendingPhoto = { key, uri: target.uri, width, owner, attempts: 0 };
    await update((list) => {
      list.push(item);
    });
    return item;
  } catch {
    return null;
  }
}

/** Yükleme bitti (ya da artık denenmeyecek): dosyayı ve kaydı sil */
export async function removePending(key: string) {
  await update((list) => {
    const i = list.findIndex((p) => p.key === key);
    if (i >= 0) {
      try {
        const f = new File(list[i]!.uri);
        if (f.exists) f.delete();
      } catch {
        // dosya zaten yoksa sorun değil
      }
      list.splice(i, 1);
    }
  });
}

/** Başarısız deneme sayısını artırır; sınırı aştıysa kaydı siler ve true döner */
export async function markFailed(key: string): Promise<boolean> {
  const item = await update((list) => {
    const p = list.find((x) => x.key === key);
    if (p) p.attempts += 1;
    return p;
  });
  if (item && item.attempts >= MAX_ATTEMPTS) {
    await removePending(key);
    return true;
  }
  return false;
}

/** Bu kullanıcının, dosyası hâlâ duran bekleyen fotoğrafları (dosyası kaybolanlar listeden temizlenir) */
export async function loadPending(owner: string): Promise<PendingPhoto[]> {
  return update((list) => {
    const alive = list.filter((p) => {
      try {
        return new File(p.uri).exists;
      } catch {
        return false;
      }
    });
    list.splice(0, list.length, ...alive);
    return alive.filter((p) => p.owner === owner);
  });
}
