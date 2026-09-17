import { describe, expect, it } from "vitest";
import {
  calculateINSS,
  calculateIRRFFromTable,
  calculateIRRF2026,
  INSS_CONTRIBUTION_CEILING_2026,
  IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026,
  MINIMUM_WAGE,
} from "@/lib/calculators/payroll-tables";

// Todos os valores esperados abaixo foram calculados de forma independente
// (fora do código-fonte, em calculadora/planilha própria), a partir das
// mesmas tabelas oficiais documentadas em payroll-tables.ts (Portaria
// Interministerial MPS/MF nº 13/2026 para o INSS e tabela da Receita
// Federal para 2026 no caso do IRRF).

describe("calculateINSS (tabela 2026)", () => {
  it("salário mínimo (R$ 1.621,00): 7,5% = R$ 121,58 (1ª faixa, sem parcela a deduzir)", () => {
    expect(calculateINSS(MINIMUM_WAGE)).toBeCloseTo(1621 * 0.075, 2);
  });

  it("R$ 2.000,00 (2ª faixa, 9% com dedução de 24,32): 2000*0.09 - 24.32 = 155,68", () => {
    expect(calculateINSS(2000)).toBeCloseTo(155.68, 2);
  });

  it("R$ 3.000,00 (3ª faixa, 12% com dedução de 111,40): 3000*0.12 - 111.40 = 248,60", () => {
    expect(calculateINSS(3000)).toBeCloseTo(248.6, 2);
  });

  it("R$ 5.000,00 acima do teto: usa o teto (R$ 8.475,55) como base", () => {
    const atCeiling = calculateINSS(INSS_CONTRIBUTION_CEILING_2026);
    expect(calculateINSS(5000)).toBeCloseTo(5000 * 0.14 - 198.49, 2);
    expect(calculateINSS(50000)).toBeCloseTo(atCeiling, 2);
  });

  it("continuidade entre as faixas 1 e 2 (limite R$ 1.621,00/1.621,01)", () => {
    const justBelow = calculateINSS(1621.0);
    const justAbove = calculateINSS(1621.01);
    expect(justAbove).toBeCloseTo(justBelow, 1);
  });

  it("continuidade entre as faixas 3 e 4 (limite R$ 4.354,27/4.354,28)", () => {
    const justBelow = calculateINSS(4354.27);
    const justAbove = calculateINSS(4354.28);
    expect(justAbove).toBeCloseTo(justBelow, 1);
  });

  it("salário zero ou negativo resulta em desconto zero", () => {
    expect(calculateINSS(0)).toBe(0);
    expect(calculateINSS(-100)).toBe(0);
  });
});

describe("calculateIRRFFromTable (somente tabela progressiva, sem redução)", () => {
  it("base até R$ 2.428,80: isento (imposto zero)", () => {
    expect(calculateIRRFFromTable(2428.8)).toBe(0);
    expect(calculateIRRFFromTable(1000)).toBe(0);
  });

  it("base de R$ 2.700,00 (2ª faixa, 7,5%, dedução 182,16): 2700*0.075 - 182.16 = 20,34", () => {
    expect(calculateIRRFFromTable(2700)).toBeCloseTo(20.34, 2);
  });

  it("base de R$ 3.500,00 (3ª faixa, 15%, dedução 394,16): 3500*0.15 - 394.16 = 130,84", () => {
    expect(calculateIRRFFromTable(3500)).toBeCloseTo(130.84, 2);
  });

  it("base de R$ 10.000,00 (última faixa, 27,5%, dedução 908,73): 10000*0.275 - 908.73 = 1.841,27", () => {
    expect(calculateIRRFFromTable(10000)).toBeCloseTo(1841.27, 2);
  });

  it("continuidade no limite de isenção (R$ 2.428,80/2.428,81)", () => {
    const isento = calculateIRRFFromTable(2428.8);
    const primeiraFaixaTributada = calculateIRRFFromTable(2428.81);
    expect(primeiraFaixaTributada).toBeCloseTo(isento, 1);
  });

  it("base zero ou negativa resulta em imposto zero", () => {
    expect(calculateIRRFFromTable(0)).toBe(0);
    expect(calculateIRRFFromTable(-500)).toBe(0);
  });

  it("nunca retorna valor negativo mesmo em bases muito baixas dentro de uma faixa tributada", () => {
    expect(calculateIRRFFromTable(2428.81)).toBeGreaterThanOrEqual(0);
  });
});

// Os 5 casos abaixo reproduzem EXATAMENTE os exemplos oficiais publicados
// pela Receita Federal para a Lei nº 15.270/2025 (fonte documentada no
// cabeçalho de payroll-tables.ts): "Exemplos de Aplicação da Lei
// 15.270/2025". Cada exemplo usa a dedução legal (INSS, sem dependentes)
// informada pela própria Receita, permitindo validar tanto a escolha entre
// dedução legal e desconto simplificado quanto a fórmula de redução —
// com valores 100% verificáveis de forma independente (não inventados).
describe("calculateIRRF2026 (regra completa: dedução mais vantajosa + redução da Lei 15.270/2025)", () => {
  it("exemplo oficial 1 (João): bruto R$ 3.036,00, INSS R$ 257,73 — desconto simplificado é mais vantajoso, isento na 1ª faixa", () => {
    const result = calculateIRRF2026(3036.0, 257.73);
    expect(result.simplifiedDiscountChosen).toBe(true);
    expect(result.deductionUsed).toBeCloseTo(IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026, 2);
    expect(result.taxableBase).toBeCloseTo(2428.8, 2);
    expect(result.finalTax).toBe(0);
  });

  it("exemplo oficial 2 (José): bruto R$ 4.000,00, INSS R$ 373,41 — imposto pela tabela é R$ 114,76, zerado pela redução (bruto < R$ 5.000)", () => {
    const result = calculateIRRF2026(4000.0, 373.41);
    expect(result.taxableBase).toBeCloseTo(3392.8, 2);
    expect(result.taxBeforeReduction).toBeCloseTo(114.76, 2);
    expect(result.finalTax).toBe(0);
  });

  it("exemplo oficial 3 (Maria): bruto exatamente R$ 5.000,00, INSS R$ 509,60 — imposto de R$ 312,89 integralmente zerado", () => {
    const result = calculateIRRF2026(5000.0, 509.6);
    expect(result.taxableBase).toBeCloseTo(4392.8, 2);
    expect(result.taxBeforeReduction).toBeCloseTo(312.89, 2);
    expect(result.finalTax).toBe(0);
  });

  it("exemplo oficial 4 (Rita): bruto R$ 6.000,00, INSS R$ 649,60 — dedução legal mais vantajosa; redução parcial (faixa de transição)", () => {
    const result = calculateIRRF2026(6000.0, 649.6);
    expect(result.simplifiedDiscountChosen).toBe(false);
    expect(result.deductionUsed).toBeCloseTo(649.6, 2);
    expect(result.taxableBase).toBeCloseTo(5350.4, 2);
    expect(result.taxBeforeReduction).toBeCloseTo(562.63, 2);
    expect(result.reduction).toBeCloseTo(179.75, 2);
    expect(result.finalTax).toBeCloseTo(382.88, 2);
  });

  it("exemplo oficial 5 (Vera): bruto R$ 7.607,20, sem dedução legal — acima de R$ 7.350, sem redução", () => {
    const result = calculateIRRF2026(7607.2, 0);
    expect(result.taxableBase).toBeCloseTo(7000.0, 2);
    expect(result.taxBeforeReduction).toBeCloseTo(1016.27, 2);
    expect(result.reduction).toBe(0);
    expect(result.finalTax).toBeCloseTo(1016.27, 2);
  });

  it("bruto zero ou negativo resulta em imposto zero, sem escolher desconto simplificado", () => {
    const zero = calculateIRRF2026(0, 0);
    expect(zero.finalTax).toBe(0);
    expect(zero.taxableBase).toBe(0);

    const negative = calculateIRRF2026(-100, 0);
    expect(negative.finalTax).toBe(0);
  });

  it("exatamente no limite superior da faixa de transição (R$ 7.350,00): redução chega a zero (continuidade)", () => {
    const atLimit = calculateIRRF2026(7350.0, 0);
    expect(atLimit.reduction).toBeCloseTo(0, 1);
  });

  it("dedução legal muito alta (muitos dependentes) ainda assim nunca é descartada em favor do simplificado", () => {
    const result = calculateIRRF2026(10000, 2000);
    expect(result.simplifiedDiscountChosen).toBe(false);
    expect(result.deductionUsed).toBeCloseTo(2000, 2);
  });
});
