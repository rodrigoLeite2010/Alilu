import { describe, expect, it } from "vitest";
import {
  calculateMarkup,
  isMarkupInputValid,
  validateMarkupInput,
  type MarkupInput,
} from "@/lib/calculators/markup";

const base = (overrides: Partial<MarkupInput> = {}): MarkupInput => ({
  cost: 100,
  variableExpenses: 0,
  fixedExpenses: 0,
  desiredMargin: 0,
  ...overrides,
});

describe("calculateMarkup", () => {
  it("custo 100, despesas 0%, margem 20% => preço 125 (caso conhecido/manual)", () => {
    // divisor = (100 - 20)/100 = 0.8; 100 / 0.8 = 125
    const result = calculateMarkup(base({ cost: 100, desiredMargin: 20 }));
    expect(result.headline).toBeCloseTo(125, 10);
    expect(result.divisor).toBeCloseTo(0.8, 10);
    expect(result.multiplier).toBeCloseTo(1.25, 10);
    expect(result.profitAmount).toBeCloseTo(25, 10);
  });

  it("custo 50, despesas variáveis 10%, fixas 5%, margem 15% => divisor 0,70 => preço ≈ 71,43", () => {
    const result = calculateMarkup(
      base({ cost: 50, variableExpenses: 10, fixedExpenses: 5, desiredMargin: 15 })
    );
    expect(result.divisor).toBeCloseTo(0.7, 10);
    expect(result.headline).toBeCloseTo(50 / 0.7, 10);
    expect(result.totalPercent).toBeCloseTo(30, 10);
  });

  it("todos os percentuais zero: preço de venda = custo", () => {
    const result = calculateMarkup(base({ cost: 200 }));
    expect(result.headline).toBeCloseTo(200, 10);
    expect(result.profitAmount).toBe(0);
  });

  it("soma de percentuais >= 100% é inválida (divisor zero ou negativo)", () => {
    const errors = validateMarkupInput(
      base({ cost: 100, variableExpenses: 50, fixedExpenses: 30, desiredMargin: 20 })
    );
    expect(errors.desiredMargin).toBeDefined();
  });

  it("custo zero ou negativo é inválido", () => {
    expect(validateMarkupInput(base({ cost: 0 })).cost).toBeDefined();
    expect(validateMarkupInput(base({ cost: -10 })).cost).toBeDefined();
  });

  it("percentuais negativos são inválidos", () => {
    expect(validateMarkupInput(base({ variableExpenses: -5 })).variableExpenses).toBeDefined();
    expect(validateMarkupInput(base({ fixedExpenses: -5 })).fixedExpenses).toBeDefined();
    expect(validateMarkupInput(base({ desiredMargin: -5 })).desiredMargin).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isMarkupInputValid(base({ desiredMargin: 20 }))).toBe(true);
  });
});
