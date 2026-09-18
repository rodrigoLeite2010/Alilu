import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  MAX_PDF_TO_JPG_PAGES,
  renderPdfToJpegs,
} from "@/lib/pdf/pdf-to-jpg";

async function createPdfFile(pageCount: number): Promise<File> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([100, 100]);
  }
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "origem.pdf", { type: "application/pdf" });
}

describe("renderPdfToJpegs", () => {
  it("recusa páginas inválidas antes de abrir o renderizador", async () => {
    await expect(renderPdfToJpegs(await createPdfFile(2), [3], 0.9)).rejects.toMatchObject({
      type: "generation-failed",
    });
  });

  it("limita a quantidade de páginas para proteger a memória do navegador", async () => {
    const source = await createPdfFile(MAX_PDF_TO_JPG_PAGES + 1);
    const pages = Array.from({ length: MAX_PDF_TO_JPG_PAGES + 1 }, (_, index) => index + 1);

    await expect(renderPdfToJpegs(source, pages, 0.9)).rejects.toMatchObject({
      type: "generation-failed",
    });
  });
});
