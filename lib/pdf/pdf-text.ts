import { PdfMergeError, loadPdfDocument, readPdfFileBytes } from "@/lib/pdf/merge-pdfs";

export type PdfTextRow = {
  cells: string[];
  text: string;
};

export type PdfTextPage = {
  number: number;
  rows: PdfTextRow[];
};

type TextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MAX_PDF_TEXT_PAGES = 50;

function compactText(value: string): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildRows(fragments: TextFragment[]): PdfTextRow[] {
  const groupedRows: Array<{ y: number; height: number; fragments: TextFragment[] }> = [];
  const sortedFragments = [...fragments].sort((left, right) => {
    const verticalDifference = right.y - left.y;
    return Math.abs(verticalDifference) > 0.5 ? verticalDifference : left.x - right.x;
  });

  for (const fragment of sortedFragments) {
    const row = groupedRows.find(
      (candidate) => Math.abs(candidate.y - fragment.y) <= Math.max(3, fragment.height * 0.35)
    );

    if (row) {
      row.fragments.push(fragment);
      row.height = Math.max(row.height, fragment.height);
    } else {
      groupedRows.push({ y: fragment.y, height: fragment.height, fragments: [fragment] });
    }
  }

  return groupedRows
    .sort((left, right) => right.y - left.y)
    .map((row) => {
      const cells: Array<{ text: string; right: number }> = [];

      for (const fragment of row.fragments.sort((left, right) => left.x - right.x)) {
        const previousCell = cells.at(-1);
        const gap = previousCell ? fragment.x - previousCell.right : Number.POSITIVE_INFINITY;
        const newCellThreshold = Math.max(16, row.height * 2.2);

        if (!previousCell || gap > newCellThreshold) {
          cells.push({ text: fragment.text, right: fragment.x + fragment.width });
          continue;
        }

        previousCell.text += gap > 1 ? ` ${fragment.text}` : fragment.text;
        previousCell.right = Math.max(previousCell.right, fragment.x + fragment.width);
      }

      const values = cells.map((cell) => compactText(cell.text)).filter(Boolean);
      return { cells: values, text: values.join("   ") };
    })
    .filter((row) => row.text.length > 0);
}

/**
 * Extrai texto selecionável e posições aproximadas de um PDF local. PDFs
 * digitalizados sem camada de texto não recebem OCR implícito: a função
 * informa a limitação em vez de produzir um documento vazio.
 */
export async function extractPdfTextPages(file: File): Promise<PdfTextPage[]> {
  const validatedDocument = await loadPdfDocument(file);
  const pageCount = validatedDocument.getPageCount();

  if (pageCount > MAX_PDF_TEXT_PAGES) {
    throw new PdfMergeError(
      "generation-failed",
      `Este conversor processa no máximo ${MAX_PDF_TEXT_PAGES} páginas por arquivo.`
    );
  }

  let loadedDocument: { cleanup: () => void } | null = null;
  let loadingTask: { destroy: () => Promise<void> } | null = null;

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const canUseWorker = typeof Worker !== "undefined";
    if (canUseWorker) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }

    const documentParameters = {
      data: await readPdfFileBytes(file),
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      useWorkerFetch: false,
      disableWorker: !canUseWorker,
    };
    const task = pdfjs.getDocument(documentParameters);
    loadingTask = task;
    const document = await task.promise;
    loadedDocument = document;
    const pages: PdfTextPage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const fragments = content.items.flatMap((item) => {
        const candidate = item as {
          str?: unknown;
          transform?: unknown;
          width?: unknown;
          height?: unknown;
        };

        if (
          typeof candidate.str !== "string" ||
          !Array.isArray(candidate.transform) ||
          candidate.transform.length < 6
        ) {
          return [];
        }

        const x = Number(candidate.transform[4]);
        const y = Number(candidate.transform[5]);
        const width = Number(candidate.width);
        const height = Math.abs(Number(candidate.height)) || Math.abs(Number(candidate.transform[3]));
        const text = compactText(candidate.str);

        if (!text || !Number.isFinite(x) || !Number.isFinite(y)) {
          return [];
        }

        return [{ text, x, y, width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 10 }];
      });

      pages.push({ number: pageNumber, rows: buildRows(fragments) });
      page.cleanup();
    }

    if (!pages.some((page) => page.rows.length > 0)) {
      throw new PdfMergeError(
        "generation-failed",
        "Este PDF não contém texto selecionável. Use PDF para JPG para arquivos digitalizados."
      );
    }

    return pages;
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed", "Não foi possível extrair o texto deste PDF.");
  } finally {
    if (loadedDocument) {
      loadedDocument.cleanup();
    }

    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch {
        // O PDF.js pode já ter finalizado a tarefa após uma falha.
      }
    }
  }
}
