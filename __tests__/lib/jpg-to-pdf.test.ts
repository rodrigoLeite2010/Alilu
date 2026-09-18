import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createPdfFromJpegs, isJpegFile } from "@/lib/pdf/jpg-to-pdf";

const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AKf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AKf/2gAMAwEAAgADAAAAEP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

function createJpegFile(name = "foto.jpg"): File {
  const bytes = Uint8Array.from(Buffer.from(TINY_JPEG, "base64"));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: "image/jpeg" });
}

describe("createPdfFromJpegs", () => {
  it("valida JPG pelo conteúdo, não apenas pela extensão", async () => {
    await expect(isJpegFile(createJpegFile("foto.txt"))).resolves.toBe(true);
    await expect(isJpegFile(new File(["texto"], "foto.jpg", { type: "image/jpeg" }))).resolves.toBe(false);
  });

  it("cria uma página A4 por imagem sem depender do nome do arquivo", async () => {
    const result = await createPdfFromJpegs([createJpegFile("uma.jpeg"), createJpegFile("duas.jpg")], {
      pageSize: "a4",
      orientation: "portrait",
      marginMm: 10,
    });
    const document = await PDFDocument.load(result);

    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(document.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });

  it("rejeita uma imagem inválida antes de gerar o documento", async () => {
    await expect(
      createPdfFromJpegs([new File(["não é jpg"], "falso.jpg", { type: "image/jpeg" })], {
        pageSize: "a4",
        orientation: "portrait",
        marginMm: 10,
      })
    ).rejects.toMatchObject({ type: "not-pdf" });
  });
});
