import { describe, expect, it } from "vitest";
import {
  generateCep,
  generateCepBatch,
  validateCepGeneratorInput,
  isCepGeneratorInputValid,
  CEP_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/cep-generator";

describe("cep-generator", () => {
  it("gera um CEP com 8 dígitos", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generateCep(false)).toMatch(/^\d{8}$/);
    }
  });

  it("aplica a máscara 00000-000 quando formatted=true", () => {
    expect(generateCep(true)).toMatch(/^\d{5}-\d{3}$/);
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateCepBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const cep of batch) {
      expect(cep).toMatch(/^\d{8}$/);
    }
  });

  it("nunca gera um lote maior que CEP_GENERATOR_MAX_BATCH", () => {
    const batch = generateCepBatch({ count: 99999, formatted: false });
    expect(batch).toHaveLength(CEP_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateCepGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(isCepGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
  });
});
