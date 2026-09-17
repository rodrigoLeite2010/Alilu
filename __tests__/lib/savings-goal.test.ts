import { describe, expect, it } from "vitest";
import {
  calculateSavingsGoal,
  isSavingsGoalInputValid,
  validateSavingsGoalInput,
  type SavingsGoalInput,
} from "@/lib/calculators/savings-goal";
import { calculateCompoundInterest } from "@/lib/calculators/compound-interest";

const base = (overrides: Partial<SavingsGoalInput> = {}): SavingsGoalInput => ({
  goal: 12000,
  initialAmount: 0,
  period: 12,
  periodType: "meses",
  rate: 0,
  rateType: "mensal",
  ...overrides,
});

describe("calculateSavingsGoal — sem rentabilidade (taxa 0)", () => {
  it("meta 12.000 em 12 meses, sem valor inicial: aporte de 1.000/mês (divisão simples)", () => {
    const result = calculateSavingsGoal(base());
    expect(result.headline).toBeCloseTo(1000, 10);
    expect(result.totalContributed).toBeCloseTo(12000, 10);
    expect(result.estimatedYield).toBeCloseTo(0, 10);
  });

  it("com valor inicial de 2.000: aporte de (12000-2000)/12 = 833,33...", () => {
    const result = calculateSavingsGoal(base({ initialAmount: 2000 }));
    expect(result.headline).toBeCloseTo((12000 - 2000) / 12, 10);
  });
});

describe("calculateSavingsGoal — com rentabilidade", () => {
  it("é consistente com o motor de juros compostos (round-trip): simular o aporte calculado deve bater na meta", () => {
    const input = base({ goal: 50000, initialAmount: 5000, period: 24, rate: 1, rateType: "mensal" });
    const result = calculateSavingsGoal(input);

    const simulation = calculateCompoundInterest({
      initialAmount: input.initialAmount,
      monthlyContribution: result.headline,
      rate: input.rate,
      rateType: input.rateType,
      period: input.period,
      periodType: input.periodType,
    });

    expect(simulation.finalAmount).toBeCloseTo(input.goal, 4);
  });

  it("taxa anual é convertida para mensal equivalente antes do cálculo (mesma regra de compound-interest)", () => {
    const monthly = calculateSavingsGoal(base({ rate: 12.68, rateType: "mensal" }));
    // 12% ao mês por 12 meses equivale a uma taxa anual de (1.12^12 - 1)*100 (mesma fórmula de toMonthlyRate).
    const equivalentAnnualRate = (Math.pow(1.1268, 12) - 1) * 100;
    const annual = calculateSavingsGoal(base({ rate: equivalentAnnualRate, rateType: "anual" }));
    expect(annual.monthlyRate).toBeCloseTo(monthly.monthlyRate, 8);
    expect(annual.headline).toBeCloseTo(monthly.headline, 4);
  });

  it("goalAlreadyReachable é true quando o valor inicial já supera a meta com os juros projetados", () => {
    const result = calculateSavingsGoal(
      base({ goal: 10000, initialAmount: 9000, period: 60, rate: 2, rateType: "mensal" })
    );
    expect(result.goalAlreadyReachable).toBe(true);
    expect(result.headline).toBe(0);
  });
});

describe("validação", () => {
  it("meta zero ou negativa é inválida", () => {
    expect(validateSavingsGoalInput(base({ goal: 0 })).goal).toBeDefined();
  });

  it("valor inicial negativo é inválido", () => {
    expect(validateSavingsGoalInput(base({ initialAmount: -1 })).initialAmount).toBeDefined();
  });

  it("valor inicial maior que a meta é inválido", () => {
    expect(validateSavingsGoalInput(base({ goal: 1000, initialAmount: 2000 })).initialAmount).toBeDefined();
  });

  it("prazo zero, negativo ou decimal é inválido", () => {
    expect(validateSavingsGoalInput(base({ period: 0 })).period).toBeDefined();
    expect(validateSavingsGoalInput(base({ period: 1.5 })).period).toBeDefined();
  });

  it("taxa negativa é inválida", () => {
    expect(validateSavingsGoalInput(base({ rate: -1 })).rate).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isSavingsGoalInputValid(base())).toBe(true);
  });
});
