import { PdfMergeError } from "@/lib/pdf/merge-pdfs";

export type ZipFileEntry = {
  fileName: string;
  bytes: Uint8Array | Blob;
};

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** Empacota arquivos gerados localmente em um ZIP baixável. */
export async function createZip(entries: ZipFileEntry[]): Promise<Blob> {
  if (entries.length === 0) {
    throw new PdfMergeError("generation-failed", "Não há arquivos para compactar.");
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (const entry of entries) {
      zip.file(
        entry.fileName,
        entry.bytes instanceof Blob ? entry.bytes : copyBytesToArrayBuffer(entry.bytes)
      );
    }

    return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed", "Não foi possível criar o arquivo ZIP.");
  }
}
