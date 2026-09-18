import { PdfMergeError, loadPdfDocument } from "@/lib/pdf/merge-pdfs";

export type SplitPdfMode = "single-document" | "separate-files";

export type SplitPdfFile = {
  fileName: string;
  bytes: Uint8Array;
};

export type SplitPdfResult =
  | { mode: "single-document"; bytes: Uint8Array }
  | { mode: "separate-files"; files: SplitPdfFile[] };

function getFileBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "documento";
}

function assertValidPages(pages: number[], pageCount: number) {
  if (pages.length === 0) {
    throw new PdfMergeError("not-enough-files", "Selecione pelo menos uma página.");
  }

  const seen = new Set<number>();
  for (const page of pages) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount || seen.has(page)) {
      throw new PdfMergeError("generation-failed", "A seleção contém uma página inválida.");
    }
    seen.add(page);
  }
}

/** Extrai páginas em um PDF único ou cria um PDF separado para cada página. */
export async function splitPdf(
  file: File,
  pages: number[],
  mode: SplitPdfMode
): Promise<SplitPdfResult> {
  const sourceDocument = await loadPdfDocument(file);
  assertValidPages(pages, sourceDocument.getPageCount());
  const { PDFDocument } = await import("pdf-lib");

  if (mode === "single-document") {
    const outputDocument = await PDFDocument.create({ updateMetadata: false });
    const copiedPages = await outputDocument.copyPages(
      sourceDocument,
      pages.map((page) => page - 1)
    );
    copiedPages.forEach((page) => outputDocument.addPage(page));

    return {
      mode,
      bytes: await outputDocument.save({ addDefaultPage: false, useObjectStreams: true }),
    };
  }

  const baseName = getFileBaseName(file.name);
  const files: SplitPdfFile[] = [];

  for (const pageNumber of pages) {
    const outputDocument = await PDFDocument.create({ updateMetadata: false });
    const [copiedPage] = await outputDocument.copyPages(sourceDocument, [pageNumber - 1]);
    outputDocument.addPage(copiedPage);
    files.push({
      fileName: `${baseName}-pagina-${pageNumber}.pdf`,
      bytes: await outputDocument.save({ addDefaultPage: false, useObjectStreams: true }),
    });
  }

  return { mode, files };
}
