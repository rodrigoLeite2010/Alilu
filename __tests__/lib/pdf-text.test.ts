import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfTextPages } from "@/lib/pdf/pdf-text";

async function createTextPdf(): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([400, 400]);
  page.drawText("Produto", { x: 40, y: 340, size: 14, font });
  page.drawText("Quantidade", { x: 180, y: 340, size: 14, font });
  page.drawText("Café", { x: 40, y: 310, size: 14, font });
  page.drawText("10", { x: 180, y: 310, size: 14, font });
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "tabela.pdf", { type: "application/pdf" });
}

describe("extractPdfTextPages", () => {
  it("extrai linhas e células aproximadas de texto selecionável", async () => {
    const pages = await extractPdfTextPages(await createTextPdf());

    expect(pages).toHaveLength(1);
    expect(pages[0].rows.map((row) => row.cells)).toEqual([
      ["Produto", "Quantidade"],
      ["Café", "10"],
    ]);
  });
});
