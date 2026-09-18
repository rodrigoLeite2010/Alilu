import { MAX_PDF_FILE_SIZE_BYTES, PdfMergeError, loadPdfDocument } from "@/lib/pdf/merge-pdfs";

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-right";

export type WatermarkInput = {
  type: "text" | "image";
  text: string;
  image?: File | null;
  pages: number[];
  position: WatermarkPosition;
  opacity: number;
  rotation: number;
  fontSize: number;
  imageWidthPercent: number;
  color: string;
};

function parseColor(color: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return [0, 0, 0];
  }

  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function getPosition(
  pageWidth: number,
  pageHeight: number,
  itemWidth: number,
  itemHeight: number,
  position: WatermarkPosition
): { x: number; y: number } {
  const padding = 28;
  const right = pageWidth - itemWidth - padding;
  const top = pageHeight - itemHeight - padding;

  switch (position) {
    case "top-left":
      return { x: padding, y: top };
    case "top-right":
      return { x: right, y: top };
    case "bottom-left":
      return { x: padding, y: padding };
    case "bottom-right":
      return { x: right, y: padding };
    case "center":
    default:
      return { x: (pageWidth - itemWidth) / 2, y: (pageHeight - itemHeight) / 2 };
  }
}

export async function getWatermarkImageKind(file: File): Promise<"jpg" | "png" | null> {
  if (file.size === 0 || file.size > MAX_PDF_FILE_SIZE_BYTES) {
    return null;
  }

  try {
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return "jpg";
    }
    if (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      return "png";
    }
  } catch {
    return null;
  }

  return null;
}

export async function addWatermark(file: File, input: WatermarkInput): Promise<Uint8Array> {
  if (input.pages.length === 0) {
    throw new PdfMergeError("generation-failed", "Selecione ao menos uma página.");
  }

  if (input.type === "text" && !input.text.trim()) {
    throw new PdfMergeError("generation-failed", "Digite o texto da marca d'água.");
  }
  if (input.type === "text" && input.text.trim().length > 200) {
    throw new PdfMergeError("generation-failed", "A marca d'água de texto aceita até 200 caracteres.");
  }

  if (input.type === "image" && !input.image) {
    throw new PdfMergeError("generation-failed", "Selecione uma imagem para a marca d'água.");
  }

  const document = await loadPdfDocument(file);
  const pageCount = document.getPageCount();
  const { StandardFonts, degrees, rgb } = await import("pdf-lib");
  const opacity = Math.max(0.05, Math.min(1, input.opacity));

  let embeddedImage: Awaited<ReturnType<typeof document.embedJpg>> | null = null;
  if (input.type === "image" && input.image) {
    const kind = await getWatermarkImageKind(input.image);
    if (!kind) {
      throw new PdfMergeError("generation-failed", "A imagem da marca d'água deve ser JPG ou PNG válido.");
    }

    const imageBytes = await input.image.arrayBuffer();
    embeddedImage =
      kind === "jpg"
        ? await document.embedJpg(imageBytes)
        : await document.embedPng(imageBytes);
  }

  const font = input.type === "text" ? await document.embedFont(StandardFonts.Helvetica) : null;
  const [red, green, blue] = parseColor(input.color);

  const seenPages = new Set<number>();
  for (const pageNumber of input.pages) {
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pageCount ||
      seenPages.has(pageNumber)
    ) {
      throw new PdfMergeError("generation-failed", "A seleção contém uma página inválida.");
    }
    seenPages.add(pageNumber);

    const page = document.getPage(pageNumber - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (font) {
      const fontSize = Math.max(8, Math.min(144, input.fontSize));
      const text = input.text.trim();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);
      const { x, y } = getPosition(pageWidth, pageHeight, textWidth, textHeight, input.position);
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(red, green, blue),
        opacity,
        rotate: degrees(input.rotation),
      });
    } else if (embeddedImage) {
      const targetWidth = Math.max(24, (pageWidth * Math.max(5, Math.min(90, input.imageWidthPercent))) / 100);
      const scale = targetWidth / embeddedImage.width;
      const imageWidth = embeddedImage.width * scale;
      const imageHeight = embeddedImage.height * scale;
      const { x, y } = getPosition(pageWidth, pageHeight, imageWidth, imageHeight, input.position);
      page.drawImage(embeddedImage, {
        x,
        y,
        width: imageWidth,
        height: imageHeight,
        opacity,
        rotate: degrees(input.rotation),
      });
    }
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
