import { describe, expect, it } from "vitest";
import {
  calculateVacation,
  isVacationInputValid,
  validateVacationInput,
  type VacationInput,
} from "@/lib/calculators/vacation";

const base = (overrides: Partial<VacationInput> = {}): VacationInput => ({
  grossSalary: 3000,
  vacationDays: 30,
  sellDays: 0,
  dependents: 0,
  ...overrides,
});

// Valores esperados recalculados de forma independente (fora do código-fonte,
// em script Node separado) após a correção do IRRF para a regra completa de
// 2026 (lib/calculators/payroll-tables.ts: calculateIRRF2026 — dedução mais
// vantajosa entre INSS+dependentes e o desconto simplificado de R$ 607,20,
// seguida da redução da Lei nº 15.270/2025).
describe("calculateVacation", () => {
  it("férias SEM abono: 30 dias gozados, bruto 3.000 — terço constitucional e base tributável corretos", () => {
    const result = calculateVacation(base());

    // Terço constitucional: 1/3 sobre o valor das férias gozadas.
    expect(result.vacationGrossValue).toBeCloseTo(3000, 6);
    expect(result.oneThird).toBeCloseTo(1000, 6);
    expect(result.oneThird).toBeCloseTo(result.vacationGrossValue / 3, 6);
    expect(result.abonoValue).toBe(0);
    expect(result.grossTotal).toBeCloseTo(4000, 6);

    // Sem abono, a base tributável é igual ao valor bruto das férias + terço.
    expect(result.taxableGrossValue).toBeCloseTo(4000, 6);
    expect(result.inss).toBeCloseTo(368.6, 2);
    expect(result.simplifiedDiscountChosen).toBe(true);
    expect(result.irrfBase).toBeCloseTo(3392.8, 2);
    expect(result.irrfBeforeReduction).toBeCloseTo(114.76, 2);
    expect(result.irrfReduction).toBeCloseTo(114.76, 2);
    expect(result.irrf).toBe(0);
    expect(result.netTotal).toBeCloseTo(3631.4, 2);
  });

  it("férias COM abono pecuniário: 20 dias gozados + 10 dias vendidos, bruto 3.000 — abono fica fora da base do INSS e do IRRF, mas o terço sobre o abono entra na base do IRRF", () => {
    const result = calculateVacation(base({ vacationDays: 20, sellDays: 10 }));

    expect(result.abonoValue).toBeCloseTo(1000, 6);
    expect(result.abonoOneThird).toBeCloseTo(333.33, 1);
    expect(result.abonoOneThird).toBeCloseTo(result.abonoValue / 3, 6);
    expect(result.grossTotal).toBeCloseTo(4000, 6);

    // Base do INSS = só férias gozadas + terço sobre elas; o abono pecuniário
    // (isento) fica de fora.
    expect(result.taxableGrossValue).toBeCloseTo(2666.67, 1);
    expect(result.taxableGrossValue).toBeLessThan(result.grossTotal);
    expect(result.inss).toBeCloseTo(215.68, 1);
    // Base do IRRF = base do INSS + terço sobre o abono (tributável, embora
    // isento de INSS) = 2.666,67 + 333,33 = 3.000.
    expect(result.irrfGrossValue).toBeCloseTo(3000, 1);
    expect(result.irrf).toBe(0);
    expect(result.netTotal).toBeCloseTo(3784.32, 2);
  });

  it("férias com abono e dependente, bruto alto (9.000, acima do teto de redução do IRRF): mostra IRRF devido de fato, com o terço sobre o abono somado à base do IRRF", () => {
    const result = calculateVacation({
      grossSalary: 9000,
      vacationDays: 20,
      sellDays: 10,
      dependents: 1,
    });

    expect(result.vacationGrossValue).toBeCloseTo(6000, 6);
    expect(result.oneThird).toBeCloseTo(2000, 6);
    expect(result.abonoValue).toBeCloseTo(3000, 6);
    expect(result.abonoOneThird).toBeCloseTo(1000, 6);
    expect(result.grossTotal).toBeCloseTo(12000, 6);

    // Base do INSS = 6.000 + 2.000 = 8.000 (abono de 3.000 fica de fora).
    expect(result.taxableGrossValue).toBeCloseTo(8000, 6);
    expect(result.inss).toBeCloseTo(921.51, 2);
    expect(result.simplifiedDiscountChosen).toBe(false);
    // Base do IRRF = 8.000 + terço sobre o abono (1.000) = 9.000.
    expect(result.irrfGrossValue).toBeCloseTo(9000, 6);
    expect(result.irrfBase).toBeCloseTo(7888.9, 2);
    // Rendimento bruto tributável (9.000) acima de R$ 7.350: sem redução.
    expect(result.irrfReduction).toBe(0);
    expect(result.irrf).toBeCloseTo(1260.72, 2);
    expect(result.netTotal).toBeCloseTo(9817.77, 2);
  });

  it("CASO OBRIGATÓRIO DE AUDITORIA: bruto 9.000, 20 dias gozados, 10 dias vendidos, sem dependentes — IRRF esperado R$ 1.312,85", () => {
    const result = calculateVacation({
      grossSalary: 9000,
      vacationDays: 20,
      sellDays: 10,
      dependents: 0,
    });

    // Base do INSS = 8.000 (férias gozadas + terço); base do IRRF = 9.000
    // (soma-se o terço constitucional sobre o abono, tributável para IRRF).
    expect(result.taxableGrossValue).toBeCloseTo(8000, 6);
    expect(result.inss).toBeCloseTo(921.51, 2);
    expect(result.irrfGrossValue).toBeCloseTo(9000, 6);
    expect(result.irrf).toBeCloseTo(1312.85, 2);
  });

  it("limite exato da isenção integral: valor tributável das férias em R$ 5.000,00 — IRRF zerado pela redução da Lei nº 15.270/2025", () => {
    const result = calculateVacation(base({ grossSalary: 3750, vacationDays: 30 }));

    expect(result.taxableGrossValue).toBeCloseTo(5000, 2);
    expect(result.irrfBeforeReduction).toBeCloseTo(312.89, 2);
    expect(result.irrfReduction).toBeCloseTo(312.89, 2);
    expect(result.irrf).toBe(0);
    expect(result.netTotal).toBeCloseTo(4498.49, 2);
  });

  it("15 dias de férias (proporcional/fracionada): valores proporcionais à metade", () => {
    const result = calculateVacation(base({ vacationDays: 15 }));
    expect(result.vacationGrossValue).toBeCloseTo(1500, 6);
    expect(result.oneThird).toBeCloseTo(500, 6);
    expect(result.taxableGrossValue).toBeCloseTo(2000, 6);
  });

  it("dias de férias fora de 1-30 é inválido", () => {
    expect(validateVacationInput(base({ vacationDays: 0 })).vacationDays).toBeDefined();
    expect(validateVacationInput(base({ vacationDays: 31 })).vacationDays).toBeDefined();
  });

  it("dias de abono acima de 10 é inválido", () => {
    expect(validateVacationInput(base({ sellDays: 11 })).sellDays).toBeDefined();
  });

  it("soma de dias gozados + vendidos acima de 30 é inválida", () => {
    const errors = validateVacationInput(base({ vacationDays: 25, sellDays: 10 }));
    expect(errors.sellDays).toBeDefined();
  });

  it("salário zero ou negativo é inválido", () => {
    expect(validateVacationInput(base({ grossSalary: 0 })).grossSalary).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isVacationInputValid(base({ vacationDays: 20, sellDays: 10 }))).toBe(true);
  });
});
