import { describe, expect, it } from "vitest";
import {
  generateRg,
  generateRgBatch,
  calculateRgCheckDigit,
  validateRgGeneratorInput,
  isRgGeneratorInputValid,
  RG_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/rg-generator";

describe("rg-generator", () => {
  it("gera um RG com 8 dígitos-base + 1 dígito verificador (0-9 ou X)", () => {
    for (let i = 0; i < 200; i += 1) {
      const rg = generateRg(false);
      expect(rg).toMatch(/^\d{8}[0-9X]$/);
    }
  });

  it("aplica a máscara 00.000.000-D quando formatted=true", () => {
    const rg = generateRg(true);
    expect(rg).toMatch(/^\d{2}\.\d{3}\.\d{3}-[0-9X]$/);
  });

  it("calculateRgCheckDigit é consistente (mesma base gera sempre o mesmo dígito)", () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8];
    const dv1 = calculateRgCheckDigit(base);
    const dv2 = calculateRgCheckDigit(base);
    expect(dv1).toBe(dv2);
    expect(dv1).toMatch(/^[0-9X]$/);
  });

  it("calculateRgCheckDigit rejeita base com tamanho errado", () => {
    expect(() => calculateRgCheckDigit([1, 2, 3])).toThrow();
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateRgBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const rg of batch) {
      expect(rg).toMatch(/^\d{8}[0-9X]$/);
    }
  });

  it("nunca gera um lote maior que RG_GENERATOR_MAX_BATCH", () => {
    const batch = generateRgBatch({ count: 99999, formatted: false });
    expect(batch).toHaveLength(RG_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateRgGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(isRgGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
  });
});
