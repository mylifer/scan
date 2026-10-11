export interface PickedPhoto {
  uri: string;
  width: number;
}

/** Tarayıcıda birden çok fotoğraf seçtirir. Vazgeçilirse boş dizi. */
export function pickPhotos(): Promise<PickedPhoto[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    let settled = false;
    const done = (v: PickedPhoto[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []);
      done(
        await Promise.all(
          files.map(async (f) => {
            const uri = URL.createObjectURL(f);
            return { uri, width: await imageWidth(uri) };
          }),
        ),
      );
    });
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}

function imageWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth || 1600);
    img.onerror = () => resolve(1600);
    img.src = uri;
  });
}
