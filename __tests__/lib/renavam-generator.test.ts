import { describe, expect, it } from "vitest";
import {
  generateRenavam,
  generateRenavamBatch,
  isValidRenavam,
  calculateRenavamCheckDigit,
  validateRenavamGeneratorInput,
  isRenavamGeneratorInputValid,
  RENAVAM_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/renavam-generator";

describe("renavam-generator", () => {
  it("gera um RENAVAM com 11 dígitos, sempre válido pelo algoritmo do gerador", () => {
    for (let i = 0; i < 200; i += 1) {
      const renavam = generateRenavam(false);
      expect(renavam).toMatch(/^\d{11}$/);
      expect(isValidRenavam(renavam)).toBe(true);
    }
  });

  it("aplica a máscara 0000000000-0 quando formatted=true", () => {
    const renavam = generateRenavam(true);
    expect(renavam).toMatch(/^\d{10}-\d$/);
    expect(isValidRenavam(renavam)).toBe(true);
  });

  it("calculateRenavamCheckDigit rejeita base com tamanho errado", () => {
    expect(() => calculateRenavamCheckDigit([1, 2, 3])).toThrow();
  });

  it("isValidRenavam rejeita tamanho errado ou dígito verificador incorreto", () => {
    expect(isValidRenavam("123")).toBe(false);

    const valid = generateRenavam(false);
    const corruptedLastDigit = String((Number(valid[10]) + 1) % 10);
    const corrupted = valid.slice(0, 10) + corruptedLastDigit;
    expect(isValidRenavam(corrupted)).toBe(false);
  });

  it("gera um lote com a quantidade pedida, todos válidos", () => {
    const batch = generateRenavamBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const renavam of batch) {
      expect(isValidRenavam(renavam)).toBe(true);
    }
  });

  it("nunca gera um lote maior que RENAVAM_GENERATOR_MAX_BATCH", () => {
    const batch = generateRenavamBatch({ count: 99999, formatted: false });
    expect(batch).toHaveLength(RENAVAM_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateRenavamGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(isRenavamGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
  });
});
