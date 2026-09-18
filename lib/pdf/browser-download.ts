function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function createPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([copyBytesToArrayBuffer(bytes)], { type: "application/pdf" });
}

/** Cria uma URL temporária e a libera após o clique de download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  downloadBlob(createPdfBlob(bytes), fileName);
}
