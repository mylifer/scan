import type { Kategori } from '../types/receipt';

export interface CategoryPickRequest {
  title?: string;
  /** İşaretli gösterilecek kategori */
  selected?: Kategori;
  onSelect: (k: Kategori) => void;
}

type Listener = (req: CategoryPickRequest | null) => void;
const listeners = new Set<Listener>();

/** Kategori seçme sayfasını açar (CategoryPickerHost çizer): arama, kendi kategorisini ekleme */
export function showCategoryPicker(req: CategoryPickRequest) {
  listeners.forEach((l) => l(req));
}

export function subscribeCategoryPicker(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
