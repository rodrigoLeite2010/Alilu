import { MAX_PDF_FILE_SIZE_BYTES, PdfMergeError } from "@/lib/pdf/merge-pdfs";

export type JpgPageSize = "a4" | "original";
export type JpgPageOrientation = "portrait" | "landscape";

export interface JpgToPdfOptions {
  pageSize: JpgPageSize;
  orientation: JpgPageOrientation;
  marginMm: number;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const POINTS_PER_MM = 72 / 25.4;

export async function isJpegFile(file: File): Promise<boolean> {
  if (file.size === 0 || file.size > MAX_PDF_FILE_SIZE_BYTES) {
    return false;
  }

  try {
    const header = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  } catch {
    return false;
  }
}

function getPageDimensions(
  imageWidth: number,
  imageHeight: number,
  options: JpgToPdfOptions
): [number, number] {
  if (options.pageSize === "original") {
    return [imageWidth, imageHeight];
  }

  return options.orientation === "landscape"
    ? [A4_HEIGHT, A4_WIDTH]
    : [A4_WIDTH, A4_HEIGHT];
}

/** Cria um PDF sem recortar as imagens e preserva a proporção original. */
export async function createPdfFromJpegs(
  files: File[],
  options: JpgToPdfOptions
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new PdfMergeError("not-enough-files", "Selecione ao menos uma imagem JPG.");
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > MAX_PDF_FILE_SIZE_BYTES * 3) {
    throw new PdfMergeError("too-large");
  }

  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.create({ updateMetadata: false });
  const margin = Math.max(0, Math.min(50, options.marginMm)) * POINTS_PER_MM;

  for (const file of files) {
    if (!(await isJpegFile(file))) {
      throw new PdfMergeError("not-pdf", `A imagem "${file.name}" não é um JPG válido.`);
    }

    const image = await document.embedJpg(await file.arrayBuffer());
    const [pageWidth, pageHeight] = getPageDimensions(image.width, image.height, options);
    const page = document.addPage([pageWidth, pageHeight]);
    const availableWidth = Math.max(1, pageWidth - margin * 2);
    const availableHeight = Math.max(1, pageHeight - margin * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
