import { describe, expect, it } from "vitest";
import {
  generateVoterId,
  generateVoterIdBatch,
  isValidVoterId,
  calculateVoterIdCheckDigits,
  validateVoterIdGeneratorInput,
  isVoterIdGeneratorInputValid,
  VOTER_ID_STATES,
  VOTER_ID_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/voter-id-generator";

describe("voter-id-generator", () => {
  it("gera um Título de Eleitor com 12 dígitos, sempre válido pelo algoritmo do gerador", () => {
    for (let i = 0; i < 200; i += 1) {
      const voterId = generateVoterId("random", false);
      expect(voterId).toMatch(/^\d{12}$/);
      expect(isValidVoterId(voterId)).toBe(true);
    }
  });

  it("aplica a máscara '0000 0000 0000' quando formatted=true", () => {
    const voterId = generateVoterId("random", true);
    expect(voterId).toMatch(/^\d{4} \d{4} \d{4}$/);
    expect(isValidVoterId(voterId)).toBe(true);
  });

  it("gera sempre com o código de UF pedido", () => {
    for (const state of VOTER_ID_STATES.slice(0, 5)) {
      const voterId = generateVoterId(state.code, false);
      expect(voterId.slice(8, 10)).toBe(state.code);
      expect(isValidVoterId(voterId)).toBe(true);
    }
  });

  it("VOTER_ID_STATES tem 28 estados/zona exterior com códigos únicos 01-28", () => {
    expect(VOTER_ID_STATES).toHaveLength(28);
    const codes = VOTER_ID_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(28);
  });

  it("calculateVoterIdCheckDigits rejeita sequencial com tamanho errado", () => {
    expect(() => calculateVoterIdCheckDigits([1, 2, 3], [0, 1])).toThrow();
  });

  it("isValidVoterId rejeita tamanho errado ou dígitos verificadores incorretos", () => {
    expect(isValidVoterId("123")).toBe(false);
    expect(isValidVoterId("123456789000")).toBe(false);
  });

  it("gera um lote com a quantidade pedida, todos válidos", () => {
    const batch = generateVoterIdBatch({ count: 20, state: "random", formatted: false });
    expect(batch).toHaveLength(20);
    for (const voterId of batch) {
      expect(isValidVoterId(voterId)).toBe(true);
    }
  });

  it("nunca gera um lote maior que VOTER_ID_GENERATOR_MAX_BATCH", () => {
    const batch = generateVoterIdBatch({ count: 99999, state: "random", formatted: false });
    expect(batch).toHaveLength(VOTER_ID_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateVoterIdGeneratorInput({ count: 0, state: "random", formatted: true }).count
    ).toBeDefined();
    expect(isVoterIdGeneratorInputValid({ count: 1, state: "random", formatted: true })).toBe(
      true
    );
  });
});
