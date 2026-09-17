import { describe, expect, it } from "vitest";
import {
  calculateCpfCheckDigits,
  formatGeneratedCpf,
  generateCpf,
  generateCpfBatch,
  validateCpfGeneratorInput,
  isCpfGeneratorInputValid,
  CPF_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/cpf-generator";
import { isValidCPF, onlyDigits } from "@/lib/validators/document";

describe("calculateCpfCheckDigits", () => {
  it("calcula os dígitos verificadores corretos para uma base conhecida", () => {
    // CPF real de exemplo, amplamente usado em documentação de validação:
    // 111.444.777-35 (base 111444777, DVs 3 e 5).
    const [d1, d2] = calculateCpfCheckDigits([1, 1, 1, 4, 4, 4, 7, 7, 7]);
    expect(d1).toBe(3);
    expect(d2).toBe(5);
  });

  it("rejeita uma base com tamanho diferente de 9", () => {
    expect(() => calculateCpfCheckDigits([1, 2, 3])).toThrow();
  });
});

describe("generateCpf", () => {
  it("gera um CPF sempre válido pelo algoritmo oficial (lib/validators/document.ts)", () => {
    for (let i = 0; i < 200; i += 1) {
      const cpf = generateCpf(false);
      expect(cpf).toHaveLength(11);
      expect(isValidCPF(cpf)).toBe(true);
    }
  });

  it("nunca gera uma sequência totalmente repetida (ex.: 11111111111)", () => {
    for (let i = 0; i < 500; i += 1) {
      const cpf = generateCpf(false);
      expect(/^(\d)\1{10}$/.test(cpf)).toBe(false);
    }
  });

  it("formatado retorna no padrão 000.000.000-00", () => {
    const cpf = generateCpf(true);
    expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(isValidCPF(onlyDigits(cpf))).toBe(true);
  });

  it("sem formatação retorna só os 11 dígitos", () => {
    const cpf = generateCpf(false);
    expect(cpf).toMatch(/^\d{11}$/);
  });

  it("formatGeneratedCpf aplica a máscara corretamente", () => {
    expect(formatGeneratedCpf("11144477735")).toBe("111.444.777-35");
  });
});

describe("validação da quantidade em lote", () => {
  it("quantidade decimal, negativa, zero ou não numérica é inválida", () => {
    expect(validateCpfGeneratorInput({ count: 0, formatted: true }).count).toBeDefined();
    expect(validateCpfGeneratorInput({ count: -1, formatted: true }).count).toBeDefined();
    expect(validateCpfGeneratorInput({ count: 2.5, formatted: true }).count).toBeDefined();
    expect(validateCpfGeneratorInput({ count: NaN, formatted: true }).count).toBeDefined();
  });

  it("quantidade acima do limite máximo é inválida", () => {
    expect(
      validateCpfGeneratorInput({ count: CPF_GENERATOR_MAX_BATCH + 1, formatted: true }).count
    ).toBeDefined();
  });

  it("quantidade dentro do limite (incluindo o limite exato) é válida", () => {
    expect(isCpfGeneratorInputValid({ count: 1, formatted: true })).toBe(true);
    expect(isCpfGeneratorInputValid({ count: CPF_GENERATOR_MAX_BATCH, formatted: true })).toBe(true);
  });
});

describe("generateCpfBatch", () => {
  it("gera exatamente a quantidade pedida, todos válidos e únicos o suficiente", () => {
    const batch = generateCpfBatch({ count: 20, formatted: false });
    expect(batch).toHaveLength(20);
    for (const cpf of batch) {
      expect(isValidCPF(cpf)).toBe(true);
    }
  });

  it("CASO OBRIGATÓRIO: quantidade excessiva é sempre limitada a CPF_GENERATOR_MAX_BATCH, sem travar", () => {
    const start = Date.now();
    const batch = generateCpfBatch({ count: 1_000_000, formatted: false });
    expect(batch.length).toBeLessThanOrEqual(CPF_GENERATOR_MAX_BATCH);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
