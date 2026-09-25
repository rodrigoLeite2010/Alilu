import { describe, expect, it } from "vitest";
import { toMonthlyRate, MAX_INSTALLMENTS } from "@/lib/calculators/financing";
import {
  calculateAffordability,
  calculateEarlyPayoff,
  calculateEstimatedCet,
  calculateImplicitMonthlyRate,
  calculateImplicitRateDetails,
  calculateMaxInstallmentByIncome,
  calculateMonthlyCarCost,
  calculateRequiredDownPayment,
  compareDownPaymentScenarios,
  compareFinancingProposals,
  compareFinancingTerms,
  compareFinancingVsCash,
  compareFinancingVsConsortium,
  DEFAULT_COMPARISON_TERMS,
  isAffordabilityInputValid,
  isDownPaymentScenarioInputValid,
  isEarlyPayoffInputValid,
  isEstimatedCetInputValid,
  isFinancingProposalInputValid,
  isFinancingVsCashInputValid,
  isFinancingVsConsortiumInputValid,
  isImplicitRateInputValid,
  isMaxInstallmentByIncomeInputValid,
  isMonthlyCarCostInputValid,
  isRequiredDownPaymentInputValid,
  isTermComparisonInputValid,
  MAX_FINANCING_PROPOSALS,
  MIN_FINANCING_PROPOSALS,
  validateAffordabilityInput,
  validateDownPaymentScenarioInput,
  validateEarlyPayoffInput,
  validateEstimatedCetInput,
  validateFinancingProposalInput,
  validateFinancingVsCashInput,
  validateFinancingVsConsortiumInput,
  validateImplicitRateInput,
  validateMaxInstallmentByIncomeInput,
  validateMonthlyCarCostInput,
  validateRequiredDownPaymentInput,
  validateTermComparisonInput,
  type AffordabilityInput,
  type DownPaymentScenarioInput,
  type EarlyPayoffInput,
  type EstimatedCetInput,
  type FinancingProposalInput,
  type FinancingVsCashInput,
  type FinancingVsConsortiumInput,
  type ImplicitRateInput,
  type MaxInstallmentByIncomeInput,
  type MonthlyCarCostInput,
  type RequiredDownPaymentInput,
  type TermComparisonInput,
} from "@/lib/calculators/vehicle-financing";
import { parseLocaleNumberBRL } from "@/lib/validators/number";

/**
 * Testes das calculadoras do cluster "Financiamento de Veículos" (FASE 10 do
 * prompt de implementação). Sempre que possível, o valor esperado é
 * verificado por um caminho independente da implementação (ex.: valor
 * presente da prestação, em vez de repetir a fórmula da Tabela Price), e os
 * casos de borda pedidos explicitamente são cobertos: taxa zero, entrada
 * zero, valores muito altos, prazo mínimo, prazo máximo, campos vazios,
 * valor inválido e vírgula decimal.
 */

function presentValue(payment: number, monthlyRate: number, installments: number): number {
  if (monthlyRate === 0) {
    return payment * installments;
  }
  let sum = 0;
  for (let index = 1; index <= installments; index += 1) {
    sum += payment / Math.pow(1 + monthlyRate, index);
  }
  return sum;
}

/**
 * Fórmula direta da prestação da Tabela Price (independente da
 * implementação em lib/calculators/financing.ts), usada só para gerar, a
 * partir de uma taxa conhecida, a parcela que calculateImplicitMonthlyRate
 * deveria conseguir decifrar de volta.
 */
function presentValueToInstallment(
  financedAmount: number,
  monthlyRate: number,
  installments: number
): number {
  if (monthlyRate === 0) {
    return financedAmount / installments;
  }
  return (
    (financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, installments))) /
    (Math.pow(1 + monthlyRate, installments) - 1)
  );
}

// ---------------------------------------------------------------------------
// 1) Qual carro cabe no meu bolso? (calculateAffordability)
// ---------------------------------------------------------------------------

function baseAffordabilityInput(overrides: Partial<AffordabilityInput> = {}): AffordabilityInput {
  return {
    downPayment: 5000,
    maxInstallment: 1000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    ...overrides,
  };
}

describe("1) Qual carro cabe no meu bolso — calculateAffordability", () => {
  it("o valor financiável é o valor presente da parcela máxima informada", () => {
    const input = baseAffordabilityInput();
    const result = calculateAffordability(input);
    const monthlyRate = toMonthlyRate(input.rate, input.rateType);

    expect(result.financedAmount).toBeCloseTo(
      presentValue(input.maxInstallment, monthlyRate, input.installments),
      6
    );
    expect(result.maxVehiclePrice).toBeCloseTo(result.financedAmount + input.downPayment, 6);
    expect(result.totalPaid).toBe(input.maxInstallment * input.installments);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - result.financedAmount, 6);
  });

  it("com taxa zero, o valor financiável é a parcela vezes o número de parcelas", () => {
    const input = baseAffordabilityInput({ rate: 0 });
    const result = calculateAffordability(input);

    expect(result.financedAmount).toBeCloseTo(input.maxInstallment * input.installments, 6);
    expect(result.totalInterest).toBeCloseTo(0, 6);
  });

  it("com entrada zero, o preço máximo do veículo é igual ao valor financiável", () => {
    const input = baseAffordabilityInput({ downPayment: 0 });
    const result = calculateAffordability(input);

    expect(result.maxVehiclePrice).toBeCloseTo(result.financedAmount, 6);
  });

  it("aceita valores muito altos sem estourar", () => {
    const input = baseAffordabilityInput({ downPayment: 5_000_000, maxInstallment: 500_000 });
    const result = calculateAffordability(input);

    expect(Number.isFinite(result.maxVehiclePrice)).toBe(true);
    expect(result.maxVehiclePrice).toBeGreaterThan(input.downPayment);
  });

  it("aceita o prazo mínimo (1 parcela)", () => {
    const input = baseAffordabilityInput({ installments: 1 });
    const result = calculateAffordability(input);

    expect(result.installmentsCount).toBe(1);
    expect(result.totalPaid).toBe(input.maxInstallment);
  });

  it("aceita o prazo máximo (MAX_INSTALLMENTS)", () => {
    const input = baseAffordabilityInput({ installments: MAX_INSTALLMENTS });
    expect(isAffordabilityInputValid(input)).toBe(true);
    const result = calculateAffordability(input);
    expect(result.installmentsCount).toBe(MAX_INSTALLMENTS);
  });

  it("rejeita prazo acima do máximo permitido", () => {
    const errors = validateAffordabilityInput(
      baseAffordabilityInput({ installments: MAX_INSTALLMENTS + 1 })
    );
    expect(errors.installments).toBeDefined();
  });

  it("rejeita campos vazios (NaN, como vem de um campo de texto em branco)", () => {
    const errors = validateAffordabilityInput(
      baseAffordabilityInput({ maxInstallment: NaN, rate: NaN, installments: NaN })
    );
    expect(errors.maxInstallment).toBeDefined();
    expect(errors.rate).toBeDefined();
    expect(errors.installments).toBeDefined();
  });

  it("rejeita valores inválidos: parcela máxima zero/negativa e entrada negativa", () => {
    expect(validateAffordabilityInput(baseAffordabilityInput({ maxInstallment: 0 })).maxInstallment).toBeDefined();
    expect(validateAffordabilityInput(baseAffordabilityInput({ maxInstallment: -100 })).maxInstallment).toBeDefined();
    expect(validateAffordabilityInput(baseAffordabilityInput({ downPayment: -1 })).downPayment).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2) Quanto preciso dar de entrada? (calculateRequiredDownPayment)
// ---------------------------------------------------------------------------

function baseDownPaymentInput(
  overrides: Partial<RequiredDownPaymentInput> = {}
): RequiredDownPaymentInput {
  return {
    vehiclePrice: 80000,
    desiredInstallment: 1500,
    rate: 1.8,
    rateType: "mensal",
    installments: 48,
    ...overrides,
  };
}

describe("2) Quanto preciso dar de entrada — calculateRequiredDownPayment", () => {
  it("a entrada é a diferença entre o preço do veículo e o valor financiável pela parcela desejada", () => {
    const input = baseDownPaymentInput();
    const result = calculateRequiredDownPayment(input);
    const monthlyRate = toMonthlyRate(input.rate, input.rateType);
    const maxFinanceable = presentValue(input.desiredInstallment, monthlyRate, input.installments);

    expect(result.coversFullPrice).toBe(false);
    expect(result.downPayment).toBeCloseTo(input.vehiclePrice - maxFinanceable, 6);
    expect(result.downPaymentPercent).toBeCloseTo((result.downPayment / input.vehiclePrice) * 100, 6);
  });

  it("quando a parcela desejada já cobre o veículo inteiro, não exige entrada e recalcula a parcela", () => {
    // Parcela alta o bastante para financiar os R$ 80.000 sozinha em 48x a 1,8% a.m.
    const input = baseDownPaymentInput({ desiredInstallment: 5000 });
    const result = calculateRequiredDownPayment(input);

    expect(result.coversFullPrice).toBe(true);
    expect(result.downPayment).toBe(0);
    expect(result.financedAmount).toBe(input.vehiclePrice);
    expect(result.installment).toBeLessThan(input.desiredInstallment);

    const monthlyRate = toMonthlyRate(input.rate, input.rateType);
    expect(presentValue(result.installment, monthlyRate, input.installments)).toBeCloseTo(
      input.vehiclePrice,
      2
    );
  });

  it("com taxa zero, o valor financiável é a parcela vezes o prazo", () => {
    const input = baseDownPaymentInput({ rate: 0, desiredInstallment: 1000 });
    const result = calculateRequiredDownPayment(input);

    expect(result.coversFullPrice).toBe(false);
    expect(result.downPayment).toBeCloseTo(input.vehiclePrice - input.desiredInstallment * input.installments, 6);
  });

  it("aceita o prazo mínimo e o prazo máximo", () => {
    expect(isRequiredDownPaymentInputValid(baseDownPaymentInput({ installments: 1 }))).toBe(true);
    expect(
      isRequiredDownPaymentInputValid(baseDownPaymentInput({ installments: MAX_INSTALLMENTS }))
    ).toBe(true);
    expect(
      validateRequiredDownPaymentInput(baseDownPaymentInput({ installments: MAX_INSTALLMENTS + 1 }))
        .installments
    ).toBeDefined();
  });

  it("rejeita campos vazios e valores inválidos", () => {
    const errors = validateRequiredDownPaymentInput(
      baseDownPaymentInput({ vehiclePrice: NaN, desiredInstallment: 0, rate: -1, installments: 0 })
    );
    expect(errors.vehiclePrice).toBeDefined();
    expect(errors.desiredInstallment).toBeDefined();
    expect(errors.rate).toBeDefined();
    expect(errors.installments).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5) Comparador de prazos (compareFinancingTerms)
// ---------------------------------------------------------------------------

function baseTermComparisonInput(overrides: Partial<TermComparisonInput> = {}): TermComparisonInput {
  return {
    vehiclePrice: 60000,
    downPayment: 10000,
    rate: 1.5,
    rateType: "mensal",
    terms: [...DEFAULT_COMPARISON_TERMS],
    ...overrides,
  };
}

describe("5) Comparador de prazos — compareFinancingTerms", () => {
  it("gera uma linha por prazo e o valor presente de cada parcela fecha no valor financiado", () => {
    const input = baseTermComparisonInput();
    const result = compareFinancingTerms(input);
    const monthlyRate = toMonthlyRate(input.rate, input.rateType);

    expect(result.financedAmount).toBe(input.vehiclePrice - input.downPayment);
    expect(result.rows).toHaveLength(input.terms.length);
    for (const row of result.rows) {
      expect(presentValue(row.installment, monthlyRate, row.term)).toBeCloseTo(result.financedAmount, 2);
      expect(row.totalPaid).toBeCloseTo(row.installment * row.term, 6);
    }
  });

  it("prazos mais longos têm parcela menor e juros totais maiores", () => {
    const result = compareFinancingTerms(baseTermComparisonInput());
    const [term24, term36, term48, term60] = result.rows;

    expect(term60.installment).toBeLessThan(term24.installment);
    expect(term60.totalInterest).toBeGreaterThan(term24.totalInterest);
    expect(term36.installment).toBeLessThan(term24.installment);
    expect(term48.installment).toBeLessThan(term36.installment);
  });

  it("com entrada zero, financia o preço cheio do veículo", () => {
    const input = baseTermComparisonInput({ downPayment: 0 });
    const result = compareFinancingTerms(input);
    expect(result.financedAmount).toBe(input.vehiclePrice);
  });

  it("com taxa zero, a parcela é o valor financiado dividido pelo prazo", () => {
    const input = baseTermComparisonInput({ rate: 0, terms: [24] });
    const result = compareFinancingTerms(input);
    expect(result.rows[0].installment).toBeCloseTo(result.financedAmount / 24, 6);
    expect(result.rows[0].totalInterest).toBeCloseTo(0, 6);
  });

  it("aceita um prazo personalizado igual ao prazo máximo permitido", () => {
    const input = baseTermComparisonInput({ terms: [...DEFAULT_COMPARISON_TERMS, MAX_INSTALLMENTS] });
    expect(isTermComparisonInputValid(input)).toBe(true);
  });

  it("rejeita prazo acima do máximo, prazo zero e lista de prazos vazia", () => {
    expect(validateTermComparisonInput(baseTermComparisonInput({ terms: [MAX_INSTALLMENTS + 1] })).terms).toBeDefined();
    expect(validateTermComparisonInput(baseTermComparisonInput({ terms: [0] })).terms).toBeDefined();
    expect(validateTermComparisonInput(baseTermComparisonInput({ terms: [] })).terms).toBeDefined();
  });

  it("rejeita entrada maior ou igual ao valor do veículo", () => {
    const errors = validateTermComparisonInput(
      baseTermComparisonInput({ vehiclePrice: 50000, downPayment: 50000 })
    );
    expect(errors.downPayment).toBeDefined();
  });

  it("rejeita campos vazios (NaN)", () => {
    const errors = validateTermComparisonInput(
      baseTermComparisonInput({ vehiclePrice: NaN, rate: NaN })
    );
    expect(errors.vehiclePrice).toBeDefined();
    expect(errors.rate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6) Entrada maior x entrada menor (compareDownPaymentScenarios)
// ---------------------------------------------------------------------------

function baseScenarioInput(overrides: Partial<DownPaymentScenarioInput> = {}): DownPaymentScenarioInput {
  return {
    vehiclePrice: 70000,
    downPayment: 7000,
    rate: 1.6,
    rateType: "mensal",
    installments: 48,
    ...overrides,
  };
}

describe("6) Entrada maior x entrada menor — compareDownPaymentScenarios", () => {
  it("a diferença é sempre cenário B menos cenário A", () => {
    const scenarioA = baseScenarioInput({ downPayment: 7000 });
    const scenarioB = baseScenarioInput({ downPayment: 21000 });
    const result = compareDownPaymentScenarios(scenarioA, scenarioB);

    expect(result.difference.downPayment).toBeCloseTo(
      result.scenarioB.downPayment - result.scenarioA.downPayment,
      6
    );
    expect(result.difference.installment).toBeCloseTo(
      result.scenarioB.installment - result.scenarioA.installment,
      6
    );
    expect(result.difference.totalInterest).toBeCloseTo(
      result.scenarioB.totalInterest - result.scenarioA.totalInterest,
      6
    );
  });

  it("entrada maior (cenário B) gera parcela e juros totais menores que a entrada menor (cenário A)", () => {
    const scenarioA = baseScenarioInput({ downPayment: 7000 });
    const scenarioB = baseScenarioInput({ downPayment: 35000 });
    const result = compareDownPaymentScenarios(scenarioA, scenarioB);

    expect(result.scenarioB.installment).toBeLessThan(result.scenarioA.installment);
    expect(result.scenarioB.totalInterest).toBeLessThan(result.scenarioA.totalInterest);
    expect(result.difference.installment).toBeLessThan(0);
  });

  it("com entrada zero em um dos cenários, o valor financiado é o preço cheio do veículo", () => {
    const scenarioA = baseScenarioInput({ downPayment: 0 });
    const scenarioB = baseScenarioInput({ downPayment: 14000 });
    const result = compareDownPaymentScenarios(scenarioA, scenarioB);
    expect(result.scenarioA.financedAmount).toBe(scenarioA.vehiclePrice);
  });

  it("aceita o prazo mínimo e o prazo máximo em ambos os cenários", () => {
    expect(isDownPaymentScenarioInputValid(baseScenarioInput({ installments: 1 }))).toBe(true);
    expect(isDownPaymentScenarioInputValid(baseScenarioInput({ installments: MAX_INSTALLMENTS }))).toBe(
      true
    );
  });

  it("rejeita entrada maior ou igual ao preço do veículo, e campos vazios", () => {
    expect(
      validateDownPaymentScenarioInput(baseScenarioInput({ vehiclePrice: 10000, downPayment: 10000 }))
        .downPayment
    ).toBeDefined();
    expect(
      validateDownPaymentScenarioInput(baseScenarioInput({ installments: NaN })).installments
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3) Descobrir taxa de juros (calculateImplicitMonthlyRate / calculateImplicitRateDetails)
// ---------------------------------------------------------------------------

function baseImplicitRateInput(overrides: Partial<ImplicitRateInput> = {}): ImplicitRateInput {
  return {
    financedAmount: 50000,
    installment: 1500,
    installments: 48,
    ...overrides,
  };
}

describe("3) Descobrir taxa de juros — calculateImplicitMonthlyRate (bisseção)", () => {
  it("encontra a taxa mensal que reproduz exatamente a parcela informada (verificação independente via valor presente)", () => {
    const input = baseImplicitRateInput();
    const monthlyRate = calculateImplicitMonthlyRate(input);

    expect(presentValue(input.installment, monthlyRate, input.installments)).toBeCloseTo(
      input.financedAmount,
      2
    );
  });

  it("reconstrói uma taxa conhecida: gera a parcela a partir de uma taxa e verifica que a bisseção encontra a mesma taxa de volta", () => {
    const financedAmount = 40000;
    const installments = 36;
    const knownMonthlyRate = 0.018; // 1,8% ao mês
    const generatedInstallment = presentValueToInstallment(financedAmount, knownMonthlyRate, installments);

    const monthlyRate = calculateImplicitMonthlyRate({
      financedAmount,
      installment: generatedInstallment,
      installments,
    });

    expect(monthlyRate).toBeCloseTo(knownMonthlyRate, 6);
  });

  it("com parcela exatamente igual ao valor financiado dividido pelo prazo, a taxa é zero", () => {
    const input = baseImplicitRateInput({ financedAmount: 48000, installment: 1000, installments: 48 });
    expect(calculateImplicitMonthlyRate(input)).toBeCloseTo(0, 9);
  });

  it("aceita o prazo mínimo (1 parcela)", () => {
    // Com 1 parcela, payment = financedAmount * (1 + i), então i = payment/financedAmount - 1.
    const input = baseImplicitRateInput({ financedAmount: 10000, installment: 10500, installments: 1 });
    const monthlyRate = calculateImplicitMonthlyRate(input);
    expect(monthlyRate).toBeCloseTo(0.05, 6);
  });

  it("aceita o prazo máximo (MAX_INSTALLMENTS) e valores muito altos", () => {
    const input = baseImplicitRateInput({
      financedAmount: 2_000_000,
      installment: 60000,
      installments: MAX_INSTALLMENTS,
    });
    expect(isImplicitRateInputValid(input)).toBe(true);
    const result = calculateImplicitRateDetails(input);
    expect(Number.isFinite(result.monthlyRatePercent)).toBe(true);
    expect(result.monthlyRatePercent).toBeGreaterThanOrEqual(0);
  });

  it("calculateImplicitRateDetails converte a taxa mensal para anual e calcula juros totais", () => {
    const input = baseImplicitRateInput();
    const result = calculateImplicitRateDetails(input);
    const monthlyRate = calculateImplicitMonthlyRate(input);

    expect(result.monthlyRatePercent).toBeCloseTo(monthlyRate * 100, 6);
    expect(result.annualRatePercent).toBeCloseTo((Math.pow(1 + monthlyRate, 12) - 1) * 100, 6);
    expect(result.totalPaid).toBe(input.installment * input.installments);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - input.financedAmount, 6);
  });

  it("rejeita parcela menor que o valor financiado dividido pelo prazo (nenhuma taxa não negativa gera esse resultado)", () => {
    const errors = validateImplicitRateInput(
      baseImplicitRateInput({ financedAmount: 48000, installment: 500, installments: 48 })
    );
    expect(errors.installment).toBeDefined();
  });

  it("rejeita prazo acima do máximo permitido", () => {
    const errors = validateImplicitRateInput(baseImplicitRateInput({ installments: MAX_INSTALLMENTS + 1 }));
    expect(errors.installments).toBeDefined();
  });

  it("rejeita campos vazios (NaN) e valores inválidos", () => {
    const errors = validateImplicitRateInput(
      baseImplicitRateInput({ financedAmount: NaN, installment: 0, installments: NaN })
    );
    expect(errors.financedAmount).toBeDefined();
    expect(errors.installment).toBeDefined();
    expect(errors.installments).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 10) Financiamento x pagamento à vista (compareFinancingVsCash)
// ---------------------------------------------------------------------------

function baseFinancingVsCashInput(overrides: Partial<FinancingVsCashInput> = {}): FinancingVsCashInput {
  return {
    vehiclePrice: 60000,
    cashDiscountPercent: 5,
    downPayment: 10000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    ...overrides,
  };
}

describe("10) Financiamento x pagamento à vista — compareFinancingVsCash", () => {
  it("aplica o desconto à vista sobre o preço do veículo", () => {
    const input = baseFinancingVsCashInput();
    const result = compareFinancingVsCash(input);
    expect(result.cashPrice).toBeCloseTo(input.vehiclePrice * 0.95, 6);
  });

  it("com desconto zero, o preço à vista é igual ao preço do veículo", () => {
    const input = baseFinancingVsCashInput({ cashDiscountPercent: 0 });
    const result = compareFinancingVsCash(input);
    expect(result.cashPrice).toBe(input.vehiclePrice);
  });

  it("a diferença é o total pago financiando menos o preço à vista", () => {
    const input = baseFinancingVsCashInput();
    const result = compareFinancingVsCash(input);
    expect(result.difference).toBeCloseTo(result.totalPaidFinancing - result.cashPrice, 6);
    expect(result.totalPaidFinancing).toBeCloseTo(
      input.downPayment + result.installment * input.installments,
      6
    );
  });

  it("com taxa zero, financiar nunca custa mais que a soma nominal (sem juros)", () => {
    const input = baseFinancingVsCashInput({ rate: 0, cashDiscountPercent: 0 });
    const result = compareFinancingVsCash(input);
    expect(result.totalPaidFinancing).toBeCloseTo(input.vehiclePrice, 6);
    expect(result.totalInterest).toBeCloseTo(0, 6);
  });

  it("com entrada zero, financia o preço cheio do veículo", () => {
    const input = baseFinancingVsCashInput({ downPayment: 0 });
    const result = compareFinancingVsCash(input);
    expect(result.financedAmount).toBe(input.vehiclePrice);
  });

  it("aceita valores muito altos, prazo mínimo e prazo máximo", () => {
    expect(isFinancingVsCashInputValid(baseFinancingVsCashInput({ vehiclePrice: 3_000_000 }))).toBe(true);
    expect(isFinancingVsCashInputValid(baseFinancingVsCashInput({ installments: 1 }))).toBe(true);
    expect(isFinancingVsCashInputValid(baseFinancingVsCashInput({ installments: MAX_INSTALLMENTS }))).toBe(
      true
    );
  });

  it("rejeita desconto acima de 100%, entrada maior/igual ao preço e campos vazios", () => {
    expect(
      validateFinancingVsCashInput(baseFinancingVsCashInput({ cashDiscountPercent: 101 })).cashDiscountPercent
    ).toBeDefined();
    expect(
      validateFinancingVsCashInput(baseFinancingVsCashInput({ vehiclePrice: 10000, downPayment: 10000 }))
        .downPayment
    ).toBeDefined();
    expect(validateFinancingVsCashInput(baseFinancingVsCashInput({ vehiclePrice: NaN })).vehiclePrice).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 13) Parcela máxima pela renda (calculateMaxInstallmentByIncome)
// ---------------------------------------------------------------------------

function baseMaxInstallmentInput(
  overrides: Partial<MaxInstallmentByIncomeInput> = {}
): MaxInstallmentByIncomeInput {
  return {
    monthlyIncome: 6000,
    commitmentPercent: 30,
    otherMonthlyDebts: 500,
    ...overrides,
  };
}

describe("13) Parcela máxima pela renda — calculateMaxInstallmentByIncome", () => {
  it("aplica o percentual sobre a renda e desconta outras dívidas", () => {
    const input = baseMaxInstallmentInput();
    const result = calculateMaxInstallmentByIncome(input);
    expect(result.budgetBeforeDebts).toBeCloseTo(input.monthlyIncome * 0.3, 6);
    expect(result.maxInstallment).toBeCloseTo(input.monthlyIncome * 0.3 - input.otherMonthlyDebts, 6);
    expect(result.debtsExceedBudget).toBe(false);
  });

  it("com outras dívidas zero, a parcela máxima é igual ao orçamento antes de dívidas", () => {
    const input = baseMaxInstallmentInput({ otherMonthlyDebts: 0 });
    const result = calculateMaxInstallmentByIncome(input);
    expect(result.maxInstallment).toBeCloseTo(result.budgetBeforeDebts, 6);
  });

  it("quando outras dívidas consomem todo o orçamento, a parcela máxima é zero (nunca negativa)", () => {
    const input = baseMaxInstallmentInput({ monthlyIncome: 3000, commitmentPercent: 20, otherMonthlyDebts: 900 });
    const result = calculateMaxInstallmentByIncome(input);
    expect(result.maxInstallment).toBe(0);
    expect(result.debtsExceedBudget).toBe(true);
  });

  it("aceita valores muito altos de renda", () => {
    const input = baseMaxInstallmentInput({ monthlyIncome: 1_000_000 });
    expect(isMaxInstallmentByIncomeInputValid(input)).toBe(true);
    expect(calculateMaxInstallmentByIncome(input).maxInstallment).toBeGreaterThan(0);
  });

  it("rejeita percentual zero ou acima de 100%, e campos vazios", () => {
    expect(
      validateMaxInstallmentByIncomeInput(baseMaxInstallmentInput({ commitmentPercent: 0 })).commitmentPercent
    ).toBeDefined();
    expect(
      validateMaxInstallmentByIncomeInput(baseMaxInstallmentInput({ commitmentPercent: 101 })).commitmentPercent
    ).toBeDefined();
    expect(
      validateMaxInstallmentByIncomeInput(baseMaxInstallmentInput({ monthlyIncome: NaN })).monthlyIncome
    ).toBeDefined();
  });

  it("rejeita renda zero/negativa e outras dívidas negativas", () => {
    expect(validateMaxInstallmentByIncomeInput(baseMaxInstallmentInput({ monthlyIncome: 0 })).monthlyIncome).toBeDefined();
    expect(
      validateMaxInstallmentByIncomeInput(baseMaxInstallmentInput({ otherMonthlyDebts: -1 })).otherMonthlyDebts
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4) Comparar propostas de financiamento (compareFinancingProposals)
// ---------------------------------------------------------------------------

function baseProposalInput(overrides: Partial<FinancingProposalInput> = {}): FinancingProposalInput {
  return {
    label: "Proposta A",
    financedAmount: 50000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    ...overrides,
  };
}

describe("4) Comparar propostas de financiamento — compareFinancingProposals", () => {
  it("calcula cada proposta na mesma ordem em que foi informada, sem reordenar", () => {
    const proposalA = baseProposalInput({ label: "Banco A", rate: 1.2 });
    const proposalB = baseProposalInput({ label: "Banco B", rate: 1.8 });
    const results = compareFinancingProposals([proposalA, proposalB]);

    expect(results.map((r) => r.label)).toEqual(["Banco A", "Banco B"]);
    expect(results[0].totalInterest).toBeLessThan(results[1].totalInterest);
  });

  it("cada proposta é calculada de forma independente (valor presente da parcela fecha no valor financiado dela)", () => {
    const proposal = baseProposalInput();
    const [result] = compareFinancingProposals([proposal]);
    const monthlyRate = toMonthlyRate(proposal.rate, proposal.rateType);

    expect(presentValue(result.installment, monthlyRate, proposal.installments)).toBeCloseTo(
      proposal.financedAmount,
      2
    );
    expect(result.totalPaid).toBeCloseTo(result.installment * proposal.installments, 6);
  });

  it("aceita entre MIN e MAX propostas (2 e 3)", () => {
    expect(MIN_FINANCING_PROPOSALS).toBe(2);
    expect(MAX_FINANCING_PROPOSALS).toBe(3);
  });

  it("aceita o prazo mínimo, o prazo máximo e valores muito altos", () => {
    expect(isFinancingProposalInputValid(baseProposalInput({ installments: 1 }))).toBe(true);
    expect(isFinancingProposalInputValid(baseProposalInput({ installments: MAX_INSTALLMENTS }))).toBe(true);
    expect(isFinancingProposalInputValid(baseProposalInput({ financedAmount: 5_000_000 }))).toBe(true);
  });

  it("com taxa zero, o total pago é igual ao valor financiado (sem juros)", () => {
    const proposal = baseProposalInput({ rate: 0 });
    const [result] = compareFinancingProposals([proposal]);
    expect(result.totalPaid).toBeCloseTo(proposal.financedAmount, 6);
    expect(result.totalInterest).toBeCloseTo(0, 6);
  });

  it("rejeita valor financiado zero/negativo, prazo acima do máximo e campos vazios", () => {
    expect(validateFinancingProposalInput(baseProposalInput({ financedAmount: 0 })).financedAmount).toBeDefined();
    expect(
      validateFinancingProposalInput(baseProposalInput({ installments: MAX_INSTALLMENTS + 1 })).installments
    ).toBeDefined();
    expect(validateFinancingProposalInput(baseProposalInput({ rate: NaN })).rate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7) Antecipação de parcelas (calculateEarlyPayoff)
// ---------------------------------------------------------------------------

function baseEarlyPayoffInput(overrides: Partial<EarlyPayoffInput> = {}): EarlyPayoffInput {
  return {
    financedAmount: 40000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    paidInstallments: 12,
    ...overrides,
  };
}

describe("7) Antecipação de parcelas — calculateEarlyPayoff", () => {
  it("o valor de quitação é o valor presente das parcelas restantes (verificação independente)", () => {
    const input = baseEarlyPayoffInput();
    const result = calculateEarlyPayoff(input);
    const monthlyRate = toMonthlyRate(input.rate, input.rateType);

    expect(result.remainingInstallments).toBe(input.installments - input.paidInstallments);
    expect(presentValue(result.installment, monthlyRate, result.remainingInstallments)).toBeCloseTo(
      result.estimatedPayoffAmount,
      2
    );
    expect(result.nominalRemainingTotal).toBeCloseTo(result.installment * result.remainingInstallments, 6);
    expect(result.estimatedSavings).toBeCloseTo(
      result.nominalRemainingTotal - result.estimatedPayoffAmount,
      6
    );
  });

  it("com zero parcelas pagas (entrada zero de antecipação), o valor de quitação é o próprio valor financiado", () => {
    const input = baseEarlyPayoffInput({ paidInstallments: 0 });
    const result = calculateEarlyPayoff(input);
    expect(result.estimatedPayoffAmount).toBeCloseTo(input.financedAmount, 2);
  });

  it("com taxa zero, não há economia ao antecipar (quitação nominal = restante nominal)", () => {
    const input = baseEarlyPayoffInput({ rate: 0 });
    const result = calculateEarlyPayoff(input);
    expect(result.estimatedSavings).toBeCloseTo(0, 6);
  });

  it("aceita o prazo mínimo (1 parcela, nenhuma paga ainda) e o prazo máximo", () => {
    expect(isEarlyPayoffInputValid(baseEarlyPayoffInput({ installments: 1, paidInstallments: 0 }))).toBe(true);
    expect(
      isEarlyPayoffInputValid(baseEarlyPayoffInput({ installments: MAX_INSTALLMENTS, paidInstallments: 0 }))
    ).toBe(true);
  });

  it("rejeita parcelas pagas maior ou igual ao prazo total, e campos vazios", () => {
    expect(
      validateEarlyPayoffInput(baseEarlyPayoffInput({ paidInstallments: 48 })).paidInstallments
    ).toBeDefined();
    expect(
      validateEarlyPayoffInput(baseEarlyPayoffInput({ paidInstallments: NaN })).paidInstallments
    ).toBeDefined();
    expect(validateEarlyPayoffInput(baseEarlyPayoffInput({ financedAmount: 0 })).financedAmount).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 9) CET estimado (calculateEstimatedCet)
// ---------------------------------------------------------------------------

function baseEstimatedCetInput(overrides: Partial<EstimatedCetInput> = {}): EstimatedCetInput {
  return {
    financedAmount: 50000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    upfrontFees: 500,
    monthlyInsurance: 30,
    ...overrides,
  };
}

describe("9) CET estimado — calculateEstimatedCet", () => {
  it("sem tarifas nem seguro, o CET estimado é igual à taxa nominal (sanidade)", () => {
    const input = baseEstimatedCetInput({ upfrontFees: 0, monthlyInsurance: 0 });
    const result = calculateEstimatedCet(input);
    expect(result.cetMonthlyPercent).toBeCloseTo(result.nominalMonthlyRatePercent, 4);
  });

  it("com tarifas e/ou seguro, o CET é sempre maior ou igual à taxa nominal", () => {
    const input = baseEstimatedCetInput();
    const result = calculateEstimatedCet(input);
    expect(result.cetMonthlyPercent).toBeGreaterThan(result.nominalMonthlyRatePercent);
  });

  it("o valor líquido recebido é o financiado menos as tarifas, e a saída mensal é a parcela mais o seguro", () => {
    const input = baseEstimatedCetInput();
    const result = calculateEstimatedCet(input);
    expect(result.netAmountReceived).toBeCloseTo(input.financedAmount - input.upfrontFees, 6);
    expect(result.totalMonthlyOutflow).toBeCloseTo(result.installment + input.monthlyInsurance, 6);
  });

  it("o CET anual é a conversão composta do CET mensal", () => {
    const result = calculateEstimatedCet(baseEstimatedCetInput());
    expect(result.cetAnnualPercent).toBeCloseTo(
      (Math.pow(1 + result.cetMonthlyPercent / 100, 12) - 1) * 100,
      6
    );
  });

  it("aceita valores muito altos, prazo mínimo e prazo máximo", () => {
    expect(isEstimatedCetInputValid(baseEstimatedCetInput({ financedAmount: 3_000_000 }))).toBe(true);
    expect(isEstimatedCetInputValid(baseEstimatedCetInput({ installments: 1 }))).toBe(true);
    expect(isEstimatedCetInputValid(baseEstimatedCetInput({ installments: MAX_INSTALLMENTS }))).toBe(true);
  });

  it("rejeita tarifas maiores ou iguais ao valor financiado, e campos vazios", () => {
    expect(
      validateEstimatedCetInput(baseEstimatedCetInput({ financedAmount: 1000, upfrontFees: 1000 }))
        .upfrontFees
    ).toBeDefined();
    expect(validateEstimatedCetInput(baseEstimatedCetInput({ rate: NaN })).rate).toBeDefined();
    expect(
      validateEstimatedCetInput(baseEstimatedCetInput({ monthlyInsurance: -1 })).monthlyInsurance
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 11) Financiamento x consórcio (compareFinancingVsConsortium)
// ---------------------------------------------------------------------------

function baseFinancingVsConsortiumInput(
  overrides: Partial<FinancingVsConsortiumInput> = {}
): FinancingVsConsortiumInput {
  return {
    vehiclePrice: 60000,
    downPayment: 10000,
    rate: 1.5,
    rateType: "mensal",
    installments: 48,
    consortiumInstallment: 900,
    consortiumInstallments: 60,
    ...overrides,
  };
}

describe("11) Financiamento x consórcio — compareFinancingVsConsortium", () => {
  it("o total pago do consórcio é simplesmente parcela x prazo (sem juros compostos)", () => {
    const input = baseFinancingVsConsortiumInput();
    const result = compareFinancingVsConsortium(input);
    expect(result.consortium.totalPaid).toBe(input.consortiumInstallment * input.consortiumInstallments);
  });

  it("a diferença é o total do financiamento menos o total do consórcio", () => {
    const input = baseFinancingVsConsortiumInput();
    const result = compareFinancingVsConsortium(input);
    expect(result.difference).toBeCloseTo(result.financing.totalPaid - result.consortium.totalPaid, 6);
  });

  it("com entrada zero, financia o preço cheio do veículo", () => {
    const input = baseFinancingVsConsortiumInput({ downPayment: 0 });
    const result = compareFinancingVsConsortium(input);
    expect(result.financing.financedAmount).toBe(input.vehiclePrice);
  });

  it("aceita prazo mínimo e máximo em ambas as modalidades", () => {
    expect(isFinancingVsConsortiumInputValid(baseFinancingVsConsortiumInput({ installments: 1 }))).toBe(true);
    expect(
      isFinancingVsConsortiumInputValid(baseFinancingVsConsortiumInput({ consortiumInstallments: MAX_INSTALLMENTS }))
    ).toBe(true);
  });

  it("rejeita parcela de consórcio zero/negativa, entrada maior/igual ao preço e campos vazios", () => {
    expect(
      validateFinancingVsConsortiumInput(baseFinancingVsConsortiumInput({ consortiumInstallment: 0 }))
        .consortiumInstallment
    ).toBeDefined();
    expect(
      validateFinancingVsConsortiumInput(
        baseFinancingVsConsortiumInput({ vehiclePrice: 10000, downPayment: 10000 })
      ).downPayment
    ).toBeDefined();
    expect(
      validateFinancingVsConsortiumInput(baseFinancingVsConsortiumInput({ consortiumInstallments: NaN }))
        .consortiumInstallments
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 12) Custo mensal de possuir um carro (calculateMonthlyCarCost)
// ---------------------------------------------------------------------------

function baseMonthlyCarCostInput(overrides: Partial<MonthlyCarCostInput> = {}): MonthlyCarCostInput {
  return {
    installment: 1200,
    fuel: 400,
    insurance: 250,
    ipvaAnnual: 1200,
    licensingAnnual: 120,
    maintenance: 150,
    parking: 200,
    tolls: 80,
    other: 0,
    ...overrides,
  };
}

describe("12) Custo mensal de possuir um carro — calculateMonthlyCarCost", () => {
  it("rateia os valores anuais (IPVA e licenciamento) por 12 e soma tudo", () => {
    const input = baseMonthlyCarCostInput();
    const result = calculateMonthlyCarCost(input);
    const expectedTotal =
      input.installment +
      input.fuel +
      input.insurance +
      input.ipvaAnnual / 12 +
      input.licensingAnnual / 12 +
      input.maintenance +
      input.parking +
      input.tolls +
      input.other;

    expect(result.monthlyTotal).toBeCloseTo(expectedTotal, 6);
    expect(result.annualTotal).toBeCloseTo(expectedTotal * 12, 6);
  });

  it("cada categoria aparece na lista com o valor mensal já rateado", () => {
    const result = calculateMonthlyCarCost(baseMonthlyCarCostInput());
    const ipva = result.categories.find((c) => c.key === "ipvaAnnual");
    expect(ipva?.monthlyAmount).toBeCloseTo(1200 / 12, 6);
  });

  it("com todos os campos zero, o total é zero (nenhum campo é obrigatório)", () => {
    const input = baseMonthlyCarCostInput({
      installment: 0,
      fuel: 0,
      insurance: 0,
      ipvaAnnual: 0,
      licensingAnnual: 0,
      maintenance: 0,
      parking: 0,
      tolls: 0,
      other: 0,
    });
    expect(isMonthlyCarCostInputValid(input)).toBe(true);
    expect(calculateMonthlyCarCost(input).monthlyTotal).toBe(0);
  });

  it("aceita valores muito altos", () => {
    const input = baseMonthlyCarCostInput({ installment: 50000, fuel: 10000 });
    expect(isMonthlyCarCostInputValid(input)).toBe(true);
    expect(calculateMonthlyCarCost(input).monthlyTotal).toBeGreaterThan(60000);
  });

  it("rejeita qualquer campo negativo", () => {
    expect(validateMonthlyCarCostInput(baseMonthlyCarCostInput({ fuel: -1 })).fuel).toBeDefined();
    expect(validateMonthlyCarCostInput(baseMonthlyCarCostInput({ ipvaAnnual: -1 })).ipvaAnnual).toBeDefined();
    expect(validateMonthlyCarCostInput(baseMonthlyCarCostInput({ other: -1 })).other).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Vírgula decimal (parseLocaleNumberBRL) — usado por todos os formulários do
// cluster para interpretar os campos de taxa e prazo personalizado.
// ---------------------------------------------------------------------------

describe("Parsing de números no padrão brasileiro (vírgula decimal)", () => {
  it("aceita vírgula como separador decimal", () => {
    expect(parseLocaleNumberBRL("1,5")).toBeCloseTo(1.5, 6);
    expect(parseLocaleNumberBRL("48")).toBe(48);
  });

  it("aceita ponto como separador de milhar junto com a vírgula decimal", () => {
    expect(parseLocaleNumberBRL("1.234,56")).toBeCloseTo(1234.56, 6);
  });

  it("aceita também o formato internacional (ponto decimal)", () => {
    expect(parseLocaleNumberBRL("1234.56")).toBeCloseTo(1234.56, 6);
  });

  it("campo vazio retorna null (tratado como valor ausente pelos validadores)", () => {
    expect(parseLocaleNumberBRL("")).toBeNull();
    expect(parseLocaleNumberBRL("   ")).toBeNull();
  });

  it("texto não numérico retorna null", () => {
    expect(parseLocaleNumberBRL("abc")).toBeNull();
  });
});
