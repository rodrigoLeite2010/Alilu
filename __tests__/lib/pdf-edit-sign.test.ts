import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { applyPdfEdits } from "@/lib/pdf/edit-pdf";
import { addVisualSignature } from "@/lib/pdf/sign-pdf";

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9OwAAAABJRU5ErkJggg==";

async function createPdfFile(): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  document.addPage([300, 400]);
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "origem.pdf", { type: "application/pdf" });
}

describe("edição e assinatura visual", () => {
  it("adiciona texto e uma cobertura visual sem alterar a quantidade de páginas", async () => {
    const result = await applyPdfEdits(await createPdfFile(), [
      { type: "text", page: 1, xPercent: 10, yPercent: 10, text: "Revisado", fontSize: 16, color: "#18181b" },
      { type: "rectangle", page: 2, xPercent: 20, yPercent: 20, widthPercent: 30, heightPercent: 10, color: "#ffffff" },
    ]);

    expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  });

  it("não aceita gerar edição vazia", async () => {
    await expect(applyPdfEdits(await createPdfFile(), [])).rejects.toMatchObject({ type: "generation-failed" });
  });

  it("adiciona assinatura digitada", async () => {
    const result = await addVisualSignature(await createPdfFile(), {
      type: "typed",
      text: "Ana Silva",
      page: 1,
      xPercent: 50,
      yPercent: 80,
      widthPercent: 25,
    });

    expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  });

  it("aceita assinatura visual PNG", async () => {
    const result = await addVisualSignature(await createPdfFile(), {
      type: "image",
      dataUrl: `data:image/png;base64,${TINY_PNG}`,
      page: 2,
      xPercent: 50,
      yPercent: 80,
      widthPercent: 25,
    });

    expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  });
});
