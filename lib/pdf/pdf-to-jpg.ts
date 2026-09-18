import { PdfMergeError, loadPdfDocument } from "@/lib/pdf/merge-pdfs";

export type PdfToJpgFile = {
  fileName: string;
  blob: Blob;
};

export const MAX_PDF_TO_JPG_PAGES = 50;
const MAX_RENDERED_PIXELS_PER_PAGE = 16_000_000;
const DEFAULT_RENDER_SCALE = 2;

function getFileBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "documento";
}

function getSafeQuality(quality: number): number {
  return Math.max(0.5, Math.min(0.95, quality));
}

function validatePages(pages: number[], pageCount: number): void {
  if (pages.length === 0) {
    throw new PdfMergeError("generation-failed", "Selecione ao menos uma página.");
  }
  if (pages.length > MAX_PDF_TO_JPG_PAGES) {
    throw new PdfMergeError(
      "generation-failed",
      `Selecione no máximo ${MAX_PDF_TO_JPG_PAGES} páginas por conversão para preservar o desempenho do navegador.`
    );
  }

  const seen = new Set<number>();
  for (const page of pages) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount || seen.has(page)) {
      throw new PdfMergeError("generation-failed", "A seleção contém uma página inválida.");
    }
    seen.add(page);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new PdfMergeError("generation-failed", "Não foi possível gerar a imagem JPG."));
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Renderiza páginas para JPG no dispositivo. Não baixa uma URL, nem tenta
 * extrair imagens já existentes dentro do documento.
 */
export async function renderPdfToJpegs(
  file: File,
  pages: number[],
  quality: number
): Promise<PdfToJpgFile[]> {
  const validatedDocument = await loadPdfDocument(file);
  validatePages(pages, validatedDocument.getPageCount());

  let loadedDocument: { cleanup: () => void } | null = null;
  let loadingTask: { destroy: () => Promise<void> } | null = null;

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // O worker também é empacotado pelo Next, portanto nunca carrega arquivos
    // de CDN ou de servidor externo.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const task = pdfjs.getDocument({
      data: sourceBytes,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      useWorkerFetch: false,
    });
    loadingTask = task;
    const pdfDocument = await task.promise;
    loadedDocument = pdfDocument;
    const output: PdfToJpgFile[] = [];
    const baseName = getFileBaseName(file.name);

    for (const pageNumber of pages) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableScale = Math.sqrt(
        MAX_RENDERED_PIXELS_PER_PAGE / (baseViewport.width * baseViewport.height)
      );
      const scale = Math.min(DEFAULT_RENDER_SCALE, availableScale);
      if (!Number.isFinite(scale) || scale <= 0) {
        throw new PdfMergeError("generation-failed", "O tamanho de uma página deste PDF não é compatível.");
      }
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      if (!canvas.getContext("2d", { alpha: false })) {
        throw new PdfMergeError("generation-failed", "Seu navegador não conseguiu preparar a imagem.");
      }

      await page.render({
        canvas,
        viewport,
        background: "rgb(255, 255, 255)",
      }).promise;
      const blob = await canvasToJpegBlob(canvas, getSafeQuality(quality));
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      output.push({
        fileName: `${baseName}-pagina-${pageNumber}.jpg`,
        blob,
      });
    }

    return output;
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed", "Não foi possível converter este PDF em imagens JPG.");
  } finally {
    if (loadedDocument) {
      loadedDocument.cleanup();
    }
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch {
        // A tarefa pode já ter sido encerrada pelo PDF.js após uma falha.
      }
    }
  }
}
