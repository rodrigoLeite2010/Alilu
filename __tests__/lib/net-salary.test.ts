import { describe, expect, it } from "vitest";
import {
  calculateNetSalary,
  isNetSalaryInputValid,
  validateNetSalaryInput,
  type NetSalaryInput,
} from "@/lib/calculators/net-salary";

const base = (overrides: Partial<NetSalaryInput> = {}): NetSalaryInput => ({
  grossSalary: 3000,
  dependents: 0,
  otherDeductions: 0,
  ...overrides,
});

// Valores esperados recalculados de forma independente (fora do código-fonte)
// após a correção da REGRA ESPECIAL de 2026 (redução da Lei nº 15.270/2025 +
// escolha entre dedução legal e desconto simplificado mensal de R$ 607,20),
// a partir das mesmas tabelas e regra de payroll-tables.test.ts.
describe("calculateNetSalary", () => {
  it("bruto 3.000, 1 dependente, 100 de outros descontos: desconto simplificado (607,20) é mais vantajoso que INSS+dependente (438,19)", () => {
    const result = calculateNetSalary(base({ grossSalary: 3000, dependents: 1, otherDeductions: 100 }));
    expect(result.inss).toBeCloseTo(248.6, 2);
    expect(result.dependentsDeduction).toBeCloseTo(189.59, 2);
    expect(result.simplifiedDiscountChosen).toBe(true);
    expect(result.irrfDeductionUsed).toBeCloseTo(607.2, 2);
    expect(result.irrfBase).toBeCloseTo(2392.8, 2);
    expect(result.irrf).toBe(0);
    expect(result.headline).toBeCloseTo(2651.4, 2);
  });

  it("salário mínimo, sem dependentes, sem outros descontos: bruto abaixo de R$ 5.000 — IRRF sempre zero pela redução de 2026", () => {
    const result = calculateNetSalary(base({ grossSalary: 1621 }));
    expect(result.irrf).toBe(0);
    expect(result.headline).toBeCloseTo(1621 - result.inss, 6);
  });

  it("bruto de R$ 5.000,00 (limite da isenção integral): IRRF é zero mesmo antes da redução ser considerada", () => {
    const result = calculateNetSalary(base({ grossSalary: 5000, dependents: 0 }));
    expect(result.irrfBeforeReduction).toBeCloseTo(312.89, 2);
    expect(result.irrfReduction).toBeCloseTo(312.89, 2);
    expect(result.irrf).toBe(0);
  });

  it("acima de R$ 7.350 (fora da redução), mais dependentes reduz a base do IRRF e nunca piora o líquido", () => {
    const noDependents = calculateNetSalary(base({ grossSalary: 10000, dependents: 0 }));
    const withDependents = calculateNetSalary(base({ grossSalary: 10000, dependents: 3 }));
    expect(noDependents.irrfReduction).toBe(0);
    expect(withDependents.irrfReduction).toBe(0);
    expect(withDependents.headline).toBeGreaterThan(noDependents.headline);
  });

  it("outros descontos reduzem o líquido na mesma proporção", () => {
    const withoutExtra = calculateNetSalary(base({ grossSalary: 4000 }));
    const withExtra = calculateNetSalary(base({ grossSalary: 4000, otherDeductions: 250 }));
    expect(withoutExtra.headline - withExtra.headline).toBeCloseTo(250, 8);
  });

  it("salário zero ou negativo é inválido", () => {
    expect(validateNetSalaryInput(base({ grossSalary: 0 })).grossSalary).toBeDefined();
    expect(validateNetSalaryInput(base({ grossSalary: -100 })).grossSalary).toBeDefined();
  });

  it("dependentes negativos ou decimais são inválidos", () => {
    expect(validateNetSalaryInput(base({ dependents: -1 })).dependents).toBeDefined();
    expect(validateNetSalaryInput(base({ dependents: 1.5 })).dependents).toBeDefined();
  });

  it("outros descontos negativos são inválidos", () => {
    expect(validateNetSalaryInput(base({ otherDeductions: -1 })).otherDeductions).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isNetSalaryInputValid(base())).toBe(true);
  });
});
