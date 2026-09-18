import { describe, expect, it } from "vitest";
import { degrees, PDFDocument } from "pdf-lib";
import { rotatePdf } from "@/lib/pdf/rotate-pdf";

async function createPdfFile(): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([200, 300]);
  const second = document.addPage([400, 500]);
  second.setRotation(degrees(90));
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "orientacao.pdf", { type: "application/pdf" });
}

describe("rotatePdf", () => {
  it("altera somente as páginas solicitadas e soma a rotação atual", async () => {
    const result = await rotatePdf(await createPdfFile(), [2], 90);
    const document = await PDFDocument.load(result);

    expect(document.getPage(0).getRotation().angle).toBe(0);
    expect(document.getPage(1).getRotation().angle).toBe(180);
  });

  it("recusa selecionar uma página duas vezes", async () => {
    await expect(rotatePdf(await createPdfFile(), [1, 1], 90)).rejects.toMatchObject({
      type: "generation-failed",
    });
  });
});
