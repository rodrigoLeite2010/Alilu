import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const pdfMocks = vi.hoisted(() => ({
  inspectPdfFile: vi.fn(),
  mergePdfFiles: vi.fn(),
}));

vi.mock("@/lib/pdf/merge-pdfs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf/merge-pdfs")>(
    "@/lib/pdf/merge-pdfs"
  );

  return {
    ...actual,
    inspectPdfFile: pdfMocks.inspectPdfFile,
    mergePdfFiles: pdfMocks.mergePdfFiles,
  };
});

import { MergePdfsTool } from "@/components/tools/pdf-merge/MergePdfsTool";

function createFile(name: string) {
  return new File(["%PDF-1.7\n"], name, { type: "application/pdf" });
}

function selectFiles(files: File[]) {
  const input = screen.getByTestId("pdf-merge-input");
  fireEvent.change(input, { target: { files } });
}

async function waitForFiles(...names: string[]) {
  for (const name of names) {
    await screen.findByText(name);
  }
}

describe("MergePdfsTool", () => {
  beforeEach(() => {
    pdfMocks.inspectPdfFile.mockReset();
    pdfMocks.mergePdfFiles.mockReset();
    pdfMocks.inspectPdfFile.mockResolvedValue({ ok: true, pageCount: 1 });
    pdfMocks.mergePdfFiles.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });

  it("mostra os arquivos, permite removê-los e exige ao menos dois", async () => {
    render(<MergePdfsTool />);
    selectFiles([createFile("primeiro.pdf"), createFile("segundo.pdf")]);

    await waitForFiles("primeiro.pdf", "segundo.pdf");
    expect(screen.getByRole("button", { name: "Unir PDFs" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Remover segundo.pdf" }));

    await waitFor(() => {
      expect(screen.queryByText("segundo.pdf")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Unir PDFs" })).toBeDisabled();
  });

  it("reordena arquivos pelos controles acessíveis para dispositivos móveis", async () => {
    render(<MergePdfsTool />);
    selectFiles([createFile("primeiro.pdf"), createFile("segundo.pdf")]);

    await waitForFiles("primeiro.pdf", "segundo.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Mover segundo.pdf para cima" }));

    const list = screen.getByRole("list", { name: "Ordem dos arquivos PDF" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("segundo.pdf"),
      expect.stringContaining("primeiro.pdf"),
    ]);
  });

  it("também reordena arquivos por arrastar e soltar", async () => {
    render(<MergePdfsTool />);
    selectFiles([createFile("primeiro.pdf"), createFile("segundo.pdf")]);

    await waitForFiles("primeiro.pdf", "segundo.pdf");
    const list = screen.getByRole("list", { name: "Ordem dos arquivos PDF" });
    const [firstItem, secondItem] = within(list).getAllByRole("listitem");
    const dataTransfer = { effectAllowed: "" } as unknown as DataTransfer;

    fireEvent.dragStart(firstItem, { dataTransfer });
    fireEvent.drop(secondItem, { dataTransfer });

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        expect.stringContaining("segundo.pdf"),
        expect.stringContaining("primeiro.pdf"),
      ]);
    });
  });

  it("informa quando um PDF está protegido por senha sem apagar os demais", async () => {
    pdfMocks.inspectPdfFile
      .mockResolvedValueOnce({ ok: true, pageCount: 2 })
      .mockResolvedValueOnce({ ok: false, error: "password-protected" });

    render(<MergePdfsTool />);
    selectFiles([createFile("aberto.pdf"), createFile("protegido.pdf")]);

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/protegido por senha/i);
    expect(screen.getByText("aberto.pdf")).toBeInTheDocument();
    expect(screen.queryByText("protegido.pdf")).not.toBeInTheDocument();
  });

  it("gera o download com URL temporária após a união", async () => {
    const createObjectUrl = vi.fn(() => "blob:alilu-pdf");
    const revokeObjectUrl = vi.fn();
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    try {
      render(<MergePdfsTool />);
      const first = createFile("primeiro.pdf");
      const second = createFile("segundo.pdf");
      selectFiles([first, second]);
      await waitForFiles("primeiro.pdf", "segundo.pdf");

      fireEvent.click(screen.getByRole("button", { name: "Unir PDFs" }));
      await screen.findByText("Seus PDFs foram unidos com sucesso!");
      fireEvent.click(screen.getByRole("button", { name: "Baixar PDF unido" }));

      expect(pdfMocks.mergePdfFiles).toHaveBeenCalledWith([first, second]);
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith("blob:alilu-pdf"));
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      click.mockRestore();
    }
  });
});
