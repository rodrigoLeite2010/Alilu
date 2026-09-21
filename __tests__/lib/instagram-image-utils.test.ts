import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  validateImageFile,
} from "@/lib/instagram/image-utils";

function buildFile(sizeBytes: number, type: string, name = "foto.png"): File {
  const content = new Uint8Array(Math.max(sizeBytes, 0));
  return new File([content], name, { type });
}

describe("validateImageFile", () => {
  it("aceita um JPG, PNG ou WEBP dentro do limite de tamanho", () => {
    for (const type of ACCEPTED_IMAGE_MIME_TYPES) {
      const file = buildFile(1024, type);
      expect(validateImageFile(file)).toEqual({ valid: true });
    }
  });

  it("rejeita um formato não suportado, com mensagem amigável", () => {
    const file = buildFile(1024, "application/pdf", "documento.pdf");
    const result = validateImageFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/jpg|png|webp/i);
  });

  it("rejeita um arquivo maior que o limite permitido", () => {
    const file = buildFile(MAX_IMAGE_FILE_SIZE_BYTES + 1, "image/png");
    const result = validateImageFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/grande/i);
  });

  it("rejeita um arquivo vazio", () => {
    const file = buildFile(0, "image/png");
    const result = validateImageFile(file);

    expect(result.valid).toBe(false);
  });

  it("aceita um arquivo exatamente no limite de tamanho", () => {
    const file = buildFile(MAX_IMAGE_FILE_SIZE_BYTES, "image/jpeg");
    expect(validateImageFile(file).valid).toBe(true);
  });
});
