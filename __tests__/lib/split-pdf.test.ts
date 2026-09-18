import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { splitPdf } from "@/lib/pdf/split-pdf";

async function createPdfFile(name: string): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([100, 200]);
  document.addPage([300, 400]);
  document.addPage([500, 600]);
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: "application/pdf" });
}

describe("splitPdf", () => {
  it("cria um documento único com as páginas na ordem escolhida", async () => {
    const result = await splitPdf(await createPdfFile("origem.pdf"), [3, 1], "single-document");

    expect(result.mode).toBe("single-document");
    if (result.mode !== "single-document") return;

    const document = await PDFDocument.load(result.bytes);
    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getWidth()).toBe(500);
    expect(document.getPage(1).getHeight()).toBe(200);
  });

  it("cria um PDF por página mantendo o número no nome", async () => {
    const result = await splitPdf(await createPdfFile("origem.PDF"), [2, 3], "separate-files");

    expect(result.mode).toBe("separate-files");
    if (result.mode !== "separate-files") return;

    expect(result.files.map((file) => file.fileName)).toEqual([
      "origem-pagina-2.pdf",
      "origem-pagina-3.pdf",
    ]);
    const secondPage = await PDFDocument.load(result.files[0].bytes);
    expect(secondPage.getPageCount()).toBe(1);
    expect(secondPage.getPage(0).getWidth()).toBe(300);
  });

  it("recusa páginas duplicadas e fora do documento mesmo fora da interface", async () => {
    const file = await createPdfFile("origem.pdf");

    await expect(splitPdf(file, [1, 1], "single-document")).rejects.toMatchObject({
      type: "generation-failed",
    });
    await expect(splitPdf(file, [4], "single-document")).rejects.toMatchObject({
      type: "generation-failed",
    });
  });
});
