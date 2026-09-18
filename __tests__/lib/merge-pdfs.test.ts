import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  formatPdfFileSize,
  getPdfReadErrorType,
  inspectPdfFile,
  MAX_PDF_FILE_SIZE_BYTES,
  mergePdfFiles,
} from "@/lib/pdf/merge-pdfs";

async function createPdfFile(
  name: string,
  pageSizes: Array<[number, number]>
): Promise<File> {
  const document = await PDFDocument.create();
  for (const size of pageSizes) {
    document.addPage(size);
  }

  const bytes = await document.save();
  const fileBytes = new Uint8Array(bytes.byteLength);
  fileBytes.set(bytes);
  return new File([fileBytes.buffer], name, { type: "application/pdf" });
}

describe("mergePdfFiles", () => {
  it("une dois PDFs e preserva a quantidade de páginas", async () => {
    const first = await createPdfFile("primeiro.pdf", [[200, 300]]);
    const second = await createPdfFile("segundo.pdf", [[400, 500]]);

    const result = await mergePdfFiles([first, second]);
    const merged = await PDFDocument.load(result);

    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).getWidth()).toBe(200);
    expect(merged.getPage(1).getWidth()).toBe(400);
  });

  it("une três ou mais PDFs na ordem recebida", async () => {
    const first = await createPdfFile("primeiro.pdf", [[100, 100], [110, 110]]);
    const second = await createPdfFile("segundo.pdf", [[200, 200]]);
    const third = await createPdfFile("terceiro.pdf", [[300, 300]]);

    const result = await mergePdfFiles([third, first, second]);
    const merged = await PDFDocument.load(result);

    expect(merged.getPageCount()).toBe(4);
    expect(merged.getPages().map((page) => page.getWidth())).toEqual([300, 100, 110, 200]);
  });

  it("valida um PDF real e informa o seu número de páginas", async () => {
    const file = await createPdfFile("duas-paginas.pdf", [[200, 300], [200, 300]]);

    await expect(inspectPdfFile(file)).resolves.toEqual({ ok: true, pageCount: 2 });
  });

  it("rejeita arquivos que não são PDFs antes de tentar processá-los", async () => {
    const file = new File(["apenas texto"], "texto.txt", { type: "text/plain" });

    await expect(inspectPdfFile(file)).resolves.toEqual({ ok: false, error: "not-pdf" });
  });

  it("rejeita um PDF corrompido sem interromper a aplicação", async () => {
    const file = new File(["%PDF-1.7\nconteúdo incompleto"], "quebrado.pdf", {
      type: "application/pdf",
    });

    await expect(inspectPdfFile(file)).resolves.toEqual({ ok: false, error: "corrupted" });
  });

  it("classifica a falha de PDF protegido por senha", () => {
    expect(getPdfReadErrorType(new Error("Input document is encrypted"))).toBe(
      "password-protected"
    );
  });

  it("recusa arquivos grandes antes de acessar o conteúdo", async () => {
    const slice = vi.fn();
    const oversized = {
      name: "grande.pdf",
      size: MAX_PDF_FILE_SIZE_BYTES + 1,
      slice,
    } as unknown as File;

    await expect(inspectPdfFile(oversized)).resolves.toEqual({ ok: false, error: "too-large" });
    expect(slice).not.toHaveBeenCalled();
  });

  it("exige ao menos dois arquivos", async () => {
    const file = await createPdfFile("unico.pdf", [[100, 100]]);

    await expect(mergePdfFiles([file])).rejects.toMatchObject({
      type: "not-enough-files",
    });
  });

  it("formata tamanhos de arquivo para a lista", () => {
    expect(formatPdfFileSize(800)).toBe("800 B");
    expect(formatPdfFileSize(1536)).toBe("1,5 KB");
    expect(formatPdfFileSize(2 * 1024 * 1024)).toBe("2 MB");
  });
});
