/**
 * Utilitários de PDF executados exclusivamente no navegador. O `pdf-lib` é
 * carregado sob demanda, no momento da validação ou da união, para não pesar
 * a navegação inicial da ferramenta.
 */

export const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_PDF_SIZE_BYTES = 150 * 1024 * 1024;

export type PdfFileError =
  | "not-pdf"
  | "too-large"
  | "corrupted"
  | "password-protected"
  | "read-failed"
  | "no-pages";

export type PdfMergeErrorType = PdfFileError | "not-enough-files" | "generation-failed";

export type PdfFileValidation =
  | { ok: true; pageCount: number }
  | { ok: false; error: PdfFileError };

export class PdfMergeError extends Error {
  constructor(
    public readonly type: PdfMergeErrorType,
    message?: string
  ) {
    super(message ?? type);
    this.name = "PdfMergeError";
  }
}

export function formatPdfFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${formatSizeNumber(bytes / 1024)} KB`;
  }

  return `${formatSizeNumber(bytes / (1024 * 1024))} MB`;
}

function formatSizeNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function isPdfHeader(bytes: Uint8Array): boolean {
  // O cabeçalho %PDF- pode aparecer depois de poucos bytes extras em alguns
  // documentos gerados por softwares antigos, mas precisa estar no início.
  const headerLimit = Math.min(bytes.length - 4, 1024);
  for (let index = 0; index <= headerLimit; index += 1) {
    if (
      bytes[index] === 0x25 &&
      bytes[index + 1] === 0x50 &&
      bytes[index + 2] === 0x44 &&
      bytes[index + 3] === 0x46 &&
      bytes[index + 4] === 0x2d
    ) {
      return true;
    }
  }

  return false;
}

async function hasPdfHeader(file: File): Promise<boolean> {
  const header = await file.slice(0, 1024).arrayBuffer();
  return isPdfHeader(new Uint8Array(header));
}

export function getPdfReadErrorType(error: unknown): PdfFileError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("encrypt") || message.includes("password")) {
    return "password-protected";
  }

  return "corrupted";
}

async function loadPdfFile(file: File) {
  if (file.size === 0) {
    throw new PdfMergeError("not-pdf");
  }

  let hasHeader: boolean;
  try {
    hasHeader = await hasPdfHeader(file);
  } catch {
    throw new PdfMergeError("read-failed");
  }

  if (!hasHeader) {
    throw new PdfMergeError("not-pdf");
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new PdfMergeError("read-failed");
  }

  try {
    const { PDFDocument } = await import("pdf-lib");
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    // Alguns PDFs truncados só falham quando a biblioteca percorre a árvore
    // de páginas. Forçar essa leitura aqui mantém a mensagem de erro precisa.
    document.getPageCount();
    return document;
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError(getPdfReadErrorType(error));
  }
}

/** Valida um arquivo antes de incluí-lo na lista, sem enviá-lo a nenhum servidor. */
export async function inspectPdfFile(file: File): Promise<PdfFileValidation> {
  if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
    return { ok: false, error: "too-large" };
  }

  try {
    const document = await loadPdfFile(file);
    const pageCount = document.getPageCount();

    if (pageCount === 0) {
      return { ok: false, error: "no-pages" };
    }

    return { ok: true, pageCount };
  } catch (error) {
    if (error instanceof PdfMergeError) {
      return { ok: false, error: error.type as PdfFileError };
    }

    return { ok: false, error: "read-failed" };
  }
}

/**
 * Une os PDFs na mesma ordem em que foram selecionados/reordenados. A função
 * repete as verificações essenciais para permanecer segura mesmo fora da UI.
 */
export async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new PdfMergeError("not-enough-files");
  }

  if (files.some((file) => file.size > MAX_PDF_FILE_SIZE_BYTES)) {
    throw new PdfMergeError("too-large");
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > MAX_TOTAL_PDF_SIZE_BYTES) {
    throw new PdfMergeError("too-large");
  }

  try {
    const { PDFDocument } = await import("pdf-lib");
    const mergedDocument = await PDFDocument.create({ updateMetadata: false });

    for (const file of files) {
      const sourceDocument = await loadPdfFile(file);
      const sourcePages = await mergedDocument.copyPages(
        sourceDocument,
        sourceDocument.getPageIndices()
      );

      for (const page of sourcePages) {
        mergedDocument.addPage(page);
      }
    }

    return mergedDocument.save({ addDefaultPage: false, useObjectStreams: true });
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed");
  }
}
