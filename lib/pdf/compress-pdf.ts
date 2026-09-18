import { PdfMergeError, loadPdfDocument } from "@/lib/pdf/merge-pdfs";
import { MAX_PDF_TO_JPG_PAGES, renderPdfToJpegs } from "@/lib/pdf/pdf-to-jpg";

export type PdfCompressionLevel = "balanced" | "strong";

const COMPRESSION_SETTINGS: Record<PdfCompressionLevel, { quality: number; scale: number }> = {
  balanced: { quality: 0.76, scale: 1.25 },
  strong: { quality: 0.58, scale: 0.9 },
};

/**
 * Recria o PDF a partir de imagens JPG renderizadas localmente. Isso reduz o
 * tamanho de muitos arquivos digitalizados, mas converte texto pesquisável e
 * formulários em conteúdo visual; a interface informa essa limitação.
 */
export async function compressPdf(
  file: File,
  level: PdfCompressionLevel
): Promise<Uint8Array> {
  const source = await loadPdfDocument(file);
  const pageCount = source.getPageCount();

  if (pageCount > MAX_PDF_TO_JPG_PAGES) {
    throw new PdfMergeError(
      "generation-failed",
      `Este conversor compacta no máximo ${MAX_PDF_TO_JPG_PAGES} páginas por arquivo.`
    );
  }

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const settings = COMPRESSION_SETTINGS[level];
  const renderedPages = await renderPdfToJpegs(file, pages, settings.quality, {
    scale: settings.scale,
  });
  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.create({ updateMetadata: false });

  for (const renderedPage of renderedPages) {
    const image = await document.embedJpg(await renderedPage.blob.arrayBuffer());
    const [pageWidth, pageHeight] = renderedPage.pageSize;
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
