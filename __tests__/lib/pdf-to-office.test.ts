import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const mocks = vi.hoisted(() => ({
  extractPdfTextPages: vi.fn(),
  loadPdfDocument: vi.fn(),
  renderPdfToJpegs: vi.fn(),
}));

vi.mock("@/lib/pdf/pdf-text", () => ({ extractPdfTextPages: mocks.extractPdfTextPages }));

vi.mock("@/lib/pdf/merge-pdfs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/merge-pdfs")>("@/lib/pdf/merge-pdfs");
  return { ...actual, loadPdfDocument: mocks.loadPdfDocument };
});

vi.mock("@/lib/pdf/pdf-to-jpg", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/pdf-to-jpg")>("@/lib/pdf/pdf-to-jpg");
  return { ...actual, renderPdfToJpegs: mocks.renderPdfToJpegs };
});

import {
  convertPdfToExcel,
  convertPdfToPowerPoint,
  convertPdfToWord,
} from "@/lib/pdf/pdf-to-office";

const TINY_JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IR//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

function createPdfFile(): File {
  return new File(["%PDF-1.7"], "relatorio.pdf", { type: "application/pdf" });
}

describe("conversores de PDF para Office", () => {
  it("cria DOCX editável com o texto extraído", async () => {
    mocks.extractPdfTextPages.mockResolvedValueOnce([
      { number: 1, rows: [{ cells: ["Produto", "Quantidade"], text: "Produto Quantidade" }, { cells: ["Café", "10"], text: "Café 10" }] },
    ]);

    const word = await convertPdfToWord(createPdfFile());
    const zip = await JSZip.loadAsync(word);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain("Produto");
    expect(documentXml).toContain("Café");
  });

  it("cria XLSX com uma aba por página de PDF", async () => {
    mocks.extractPdfTextPages.mockResolvedValueOnce([
      { number: 1, rows: [{ cells: ["Produto", "Quantidade"], text: "Produto Quantidade" }] },
      { number: 2, rows: [{ cells: ["Café", "10"], text: "Café 10" }] },
    ]);

    const excel = await convertPdfToExcel(createPdfFile());
    const zip = await JSZip.loadAsync(excel);
    const firstSheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");

    expect(Object.keys(zip.files)).toContain("xl/worksheets/sheet2.xml");
    expect(firstSheet).toContain("Produto");
  });

  it("cria uma apresentação PPTX visual a partir das páginas renderizadas", async () => {
    mocks.loadPdfDocument.mockResolvedValueOnce({ getPageCount: () => 1 });
    mocks.renderPdfToJpegs.mockResolvedValueOnce([
      {
        fileName: "relatorio-pagina-1.jpg",
        blob: new Blob([Uint8Array.from(Buffer.from(TINY_JPEG, "base64"))], { type: "image/jpeg" }),
        pageSize: [612, 792],
      },
    ]);

    const presentation = await convertPdfToPowerPoint(createPdfFile());
    const zip = await JSZip.loadAsync(presentation);

    expect(Object.keys(zip.files).some((path) => path.startsWith("ppt/slides/slide"))).toBe(true);
  });
});
