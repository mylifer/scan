/** Ekranın üstünde kısa süre görünüp kaybolan bildirim. ToastHost kök layout'ta dinler. */
export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  /** Görünme süresi (ms) */
  duration: number;
}

type Listener = (toast: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(text: string, type: ToastType = 'success', duration = 2500) {
  const toast = { id: nextId++, text, type, duration };
  listeners.forEach((l) => l(toast));
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
