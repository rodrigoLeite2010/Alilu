import { describe, expect, it } from "vitest";
import {
  calculatePercentage,
  isPercentageInputValid,
  validatePercentageInput,
  type PercentageInput,
} from "@/lib/calculators/percentage";

const base = (overrides: Partial<PercentageInput> = {}): PercentageInput => ({
  mode: "percent-of",
  percent: 0,
  base: 0,
  part: 0,
  fromValue: 0,
  toValue: 0,
  ...overrides,
});

describe("percent-of: X% de Y", () => {
  it("10% de 200 = 20 (caso normal)", () => {
    const result = calculatePercentage(base({ mode: "percent-of", percent: 10, base: 200 }));
    expect(result.headline).toBeCloseTo(20, 10);
  });

  it("50% de 81,40 = 40,70 (decimais)", () => {
    const result = calculatePercentage(base({ mode: "percent-of", percent: 50, base: 81.4 }));
    expect(result.headline).toBeCloseTo(40.7, 10);
  });

  it("0% de qualquer valor = 0", () => {
    const result = calculatePercentage(base({ mode: "percent-of", percent: 0, base: 500 }));
    expect(result.headline).toBe(0);
  });

  it("X% de 0 = 0", () => {
    const result = calculatePercentage(base({ mode: "percent-of", percent: 25, base: 0 }));
    expect(result.headline).toBe(0);
  });

  it("percentual acima de 100% é permitido (150% de 40 = 60)", () => {
    const result = calculatePercentage(base({ mode: "percent-of", percent: 150, base: 40 }));
    expect(result.headline).toBeCloseTo(60, 10);
  });
});

describe("what-percent: X representa quantos % de Y", () => {
  it("50 é 25% de 200 (caso normal)", () => {
    const result = calculatePercentage(base({ mode: "what-percent", part: 50, base: 200 }));
    expect(result.headline).toBeCloseTo(25, 10);
  });

  it("parte igual à base = 100%", () => {
    const result = calculatePercentage(base({ mode: "what-percent", part: 80, base: 80 }));
    expect(result.headline).toBeCloseTo(100, 10);
  });

  it("parte maior que a base resulta em percentual > 100%", () => {
    const result = calculatePercentage(base({ mode: "what-percent", part: 300, base: 200 }));
    expect(result.headline).toBeCloseTo(150, 10);
  });

  it("base zero é inválida (divisão por zero)", () => {
    const errors = validatePercentageInput(base({ mode: "what-percent", part: 10, base: 0 }));
    expect(errors.base).toBeDefined();
  });
});

describe("increase: aumento percentual", () => {
  it("aumentar 200 em 10% = 220", () => {
    const result = calculatePercentage(base({ mode: "increase", percent: 10, base: 200 }));
    expect(result.headline).toBeCloseTo(220, 10);
    expect(result.difference).toBeCloseTo(20, 10);
  });

  it("aumentar em 0% mantém o valor", () => {
    const result = calculatePercentage(base({ mode: "increase", percent: 0, base: 150 }));
    expect(result.headline).toBeCloseTo(150, 10);
  });
});

describe("decrease: redução percentual", () => {
  it("reduzir 200 em 10% = 180", () => {
    const result = calculatePercentage(base({ mode: "decrease", percent: 10, base: 200 }));
    expect(result.headline).toBeCloseTo(180, 10);
    expect(result.difference).toBeCloseTo(-20, 10);
  });

  it("reduzir em 100% zera o valor", () => {
    const result = calculatePercentage(base({ mode: "decrease", percent: 100, base: 150 }));
    expect(result.headline).toBeCloseTo(0, 10);
  });
});

describe("variation: variação percentual entre dois valores", () => {
  it("de 100 para 150 = +50%", () => {
    const result = calculatePercentage(base({ mode: "variation", fromValue: 100, toValue: 150 }));
    expect(result.headline).toBeCloseTo(50, 10);
  });

  it("de 150 para 100 = -33,33...%", () => {
    const result = calculatePercentage(base({ mode: "variation", fromValue: 150, toValue: 100 }));
    expect(result.headline).toBeCloseTo(-33.333333, 5);
  });

  it("de -50 para 50 usa o módulo do valor inicial (variação de 200%)", () => {
    const result = calculatePercentage(base({ mode: "variation", fromValue: -50, toValue: 50 }));
    expect(result.headline).toBeCloseTo(200, 10);
  });

  it("valor inicial zero é inválido (divisão por zero)", () => {
    const errors = validatePercentageInput(base({ mode: "variation", fromValue: 0, toValue: 10 }));
    expect(errors.fromValue).toBeDefined();
  });
});

describe("validação de campos", () => {
  it("percent-of exige percent e base numéricos", () => {
    const errors = validatePercentageInput(
      base({ mode: "percent-of", percent: Number.NaN, base: Number.NaN })
    );
    expect(errors.percent).toBeDefined();
    expect(errors.base).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isPercentageInputValid(base({ mode: "percent-of", percent: 10, base: 100 }))).toBe(true);
  });

  it("percentuais e valores negativos são aceitos (ex.: desconto expresso como negativo)", () => {
    const errors = validatePercentageInput(base({ mode: "percent-of", percent: -10, base: 100 }));
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
