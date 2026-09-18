import { loadPdfDocument, PdfMergeError } from "@/lib/pdf/merge-pdfs";

export type VisualSignature = {
  page: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
} & (
  | { type: "typed"; text: string }
  | { type: "image"; dataUrl: string }
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: "jpg" | "png" } {
  const match = /^data:image\/(png|jpeg);base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    throw new PdfMergeError("generation-failed", "A assinatura em imagem deve ser PNG ou JPG válido.");
  }

  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { bytes, type: match[1].toLowerCase() === "png" ? "png" : "jpg" };
}

/**
 * Insere uma assinatura visual no PDF. Ela não é uma assinatura digital com
 * certificado ICP-Brasil ou outro certificado criptográfico.
 */
export async function addVisualSignature(file: File, signature: VisualSignature): Promise<Uint8Array> {
  const document = await loadPdfDocument(file);
  const page = document.getPages()[signature.page - 1];
  if (!page) {
    throw new PdfMergeError("generation-failed", "A página escolhida para a assinatura não existe.");
  }

  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = (clamp(signature.xPercent, 0, 100) / 100) * pageWidth;
  const yFromTop = (clamp(signature.yPercent, 0, 100) / 100) * pageHeight;
  const targetWidth = Math.max(40, (clamp(signature.widthPercent, 5, 90) / 100) * pageWidth);

  if (signature.type === "typed") {
    const text = signature.text.slice(0, 120).trim();
    if (!text) {
      throw new PdfMergeError("generation-failed", "Digite o nome que será usado como assinatura.");
    }

    const { StandardFonts, rgb } = await import("pdf-lib");
    const font = await document.embedFont(StandardFonts.HelveticaOblique);
    const fontSize = Math.max(16, Math.min(36, targetWidth / Math.max(2, text.length * 0.48)));
    page.drawText(text, {
      x,
      y: Math.max(8, pageHeight - yFromTop - fontSize),
      size: fontSize,
      font,
      color: rgb(0.06, 0.06, 0.08),
    });
  } else {
    const { bytes, type } = dataUrlToBytes(signature.dataUrl);
    const image = type === "png" ? await document.embedPng(bytes) : await document.embedJpg(bytes);
    const scale = targetWidth / image.width;
    const targetHeight = image.height * scale;
    page.drawImage(image, {
      x,
      y: Math.max(8, pageHeight - yFromTop - targetHeight),
      width: targetWidth,
      height: targetHeight,
    });
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
