import { describe, expect, it } from "vitest";
import {
  calculateLuhnCheckDigit,
  isValidLuhn,
  generateSyntheticCardNumber,
  formatCardNumber,
  generateCard,
  generateCardBatch,
  validateCreditCardGeneratorInput,
  isCreditCardGeneratorInputValid,
  OFFICIAL_TEST_CARDS,
  CREDIT_CARD_GENERATOR_MAX_BATCH,
  type CardBrand,
  type GeneratedCard,
} from "@/lib/calculators/credit-card-generator";

const BRANDS: CardBrand[] = ["visa", "mastercard", "amex", "discover"];

describe("algoritmo de Luhn", () => {
  it("calcula o dígito verificador corretamente para um número conhecido", () => {
    // 4242424242424242 é Luhn-válido; os 15 primeiros dígitos são
    // "424242424242424" e o dígito verificador correto é 2.
    const partial = "424242424242424".split("").map(Number);
    expect(calculateLuhnCheckDigit(partial)).toBe(2);
  });

  it("valida números conhecidos como Luhn-válidos", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true);
    expect(isValidLuhn("5555555555554444")).toBe(true);
    expect(isValidLuhn("378282246310005")).toBe(true);
  });

  it("rejeita números inválidos pelo algoritmo de Luhn", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false);
    expect(isValidLuhn("")).toBe(false);
    expect(isValidLuhn("abc")).toBe(false);
  });
});

describe("generateSyntheticCardNumber", () => {
  it("gera, para cada bandeira, um número Luhn-válido com o comprimento e prefixo corretos", () => {
    for (const brand of BRANDS) {
      for (let i = 0; i < 50; i += 1) {
        const number = generateSyntheticCardNumber(brand);
        expect(isValidLuhn(number)).toBe(true);

        if (brand === "visa") {
          expect(number).toHaveLength(16);
          expect(number.startsWith("4")).toBe(true);
        } else if (brand === "mastercard") {
          expect(number).toHaveLength(16);
          expect(/^5[1-5]/.test(number)).toBe(true);
        } else if (brand === "amex") {
          expect(number).toHaveLength(15);
          expect(/^3[47]/.test(number)).toBe(true);
        } else if (brand === "discover") {
          expect(number).toHaveLength(16);
          expect(number.startsWith("6011")).toBe(true);
        }
      }
    }
  });
});

describe("formatCardNumber", () => {
  it("agrupa em blocos de 4 para bandeiras não-Amex", () => {
    expect(formatCardNumber("4242424242424242", "visa")).toBe("4242 4242 4242 4242");
  });

  it("agrupa em 4-6-5 para Amex", () => {
    expect(formatCardNumber("378282246310005", "amex")).toBe("3782 822463 10005");
  });
});

describe("generateCard — modo oficial", () => {
  it("retorna sempre um dos números de teste documentados, nunca inventados", () => {
    for (let i = 0; i < 50; i += 1) {
      const card = generateCard("official", "any", false);
      const known = OFFICIAL_TEST_CARDS.some((c) => c.number === card.number);
      expect(known).toBe(true);
      expect(card.source).toBeDefined();
    }
  });

  it("respeita o filtro de bandeira", () => {
    const card = generateCard("official", "amex", false);
    expect(card.brand).toBe("amex");
  });
});

describe("generateCard — modo sintético", () => {
  it("nunca inclui validade ou CVV no resultado (apenas número e bandeira)", () => {
    const card: GeneratedCard = generateCard("synthetic", "visa", false);
    const keys = Object.keys(card);
    expect(keys).not.toContain("cvv");
    expect(keys).not.toContain("expiry");
    expect(keys).not.toContain("expirationDate");
    expect(isValidLuhn(card.number)).toBe(true);
  });
});

describe("validação da quantidade em lote", () => {
  it("quantidade decimal, negativa, zero ou não numérica é inválida", () => {
    expect(validateCreditCardGeneratorInput({ mode: "synthetic", brand: "any", count: 0, formatted: true }).count).toBeDefined();
    expect(validateCreditCardGeneratorInput({ mode: "synthetic", brand: "any", count: -1, formatted: true }).count).toBeDefined();
    expect(validateCreditCardGeneratorInput({ mode: "synthetic", brand: "any", count: 2.5, formatted: true }).count).toBeDefined();
  });

  it("quantidade acima do limite máximo é inválida", () => {
    expect(
      validateCreditCardGeneratorInput({
        mode: "synthetic",
        brand: "any",
        count: CREDIT_CARD_GENERATOR_MAX_BATCH + 1,
        formatted: true,
      }).count
    ).toBeDefined();
  });

  it("quantidade dentro do limite é válida", () => {
    expect(isCreditCardGeneratorInputValid({ mode: "synthetic", brand: "any", count: 1, formatted: true })).toBe(true);
    expect(
      isCreditCardGeneratorInputValid({
        mode: "official",
        brand: "any",
        count: CREDIT_CARD_GENERATOR_MAX_BATCH,
        formatted: true,
      })
    ).toBe(true);
  });
});

describe("generateCardBatch", () => {
  it("gera exatamente a quantidade pedida, todos Luhn-válidos", () => {
    const batch = generateCardBatch({ mode: "synthetic", brand: "any", count: 15, formatted: false });
    expect(batch).toHaveLength(15);
    for (const card of batch) {
      expect(isValidLuhn(card.number)).toBe(true);
    }
  });

  it("CASO OBRIGATÓRIO: quantidade excessiva é sempre limitada a CREDIT_CARD_GENERATOR_MAX_BATCH, sem travar", () => {
    const start = Date.now();
    const batch = generateCardBatch({ mode: "synthetic", brand: "any", count: 1_000_000, formatted: false });
    expect(batch.length).toBeLessThanOrEqual(CREDIT_CARD_GENERATOR_MAX_BATCH);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
