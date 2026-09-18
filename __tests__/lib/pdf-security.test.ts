import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { protectPdf, unlockPdf } from "@/lib/pdf/security-pdf";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

async function createPdfFile(name = "contrato.pdf"): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  const bytes = await document.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: "application/pdf" });
}

function createPdfFileFromBytes(bytes: Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: "application/pdf" });
}

describe("proteção e desbloqueio de PDF", () => {
  it("protege com AES-256 e desbloqueia com a senha autorizada", async () => {
    const source = await createPdfFile();
    const encrypted = await protectPdf(source, "senha-segura", {
      ownerPassword: "senha-proprietario",
      allowPrinting: true,
      allowCopying: false,
    });
    const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");

    await expect(isEncrypted(encrypted)).resolves.toMatchObject({
      encrypted: true,
      algorithm: "AES-256",
    });

    const unlocked = await unlockPdf(
      createPdfFileFromBytes(encrypted, "contrato-protegido.pdf"),
      "senha-segura"
    );
    expect((await PDFDocument.load(unlocked)).getPageCount()).toBe(1);
  });

  it("recusa senha de abertura curta", async () => {
    await expect(
      protectPdf(await createPdfFile(), "abc", {
        allowPrinting: true,
        allowCopying: false,
      })
    ).rejects.toMatchObject({ type: "generation-failed" });
  });

  it("não remove proteção com uma senha incorreta", async () => {
    const encrypted = await protectPdf(await createPdfFile(), "senha-correta", {
      allowPrinting: true,
      allowCopying: true,
    });

    await expect(
      unlockPdf(createPdfFileFromBytes(encrypted, "protegido.pdf"), "senha-errada")
    ).rejects.toMatchObject({ type: "generation-failed" });
  });
});
