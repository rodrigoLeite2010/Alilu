import { loadPdfDocument, PdfMergeError, readPdfFileBytes } from "@/lib/pdf/merge-pdfs";

export type PdfProtectionOptions = {
  ownerPassword?: string;
  allowPrinting: boolean;
  allowCopying: boolean;
};

function validatePassword(password: string): void {
  if (password.length < 4) {
    throw new PdfMergeError("generation-failed", "Use uma senha com pelo menos 4 caracteres.");
  }

  if (password.length > 127) {
    throw new PdfMergeError("generation-failed", "Use uma senha com no máximo 127 caracteres.");
  }
}

/** Aplica AES-256 a um PDF existente, sem reenviar o arquivo pela rede. */
export async function protectPdf(
  file: File,
  password: string,
  options: PdfProtectionOptions
): Promise<Uint8Array> {
  validatePassword(password);
  const ownerPassword = options.ownerPassword?.trim();
  if (ownerPassword) {
    validatePassword(ownerPassword);
  }
  await loadPdfDocument(file);

  if (!globalThis.crypto?.subtle) {
    throw new PdfMergeError(
      "generation-failed",
      "Seu navegador precisa oferecer Web Crypto para proteger este PDF com AES-256."
    );
  }

  const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
  try {
    return await encryptPDF(await readPdfFileBytes(file), password, {
      algorithm: "AES-256",
      ...(ownerPassword
        ? {
            ownerPassword,
            allowPrinting: options.allowPrinting,
            allowCopying: options.allowCopying,
            allowModifying: false,
            allowAnnotating: false,
            allowFillingForms: false,
            allowExtraction: true,
            allowAssembly: false,
            allowHighQualityPrint: options.allowPrinting,
          }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    throw new PdfMergeError(
      "generation-failed",
      message || "Não foi possível proteger este PDF com a senha informada."
    );
  }
}

/** Remove a senha fornecida pelo proprietário; não tenta adivinhar senhas. */
export async function unlockPdf(file: File, password: string): Promise<Uint8Array> {
  if (!password) {
    throw new PdfMergeError("generation-failed", "Informe a senha que autoriza o desbloqueio.");
  }

  const bytes = await readPdfFileBytes(file);
  const { decryptPDF, isEncrypted } = await import("@pdfsmaller/pdf-decrypt");

  try {
    const status = await isEncrypted(bytes);
    if (!status.encrypted) {
      throw new PdfMergeError("generation-failed", "Este PDF não possui uma senha compatível para remover.");
    }

    return await decryptPDF(bytes, password);
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("incorrect") || message.includes("password")) {
      throw new PdfMergeError("generation-failed", "A senha informada não desbloqueia este PDF.");
    }

    throw new PdfMergeError(
      "generation-failed",
      "Não foi possível desbloquear este PDF. Ele pode usar um tipo de criptografia ainda não suportado."
    );
  }
}
