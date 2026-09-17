import { describe, expect, it } from "vitest";
import {
  generateStateTaxId,
  generateStateTaxIdBatch,
  validateStateTaxIdGeneratorInput,
  isStateTaxIdGeneratorInputValid,
  STATE_TAX_ID_DIGIT_COUNT,
  STATE_TAX_ID_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/state-tax-id-generator";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";

describe("state-tax-id-generator", () => {
  it("gera um valor numérico com STATE_TAX_ID_DIGIT_COUNT dígitos", () => {
    for (let i = 0; i < 50; i += 1) {
      const result = generateStateTaxId("random");
      expect(result.value).toMatch(new RegExp(`^\\d{${STATE_TAX_ID_DIGIT_COUNT}}$`));
    }
  });

  it("usa a UF pedida quando informada explicitamente", () => {
    const result = generateStateTaxId("SP");
    expect(result.uf).toBe("SP");
  });

  it("sorteia uma UF válida quando uf === 'random'", () => {
    for (let i = 0; i < 30; i += 1) {
      const result = generateStateTaxId("random");
      expect(BRAZILIAN_STATES.map((s) => s.uf)).toContain(result.uf);
    }
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateStateTaxIdBatch({ count: 15, uf: "random" });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que STATE_TAX_ID_GENERATOR_MAX_BATCH", () => {
    const batch = generateStateTaxIdBatch({ count: 99999, uf: "random" });
    expect(batch).toHaveLength(STATE_TAX_ID_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateStateTaxIdGeneratorInput({ count: 0, uf: "random" }).count).toBeDefined();
    expect(isStateTaxIdGeneratorInputValid({ count: 1, uf: "random" })).toBe(true);
  });
});
