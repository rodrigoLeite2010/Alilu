import { loadPdfDocument, PdfMergeError } from "@/lib/pdf/merge-pdfs";

export type PdfEdit =
  | {
      type: "text";
      page: number;
      xPercent: number;
      yPercent: number;
      text: string;
      fontSize: number;
      color: string;
    }
  | {
      type: "rectangle";
      page: number;
      xPercent: number;
      yPercent: number;
      widthPercent: number;
      heightPercent: number;
      color: string;
    };

const MAX_EDITS = 30;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "18181b";
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function getPosition(value: number, dimension: number): number {
  return (clamp(value, 0, 100) / 100) * dimension;
}

/** Aplica anotações visuais reais sobre o conteúdo já existente do PDF. */
export async function applyPdfEdits(file: File, edits: PdfEdit[]): Promise<Uint8Array> {
  if (edits.length === 0) {
    throw new PdfMergeError("generation-failed", "Adicione ao menos uma alteração antes de gerar o PDF.");
  }

  if (edits.length > MAX_EDITS) {
    throw new PdfMergeError("generation-failed", `Use no máximo ${MAX_EDITS} alterações por arquivo.`);
  }

  const document = await loadPdfDocument(file);
  const { StandardFonts, rgb } = await import("pdf-lib");
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();

  for (const edit of edits) {
    const page = pages[edit.page - 1];
    if (!page) {
      throw new PdfMergeError("generation-failed", "Uma alteração aponta para uma página que não existe.");
    }

    const { width, height } = page.getSize();
    const [red, green, blue] = hexToRgb(edit.color);
    const color = rgb(red, green, blue);
    const x = getPosition(edit.xPercent, width);
    const yFromTop = getPosition(edit.yPercent, height);

    if (edit.type === "text") {
      const text = edit.text.replace(/\r/g, "").slice(0, 400).trim();
      if (!text) {
        throw new PdfMergeError("generation-failed", "O texto da alteração não pode ficar vazio.");
      }

      const fontSize = clamp(edit.fontSize, 6, 72);
      const maxWidth = Math.max(20, width - x - 12);
      let cursorY = height - yFromTop - fontSize;

      for (const paragraph of text.split("\n")) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            line = candidate;
            continue;
          }

          if (line) {
            page.drawText(line, { x, y: cursorY, size: fontSize, font, color });
            cursorY -= fontSize * 1.25;
          }
          line = word;
        }

        if (line) {
          page.drawText(line, { x, y: cursorY, size: fontSize, font, color });
          cursorY -= fontSize * 1.25;
        }
      }
      continue;
    }

    const rectangleWidth = getPosition(edit.widthPercent, width);
    const rectangleHeight = getPosition(edit.heightPercent, height);
    page.drawRectangle({
      x,
      y: Math.max(0, height - yFromTop - rectangleHeight),
      width: Math.max(4, Math.min(rectangleWidth, width - x)),
      height: Math.max(4, Math.min(rectangleHeight, height)),
      color,
    });
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
