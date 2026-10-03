/** Tarayıcıda dosya seçtirir ve baytlarını döner. Vazgeçilirse null. */
export function pickBackupFile(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.style.display = 'none';
    let settled = false;
    const done = (v: Uint8Array | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return done(null);
      f.arrayBuffer().then((b) => done(new Uint8Array(b)), (e) => {
        settled = true;
        input.remove();
        reject(e);
      });
    });
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}
