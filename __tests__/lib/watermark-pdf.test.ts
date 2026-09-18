import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addWatermark, getWatermarkImageKind } from "@/lib/pdf/watermark-pdf";

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9OwAAAABJRU5ErkJggg==";

async function createPdfFile(): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  document.addPage([300, 400]);
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "contrato.pdf", { type: "application/pdf" });
}

function createPngFile(): File {
  const bytes = Uint8Array.from(Buffer.from(TINY_PNG, "base64"));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "marca.png", { type: "image/png" });
}

describe("addWatermark", () => {
  it("adiciona texto às páginas escolhidas e preserva o documento", async () => {
    const source = await createPdfFile();
    const result = await addWatermark(source, {
      type: "text",
      text: "CONFIDENCIAL",
      pages: [1],
      position: "center",
      opacity: 0.4,
      rotation: -35,
      fontSize: 42,
      imageWidthPercent: 30,
      color: "#0f172a",
    });
    const document = await PDFDocument.load(result);

    expect(document.getPageCount()).toBe(2);
    expect(result.byteLength).toBeGreaterThan(source.size);
  });

  it("aceita PNG verdadeiro para uma marca de imagem", async () => {
    const image = createPngFile();
    expect(await getWatermarkImageKind(image)).toBe("png");

    const result = await addWatermark(await createPdfFile(), {
      type: "image",
      text: "",
      image,
      pages: [1, 2],
      position: "bottom-right",
      opacity: 0.5,
      rotation: 0,
      fontSize: 42,
      imageWidthPercent: 30,
      color: "#000000",
    });

    expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  });

  it("recusa uma página repetida", async () => {
    await expect(
      addWatermark(await createPdfFile(), {
        type: "text",
        text: "teste",
        pages: [1, 1],
        position: "center",
        opacity: 0.5,
        rotation: 0,
        fontSize: 42,
        imageWidthPercent: 30,
        color: "#000000",
      })
    ).rejects.toMatchObject({ type: "generation-failed" });
  });
});
