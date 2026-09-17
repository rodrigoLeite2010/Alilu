import { describe, expect, it } from "vitest";
import {
  calculateNoticePeriodDays,
  calculateSeverance,
  isSeveranceInputValid,
  validateSeveranceInput,
  type SeveranceInput,
} from "@/lib/calculators/severance";

const base = (overrides: Partial<SeveranceInput> = {}): SeveranceInput => ({
  grossSalary: 3000,
  dismissalType: "sem_justa_causa",
  completedYears: 0,
  workedDaysInMonth: 0,
  vacationProportionalMonths: 0,
  thirteenthProportionalMonths: 0,
  hasExpiredVacation: false,
  fgtsBalance: 0,
  dependents: 0,
  ...overrides,
});

describe("calculateNoticePeriodDays (Lei nº 12.506/2011)", () => {
  it("0 anos completos: 30 dias (mínimo legal)", () => {
    expect(calculateNoticePeriodDays(0)).toBe(30);
  });

  it("2 anos completos: 30 + 3*2 = 36 dias", () => {
    expect(calculateNoticePeriodDays(2)).toBe(36);
  });

  it("30 anos completos: seria 120, mas é limitado a 90 (teto legal)", () => {
    expect(calculateNoticePeriodDays(30)).toBe(90);
  });

  it("20 anos completos: exatamente no teto (30+60=90)", () => {
    expect(calculateNoticePeriodDays(20)).toBe(90);
  });
});

// Valores esperados calculados de forma independente (fora do código-fonte),
// usando as mesmas tabelas de payroll-tables.test.ts.
describe("calculateSeverance — dispensa sem justa causa", () => {
  it("cenário completo: saldo, aviso, férias vencidas+proporcionais, 13º e multa FGTS", () => {
    const result = calculateSeverance(
      base({
        grossSalary: 3000,
        completedYears: 2,
        workedDaysInMonth: 10,
        vacationProportionalMonths: 5,
        thirteenthProportionalMonths: 8,
        hasExpiredVacation: true,
        fgtsBalance: 5000,
      })
    );

    expect(result.balanceSalaryGross).toBeCloseTo(1000, 6);
    expect(result.balanceSalaryINSS).toBeCloseTo(75, 2);
    expect(result.balanceSalaryIRRF).toBe(0);
    expect(result.noticePeriodDays).toBe(36);
    expect(result.noticePeriodAmount).toBeCloseTo(3600, 2);
    expect(result.expiredVacationAmount).toBeCloseTo(4000, 6);
    expect(result.proportionalVacationAmount).toBeCloseTo(1666.67, 1);
    expect(result.thirteenthGross).toBeCloseTo(2000, 6);
    expect(result.thirteenthINSS).toBeCloseTo(155.68, 1);
    expect(result.fgtsFineAmount).toBeCloseTo(2000, 6);
    expect(result.totalGross).toBeCloseTo(14266.67, 1);
    expect(result.totalDeductions).toBeCloseTo(230.68, 1);
    expect(result.headline).toBeCloseTo(14035.99, 1);
  });

  it("sem saldo de FGTS informado: multa é zero (não inventa saldo)", () => {
    const result = calculateSeverance(base({ fgtsBalance: 0 }));
    expect(result.fgtsFineAmount).toBe(0);
  });

  it("sem férias vencidas: valor de férias vencidas é zero", () => {
    const result = calculateSeverance(base({ hasExpiredVacation: false }));
    expect(result.expiredVacationAmount).toBe(0);
  });

  it("salário alto (18.000): saldo de salário tributável (6.000, faixa de transição da redução de 2026) tem IRRF de fato descontado, isolado do 13º proporcional", () => {
    // Valores recalculados de forma independente (fora do código-fonte, em
    // script Node separado) com base em calculateIRRF2026 (payroll-tables.ts).
    const result = calculateSeverance(
      base({
        grossSalary: 18000,
        workedDaysInMonth: 10,
        thirteenthProportionalMonths: 0,
        vacationProportionalMonths: 0,
        hasExpiredVacation: false,
        fgtsBalance: 0,
      })
    );

    expect(result.balanceSalaryGross).toBeCloseTo(6000, 6);
    expect(result.balanceSalaryINSS).toBeCloseTo(641.51, 2);
    expect(result.balanceSalaryIRRF).toBeCloseTo(385.1, 1);
    expect(result.balanceSalaryNet).toBeCloseTo(4973.39, 1);
  });
});

describe("calculateSeverance — pedido de demissão", () => {
  it("não gera aviso prévio indenizado nem multa de FGTS, mesmo informando anos/saldo", () => {
    const result = calculateSeverance(
      base({
        dismissalType: "pedido_demissao",
        grossSalary: 3000,
        completedYears: 5,
        workedDaysInMonth: 15,
        vacationProportionalMonths: 3,
        thirteenthProportionalMonths: 4,
        fgtsBalance: 9999,
      })
    );

    expect(result.noticePeriodDays).toBe(0);
    expect(result.noticePeriodAmount).toBe(0);
    expect(result.fgtsFineAmount).toBe(0);
    expect(result.balanceSalaryGross).toBeCloseTo(1500, 6);
    expect(result.proportionalVacationAmount).toBeCloseTo(1000, 6);
    expect(result.thirteenthGross).toBeCloseTo(1000, 6);
    expect(result.totalGross).toBeCloseTo(3500, 6);
    expect(result.totalDeductions).toBeCloseTo(187.5, 1);
    expect(result.headline).toBeCloseTo(3312.5, 1);
  });
});

describe("validação", () => {
  it("salário zero ou negativo é inválido", () => {
    expect(validateSeveranceInput(base({ grossSalary: 0 })).grossSalary).toBeDefined();
  });

  it("dias trabalhados no mês fora de 0-30 é inválido", () => {
    expect(validateSeveranceInput(base({ workedDaysInMonth: -1 })).workedDaysInMonth).toBeDefined();
    expect(validateSeveranceInput(base({ workedDaysInMonth: 31 })).workedDaysInMonth).toBeDefined();
  });

  it("meses proporcionais fora de 0-12 é inválido", () => {
    expect(
      validateSeveranceInput(base({ vacationProportionalMonths: 13 })).vacationProportionalMonths
    ).toBeDefined();
    expect(
      validateSeveranceInput(base({ thirteenthProportionalMonths: -1 })).thirteenthProportionalMonths
    ).toBeDefined();
  });

  it("saldo de FGTS negativo é inválido", () => {
    expect(validateSeveranceInput(base({ fgtsBalance: -1 })).fgtsBalance).toBeDefined();
  });

  it("anos completos negativos ou decimais são inválidos", () => {
    expect(validateSeveranceInput(base({ completedYears: -1 })).completedYears).toBeDefined();
    expect(validateSeveranceInput(base({ completedYears: 1.5 })).completedYears).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isSeveranceInputValid(base())).toBe(true);
  });
});
