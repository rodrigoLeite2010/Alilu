import { describe, expect, it } from "vitest";
import {
  calculateThirteenthSalary,
  isThirteenthSalaryInputValid,
  validateThirteenthSalaryInput,
  type ThirteenthSalaryInput,
} from "@/lib/calculators/thirteenth-salary";

const base = (overrides: Partial<ThirteenthSalaryInput> = {}): ThirteenthSalaryInput => ({
  grossSalary: 3000,
  monthsWorked: 12,
  dependents: 0,
  ...overrides,
});

// Valores esperados recalculados de forma independente (fora do código-fonte,
// em script Node separado) após a correção do IRRF para a regra completa de
// 2026 (calculateIRRF2026 — dedução mais vantajosa entre INSS+dependentes e
// o desconto simplificado de R$ 607,20, seguida da redução da Lei nº
// 15.270/2025), aplicada de forma isolada sobre o valor bruto total do 13º.
describe("calculateThirteenthSalary", () => {
  it("12 meses trabalhados, bruto 3.000: ano completo — desconto simplificado zera a base e o IRRF pela redução de 2026", () => {
    const result = calculateThirteenthSalary(base());
    expect(result.grossTotal).toBeCloseTo(3000, 6);
    expect(result.firstInstallment).toBeCloseTo(1500, 6);
    expect(result.inss).toBeCloseTo(248.6, 2);
    expect(result.simplifiedDiscountChosen).toBe(true);
    expect(result.irrfBase).toBeCloseTo(2392.8, 2);
    expect(result.irrf).toBe(0);
    expect(result.headline).toBeCloseTo(2751.4, 1);
  });

  it("6 meses trabalhados: metade do valor e faixa de IRRF menor (isento)", () => {
    const result = calculateThirteenthSalary(base({ monthsWorked: 6 }));
    expect(result.grossTotal).toBeCloseTo(1500, 6);
    expect(result.firstInstallment).toBeCloseTo(750, 6);
    expect(result.inss).toBeCloseTo(112.5, 2);
    expect(result.irrf).toBe(0);
    expect(result.headline).toBeCloseTo(1387.5, 1);
  });

  it("bruto alto (9.000, acima do teto de redução) com 1 dependente: IRRF de fato devido, sem redução", () => {
    const result = calculateThirteenthSalary(base({ grossSalary: 9000, dependents: 1 }));
    expect(result.grossTotal).toBeCloseTo(9000, 6);
    expect(result.inss).toBeCloseTo(988.09, 1);
    expect(result.simplifiedDiscountChosen).toBe(false);
    expect(result.irrfReduction).toBe(0);
    expect(result.irrf).toBeCloseTo(1242.41, 1);
    expect(result.headline).toBeCloseTo(6769.5, 0);
  });

  it("a soma da 1ª e 2ª parcela bruta é sempre igual ao total bruto", () => {
    const result = calculateThirteenthSalary(base({ monthsWorked: 9 }));
    expect(result.firstInstallment + result.secondInstallmentGross).toBeCloseTo(result.grossTotal, 8);
  });

  it("meses trabalhados fora de 1-12 é inválido", () => {
    expect(validateThirteenthSalaryInput(base({ monthsWorked: 0 })).monthsWorked).toBeDefined();
    expect(validateThirteenthSalaryInput(base({ monthsWorked: 13 })).monthsWorked).toBeDefined();
  });

  it("salário zero ou negativo é inválido", () => {
    expect(validateThirteenthSalaryInput(base({ grossSalary: 0 })).grossSalary).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isThirteenthSalaryInputValid(base())).toBe(true);
  });
});
