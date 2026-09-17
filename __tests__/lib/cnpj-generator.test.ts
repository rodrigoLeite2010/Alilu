import { describe, expect, it } from "vitest";
import {
  calculateCnpjCheckDigits,
  formatGeneratedCnpj,
  generateCnpj,
  generateCnpjBatch,
  validateCnpjGeneratorInput,
  isCnpjGeneratorInputValid,
  CNPJ_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/cnpj-generator";
import { isValidCNPJ, onlyDigits } from "@/lib/validators/document";

describe("calculateCnpjCheckDigits", () => {
  it("reproduz o exemplo oficial da Receita Federal/Serpro (12.ABC.345/01DE-35)", () => {
    // Exemplo do "Manual de Cálculo do DV do CNPJ Alfanumérico" (Receita
    // Federal) e do documento técnico da Serpro sobre o mesmo cálculo,
    // conferido manualmente antes da implementação (ETAPA 4).
    const [d1, d2] = calculateCnpjCheckDigits("12ABC34501DE");
    expect(d1).toBe(3);
    expect(d2).toBe(5);
  });

  it("é retrocompatível com o algoritmo tradicional do CNPJ numérico", () => {
    // 11.222.333/0001-81 é um CNPJ numérico de exemplo amplamente usado
    // para testes de validação (matematicamente válido).
    const [d1, d2] = calculateCnpjCheckDigits("112223330001");
    expect(`${d1}${d2}`).toBe("81");
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita uma base com tamanho diferente de 12 ou com caracteres inválidos", () => {
    expect(() => calculateCnpjCheckDigits("123")).toThrow();
    expect(() => calculateCnpjCheckDigits("12ab345601de")).toThrow(); // minúsculas
  });
});

describe("generateCnpj — formato numérico", () => {
  it("gera sempre um CNPJ numérico válido pelo algoritmo oficial (lib/validators/document.ts)", () => {
    for (let i = 0; i < 200; i += 1) {
      const cnpj = generateCnpj("numeric", false);
      expect(cnpj).toHaveLength(14);
      expect(/^\d{14}$/.test(cnpj)).toBe(true);
      expect(isValidCNPJ(cnpj)).toBe(true);
    }
  });

  it("formatado retorna no padrão 00.000.000/0000-00", () => {
    const cnpj = generateCnpj("numeric", true);
    expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    expect(isValidCNPJ(onlyDigits(cnpj))).toBe(true);
  });
});

describe("generateCnpj — formato alfanumérico", () => {
  it("gera 12 caracteres alfanuméricos (0-9, A-Z) + 2 dígitos verificadores numéricos", () => {
    for (let i = 0; i < 200; i += 1) {
      const cnpj = generateCnpj("alphanumeric", false);
      expect(cnpj).toHaveLength(14);
      expect(/^[0-9A-Z]{12}\d{2}$/.test(cnpj)).toBe(true);

      const [d1, d2] = calculateCnpjCheckDigits(cnpj.slice(0, 12));
      expect(cnpj.slice(12)).toBe(`${d1}${d2}`);
    }
  });

  it("formatado retorna no padrão AA.AAA.AAA/AAAA-00", () => {
    const cnpj = generateCnpj("alphanumeric", true);
    expect(cnpj).toMatch(/^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/);
  });
});

describe("formatGeneratedCnpj", () => {
  it("aplica a máscara corretamente", () => {
    expect(formatGeneratedCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatGeneratedCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("validação da quantidade em lote", () => {
  it("quantidade decimal, negativa, zero ou não numérica é inválida", () => {
    expect(validateCnpjGeneratorInput({ count: 0, format: "numeric", formatted: true }).count).toBeDefined();
    expect(validateCnpjGeneratorInput({ count: -1, format: "numeric", formatted: true }).count).toBeDefined();
    expect(validateCnpjGeneratorInput({ count: 2.5, format: "numeric", formatted: true }).count).toBeDefined();
    expect(validateCnpjGeneratorInput({ count: NaN, format: "numeric", formatted: true }).count).toBeDefined();
  });

  it("quantidade acima do limite máximo é inválida", () => {
    expect(
      validateCnpjGeneratorInput({ count: CNPJ_GENERATOR_MAX_BATCH + 1, format: "numeric", formatted: true }).count
    ).toBeDefined();
  });

  it("quantidade dentro do limite (incluindo o limite exato) é válida", () => {
    expect(isCnpjGeneratorInputValid({ count: 1, format: "numeric", formatted: true })).toBe(true);
    expect(
      isCnpjGeneratorInputValid({ count: CNPJ_GENERATOR_MAX_BATCH, format: "alphanumeric", formatted: true })
    ).toBe(true);
  });
});

describe("generateCnpjBatch", () => {
  it("gera exatamente a quantidade pedida, todos válidos", () => {
    const batch = generateCnpjBatch({ count: 20, format: "numeric", formatted: false });
    expect(batch).toHaveLength(20);
    for (const cnpj of batch) {
      expect(isValidCNPJ(cnpj)).toBe(true);
    }
  });

  it("CASO OBRIGATÓRIO: quantidade excessiva é sempre limitada a CNPJ_GENERATOR_MAX_BATCH, sem travar", () => {
    const start = Date.now();
    const batch = generateCnpjBatch({ count: 1_000_000, format: "alphanumeric", formatted: false });
    expect(batch.length).toBeLessThanOrEqual(CNPJ_GENERATOR_MAX_BATCH);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
