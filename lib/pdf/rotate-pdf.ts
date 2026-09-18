import { PdfMergeError, loadPdfDocument } from "@/lib/pdf/merge-pdfs";

export type RotationAngle = 90 | 180 | 270;

export async function rotatePdf(
  file: File,
  pages: number[],
  rotation: RotationAngle
): Promise<Uint8Array> {
  const document = await loadPdfDocument(file);
  const pageCount = document.getPageCount();

  if (pages.length === 0) {
    throw new PdfMergeError("generation-failed", "Selecione pelo menos uma página.");
  }

  const { degrees } = await import("pdf-lib");
  const seen = new Set<number>();
  for (const pageNumber of pages) {
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pageCount ||
      seen.has(pageNumber)
    ) {
      throw new PdfMergeError("generation-failed", "A seleção contém uma página inválida.");
    }
    seen.add(pageNumber);

    const page = document.getPage(pageNumber - 1);
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + rotation) % 360));
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
