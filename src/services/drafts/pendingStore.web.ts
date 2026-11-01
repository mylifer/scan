/**
 * Web'de seçilen fotoğraflar (blob URL) sayfa yenilenince zaten kaybolduğu için kalıcı liste tutulmaz.
 */
export interface PendingPhoto {
  key: string;
  uri: string;
  width: number;
  owner: string;
  attempts: number;
}

export const MAX_ATTEMPTS = 3;

export async function persistPhoto(): Promise<PendingPhoto | null> {
  return null;
}

export async function removePending(): Promise<void> {}

export async function markFailed(): Promise<number> {
  return 0;
}

export async function loadPending(): Promise<PendingPhoto[]> {
  return [];
}
