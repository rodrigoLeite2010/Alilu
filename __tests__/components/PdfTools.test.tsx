import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const pdfMocks = vi.hoisted(() => ({
  inspectPdfFile: vi.fn(),
  splitPdf: vi.fn(),
  rotatePdf: vi.fn(),
  isJpegFile: vi.fn(),
  createPdfFromJpegs: vi.fn(),
  renderPdfToJpegs: vi.fn(),
  addWatermark: vi.fn(),
}));

vi.mock("@/lib/pdf/merge-pdfs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/merge-pdfs")>(
    "@/lib/pdf/merge-pdfs"
  );
  return { ...actual, inspectPdfFile: pdfMocks.inspectPdfFile };
});

vi.mock("@/lib/pdf/split-pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/split-pdf")>(
    "@/lib/pdf/split-pdf"
  );
  return { ...actual, splitPdf: pdfMocks.splitPdf };
});

vi.mock("@/lib/pdf/rotate-pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/rotate-pdf")>(
    "@/lib/pdf/rotate-pdf"
  );
  return { ...actual, rotatePdf: pdfMocks.rotatePdf };
});

vi.mock("@/lib/pdf/jpg-to-pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/jpg-to-pdf")>(
    "@/lib/pdf/jpg-to-pdf"
  );
  return {
    ...actual,
    isJpegFile: pdfMocks.isJpegFile,
    createPdfFromJpegs: pdfMocks.createPdfFromJpegs,
  };
});

vi.mock("@/lib/pdf/pdf-to-jpg", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/pdf-to-jpg")>(
    "@/lib/pdf/pdf-to-jpg"
  );
  return { ...actual, renderPdfToJpegs: pdfMocks.renderPdfToJpegs };
});

vi.mock("@/lib/pdf/watermark-pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/watermark-pdf")>(
    "@/lib/pdf/watermark-pdf"
  );
  return { ...actual, addWatermark: pdfMocks.addWatermark };
});

import { JpgToPdfTool } from "@/components/tools/jpg-to-pdf/JpgToPdfTool";
import { RotatePdfTool } from "@/components/tools/pdf-rotate/RotatePdfTool";
import { SplitPdfTool } from "@/components/tools/pdf-split/SplitPdfTool";
import { PdfToJpgTool } from "@/components/tools/pdf-to-jpg/PdfToJpgTool";
import { WatermarkPdfTool } from "@/components/tools/pdf-watermark/WatermarkPdfTool";

function createPdfFile(name = "origem.pdf") {
  return new File(["%PDF-1.7"], name, { type: "application/pdf" });
}

function selectFile(testId: string, file: File) {
  fireEvent.change(screen.getByTestId(testId), { target: { files: [file] } });
}

beforeEach(() => {
  Object.values(pdfMocks).forEach((mock) => mock.mockReset());
  pdfMocks.inspectPdfFile.mockResolvedValue({ ok: true, pageCount: 2 });
  pdfMocks.splitPdf.mockResolvedValue({ mode: "single-document", bytes: new Uint8Array([1]) });
  pdfMocks.rotatePdf.mockResolvedValue(new Uint8Array([1]));
  pdfMocks.isJpegFile.mockResolvedValue(true);
  pdfMocks.createPdfFromJpegs.mockResolvedValue(new Uint8Array([1]));
  pdfMocks.renderPdfToJpegs.mockResolvedValue([
    { fileName: "origem-pagina-1.jpg", blob: new Blob(["jpg"], { type: "image/jpeg" }) },
  ]);
  pdfMocks.addWatermark.mockResolvedValue(new Uint8Array([1]));
});

describe("ferramentas PDF ativas", () => {
  it("envia a seleção de páginas para a divisão de PDF", async () => {
    const file = createPdfFile();
    render(<SplitPdfTool />);
    selectFile("pdf-split-input", file);

    await screen.findByText(file.name);
    fireEvent.click(screen.getByRole("button", { name: "Dividir PDF" }));

    await waitFor(() => {
      expect(pdfMocks.splitPdf).toHaveBeenCalledWith(file, [1, 2], "single-document");
    });
    expect(await screen.findByText("PDF dividido com sucesso!")).toBeInTheDocument();
  });

  it("envia o ângulo e todas as páginas para a rotação", async () => {
    const file = createPdfFile();
    render(<RotatePdfTool />);
    selectFile("pdf-rotate-input", file);

    await screen.findByText(file.name);
    fireEvent.click(screen.getByRole("button", { name: "Girar PDF" }));

    await waitFor(() => {
      expect(pdfMocks.rotatePdf).toHaveBeenCalledWith(file, [1, 2], 90);
    });
    expect(await screen.findByText("PDF girado com sucesso!")).toBeInTheDocument();
  });

  it("mantém a imagem selecionada e as opções padrão ao criar um PDF", async () => {
    const image = new File(["jpg"], "foto.jpg", { type: "image/jpeg" });
    render(<JpgToPdfTool />);
    selectFile("jpg-to-pdf-input", image);

    await screen.findByText(image.name);
    fireEvent.click(screen.getByRole("button", { name: "Criar PDF" }));

    await waitFor(() => {
      expect(pdfMocks.createPdfFromJpegs).toHaveBeenCalledWith([image], {
        pageSize: "a4",
        orientation: "portrait",
        marginMm: 10,
      });
    });
    expect(await screen.findByText("PDF criado com sucesso!")).toBeInTheDocument();
  });

  it("gera uma imagem para a página selecionada do PDF", async () => {
    const file = createPdfFile();
    render(<PdfToJpgTool />);
    selectFile("pdf-to-jpg-input", file);

    await screen.findByText(file.name);
    fireEvent.click(screen.getByRole("button", { name: "Converter para JPG" }));

    await waitFor(() => {
      expect(pdfMocks.renderPdfToJpegs).toHaveBeenCalledWith(file, [1, 2], 0.9);
    });
    expect(await screen.findByText("Imagens JPG criadas com sucesso!")).toBeInTheDocument();
  });

  it("aplica a marca de texto às páginas selecionadas", async () => {
    const file = createPdfFile();
    render(<WatermarkPdfTool />);
    selectFile("pdf-watermark-input", file);

    await screen.findByText(file.name);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marca d'água" }));

    await waitFor(() => {
      expect(pdfMocks.addWatermark).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          type: "text",
          text: "CONFIDENCIAL",
          pages: [1, 2],
          position: "center",
          opacity: 0.35,
        })
      );
    });
    expect(await screen.findByText("Marca d'água adicionada com sucesso!")).toBeInTheDocument();
  });
});
