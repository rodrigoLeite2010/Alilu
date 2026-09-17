import { describe, expect, it } from "vitest";
import {
  calculateProfitMargin,
  isProfitMarginInputValid,
  validateProfitMarginInput,
  type ProfitMarginInput,
} from "@/lib/calculators/profit-margin";

const base = (overrides: Partial<ProfitMarginInput> = {}): ProfitMarginInput => ({
  cost: 100,
  salePrice: 100,
  ...overrides,
});

describe("calculateProfitMargin", () => {
  it("custo 100, venda 125 => margem 20%, markup 25% (caso conhecido, inverso do markup.test.ts)", () => {
    const result = calculateProfitMargin(base({ cost: 100, salePrice: 125 }));
    expect(result.headline).toBeCloseTo(20, 10);
    expect(result.markupPercent).toBeCloseTo(25, 10);
    expect(result.profitAmount).toBeCloseTo(25, 10);
  });

  it("custo igual ao preço de venda: margem e lucro zero", () => {
    const result = calculateProfitMargin(base({ cost: 80, salePrice: 80 }));
    expect(result.headline).toBe(0);
    expect(result.profitAmount).toBe(0);
    expect(result.markupPercent).toBe(0);
  });

  it("preço de venda menor que o custo: margem e lucro negativos (prejuízo)", () => {
    const result = calculateProfitMargin(base({ cost: 100, salePrice: 80 }));
    expect(result.profitAmount).toBeCloseTo(-20, 10);
    expect(result.headline).toBeCloseTo(-25, 10);
    expect(result.markupPercent).toBeCloseTo(-20, 10);
  });

  it("decimais: custo 19,90, venda 29,90", () => {
    const result = calculateProfitMargin(base({ cost: 19.9, salePrice: 29.9 }));
    expect(result.profitAmount).toBeCloseTo(10, 10);
    expect(result.headline).toBeCloseTo((10 / 29.9) * 100, 10);
  });

  it("custo ou preço de venda zero/negativo é inválido", () => {
    expect(validateProfitMarginInput(base({ cost: 0 })).cost).toBeDefined();
    expect(validateProfitMarginInput(base({ salePrice: 0 })).salePrice).toBeDefined();
    expect(validateProfitMarginInput(base({ cost: -5 })).cost).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isProfitMarginInputValid(base({ cost: 50, salePrice: 70 }))).toBe(true);
  });
});
