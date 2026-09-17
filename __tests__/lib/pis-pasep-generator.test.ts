import { describe, expect, it } from "vitest";
import {
  generatePisPasep,
  generatePisBatch,
  isValidPisPasep,
  calculatePisCheckDigit,
  validatePisGeneratorInput,
  isPisGeneratorInputValid,
  PIS_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/pis-pasep-generator";

describe("pis-pasep-generator", () => {
  it("gera um PIS/PASEP com 11 dígitos, sempre válido pelo algoritmo oficial", () => {
    for (let i = 0; i < 200; i += 1) {
      const pis = generatePisPasep(false);
      expect(pis).toMatch(/^\d{11}$/);
      expect(isValidPisPasep(pis)).toBe(true);
    }
  });

  it("aplica a máscara 000.00000.00-0 quando formatted=true", () => {
    const pis = generatePisPasep(true);
    expect(pis).toMatch(/^\d{3}\.\d{5}\.\d{2}-\d$/);
    expect(isValidPisPasep(pis)).toBe(true);
  });

  it("calculatePisCheckDigit rejeita base com tamanho errado", () => {
    expect(() => calculatePisCheckDigit([1, 2, 3])).toThrow();
  });

  it("isValidPisPasep rejeita tamanho errado ou dígito verificador incorreto", () => {
    expect(isValidPisPasep("123")).toBe(false);

    const valid = generatePisPasep(false);
    const corruptedLastDigit = String((Number(valid[10]) + 1) % 10);
    const corrupted = valid.slice(0, 10) + corruptedLastDigit;
    expect(isValidPisPasep(corrupted)).toBe(false);
  });

  it("gera um lote com a quantidade pedida, todos válidos", () => {
    const batch = generatePisBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const pis of batch) {
      expect(isValidPisPasep(pis)).toBe(true);
    }
  });

  it("nunca gera um lote maior que PIS_GENERATOR_MAX_BATCH", () => {
    const batch = generatePisBatch({ count: 99999, formatted: false });
    expect(batch).toHaveLength(PIS_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validatePisGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(
      validatePisGeneratorInput({ count: PIS_GENERATOR_MAX_BATCH + 1, formatted: true }).count
    ).toBeDefined();
    expect(isPisGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
  });
});
