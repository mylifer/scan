/** Baytları tarayıcıda dosya olarak indirir. */
export function downloadFile(parts: BlobPart[], filename: string, type: string) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
