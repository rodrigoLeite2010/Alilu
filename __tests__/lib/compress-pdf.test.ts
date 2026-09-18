import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({
  loadPdfDocument: vi.fn(),
  renderPdfToJpegs: vi.fn(),
}));

vi.mock("@/lib/pdf/merge-pdfs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/merge-pdfs")>("@/lib/pdf/merge-pdfs");
  return { ...actual, loadPdfDocument: mocks.loadPdfDocument };
});

vi.mock("@/lib/pdf/pdf-to-jpg", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/pdf-to-jpg")>("@/lib/pdf/pdf-to-jpg");
  return { ...actual, renderPdfToJpegs: mocks.renderPdfToJpegs };
});

import { compressPdf } from "@/lib/pdf/compress-pdf";

const TINY_JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IR//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

describe("compressPdf", () => {
  it("recria todas as páginas renderizadas no PDF comprimido", async () => {
    const file = new File(["%PDF-1.7"], "origem.pdf", { type: "application/pdf" });
    const jpg = new Blob([Uint8Array.from(Buffer.from(TINY_JPEG, "base64"))], { type: "image/jpeg" });
    mocks.loadPdfDocument.mockResolvedValue({ getPageCount: () => 2 });
    mocks.renderPdfToJpegs.mockResolvedValue([
      { fileName: "pagina-1.jpg", blob: jpg, pageSize: [300, 400] },
      { fileName: "pagina-2.jpg", blob: jpg, pageSize: [300, 400] },
    ]);

    const result = await compressPdf(file, "balanced");

    expect(mocks.renderPdfToJpegs).toHaveBeenCalledWith(file, [1, 2], 0.76, { scale: 1.25 });
    expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  });
});
