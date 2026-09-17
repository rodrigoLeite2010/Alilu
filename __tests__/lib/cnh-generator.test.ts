import { describe, expect, it } from "vitest";
import {
  generateCnh,
  generateCnhBatch,
  isValidCnh,
  calculateCnhCheckDigits,
  validateCnhGeneratorInput,
  isCnhGeneratorInputValid,
  CNH_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/cnh-generator";

describe("cnh-generator", () => {
  it("gera uma CNH com 11 dígitos, sempre válida pelo algoritmo do gerador", () => {
    for (let i = 0; i < 300; i += 1) {
      const cnh = generateCnh(false);
      expect(cnh).toMatch(/^\d{11}$/);
      expect(isValidCnh(cnh)).toBe(true);
    }
  });

  it("aplica a máscara 000000000-00 quando formatted=true", () => {
    const cnh = generateCnh(true);
    expect(cnh).toMatch(/^\d{9}-\d{2}$/);
    expect(isValidCnh(cnh)).toBe(true);
  });

  it("calculateCnhCheckDigits rejeita base com tamanho errado", () => {
    expect(() => calculateCnhCheckDigits([1, 2, 3])).toThrow();
  });

  it("isValidCnh rejeita tamanho errado ou dígitos verificadores incorretos", () => {
    expect(isValidCnh("123")).toBe(false);

    const valid = generateCnh(false);
    const corruptedLastDigit = String((Number(valid[10]) + 1) % 10);
    const corrupted = valid.slice(0, 10) + corruptedLastDigit;
    expect(isValidCnh(corrupted)).toBe(false);
  });

  it("gera um lote com a quantidade pedida, todos válidos", () => {
    const batch = generateCnhBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const cnh of batch) {
      expect(isValidCnh(cnh)).toBe(true);
    }
  });

  it("nunca gera um lote maior que CNH_GENERATOR_MAX_BATCH", () => {
    const batch = generateCnhBatch({ count: 99999, formatted: false });
    expect(batch).toHaveLength(CNH_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateCnhGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(isCnhGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
  });
});
