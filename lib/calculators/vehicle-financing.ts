/**
 * Lógica de cálculo do cluster "Financiamento de Veículos"
 * (/utilitarios/financeiro/financiamento-veiculos): um conjunto de
 * ferramentas menores, cada uma respondendo a UMA pergunta específica sobre
 * financiamento de veículo, todas construídas sobre a mesma fórmula
 * financeira já usada pelo Simulador de Financiamento SAC x Price
 * (lib/calculators/financing.ts) — nunca duplicar a fórmula da Tabela
 * Price, sempre reaproveitar calculatePricePayment/
 * calculatePresentValueFromPayment daquele arquivo.
 *
 * Convenções (iguais às de financing.ts):
 * - Taxas são informadas como número "humano" (ex.: 1.5 = 1,5% ao mês).
 * - Nenhum valor é arredondado durante o cálculo — arredondamento/formatação
 *   (ex.: formatCurrencyBRL) acontece só na exibição.
 * - Todo o processamento é síncrono e 100% client-side.
 */

import {
  calculatePresentValueFromPayment,
  calculatePricePayment,
  MAX_INSTALLMENTS,
  toMonthlyRate,
  type FinancingRateType,
} from "./financing";

export { MAX_INSTALLMENTS };
export type { FinancingRateType };

// ---------------------------------------------------------------------------
// 1) Qual carro cabe no meu bolso?
// ---------------------------------------------------------------------------

export interface AffordabilityInput {
  /** Entrada disponível (R$). */
  downPayment: number;
  /** Parcela máxima que a pessoa está disposta/consegue pagar (R$). */
  maxInstallment: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
}

export interface AffordabilityFieldErrors {
  downPayment?: string;
  maxInstallment?: string;
  rate?: string;
  installments?: string;
}

export interface AffordabilityResult {
  /** Valor máximo financiável para a parcela informada (valor presente da prestação). */
  financedAmount: number;
  /** Valor aproximado máximo do veículo (financedAmount + entrada). */
  maxVehiclePrice: number;
  installmentsCount: number;
  installment: number;
  totalPaid: number;
  totalInterest: number;
}

export function validateAffordabilityInput(
  input: AffordabilityInput
): AffordabilityFieldErrors {
  const errors: AffordabilityFieldErrors = {};

  if (!Number.isFinite(input.downPayment) || input.downPayment < 0) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }
  if (!Number.isFinite(input.maxInstallment) || input.maxInstallment <= 0) {
    errors.maxInstallment = "Informe uma parcela máxima maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isAffordabilityInputValid(input: AffordabilityInput): boolean {
  return Object.keys(validateAffordabilityInput(input)).length === 0;
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const financedAmount = calculatePresentValueFromPayment(
    input.maxInstallment,
    monthlyRate,
    input.installments
  );
  const totalPaid = input.maxInstallment * input.installments;

  return {
    financedAmount,
    maxVehiclePrice: financedAmount + input.downPayment,
    installmentsCount: input.installments,
    installment: input.maxInstallment,
    totalPaid,
    totalInterest: totalPaid - financedAmount,
  };
}

// ---------------------------------------------------------------------------
// 2) Quanto preciso dar de entrada?
// ---------------------------------------------------------------------------

export interface RequiredDownPaymentInput {
  /** Valor do veículo (R$). */
  vehiclePrice: number;
  /** Parcela que a pessoa quer pagar (R$). */
  desiredInstallment: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
}

export interface RequiredDownPaymentFieldErrors {
  vehiclePrice?: string;
  desiredInstallment?: string;
  rate?: string;
  installments?: string;
}

export interface RequiredDownPaymentResult {
  /** Entrada aproximada necessária (nunca negativa — ver `coversFullPrice`). */
  downPayment: number;
  /** Entrada como percentual do valor do veículo (0-100). */
  downPaymentPercent: number;
  financedAmount: number;
  /**
   * true quando a parcela desejada já financiaria o veículo inteiro (ou
   * mais) sem nenhuma entrada — nesse caso `downPayment` é 0 e `installment`
   * é RECALCULADA para o valor financiado real (o veículo inteiro), que
   * fica menor que `desiredInstallment`.
   */
  coversFullPrice: boolean;
  installment: number;
  totalPaid: number;
  totalInterest: number;
}

export function validateRequiredDownPaymentInput(
  input: RequiredDownPaymentInput
): RequiredDownPaymentFieldErrors {
  const errors: RequiredDownPaymentFieldErrors = {};

  if (!Number.isFinite(input.vehiclePrice) || input.vehiclePrice <= 0) {
    errors.vehiclePrice = "Informe um valor do veículo maior que zero.";
  }
  if (!Number.isFinite(input.desiredInstallment) || input.desiredInstallment <= 0) {
    errors.desiredInstallment = "Informe uma parcela desejada maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isRequiredDownPaymentInputValid(input: RequiredDownPaymentInput): boolean {
  return Object.keys(validateRequiredDownPaymentInput(input)).length === 0;
}

export function calculateRequiredDownPayment(
  input: RequiredDownPaymentInput
): RequiredDownPaymentResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const maxFinanceable = calculatePresentValueFromPayment(
    input.desiredInstallment,
    monthlyRate,
    input.installments
  );

  const coversFullPrice = maxFinanceable >= input.vehiclePrice;
  const financedAmount = coversFullPrice ? input.vehiclePrice : maxFinanceable;
  const downPayment = coversFullPrice ? 0 : input.vehiclePrice - maxFinanceable;
  const installment = coversFullPrice
    ? calculatePricePayment(financedAmount, monthlyRate, input.installments)
    : input.desiredInstallment;
  const totalPaid = installment * input.installments;

  return {
    downPayment,
    downPaymentPercent: (downPayment / input.vehiclePrice) * 100,
    financedAmount,
    coversFullPrice,
    installment,
    totalPaid,
    totalInterest: totalPaid - financedAmount,
  };
}

// ---------------------------------------------------------------------------
// 5) Comparador de prazos (24x / 36x / 48x / 60x + prazos personalizados)
// ---------------------------------------------------------------------------

/** Prazos exibidos por padrão — os mais comuns em financiamento de veículo no Brasil. */
export const DEFAULT_COMPARISON_TERMS = [24, 36, 48, 60] as const;

export interface TermComparisonInput {
  vehiclePrice: number;
  downPayment: number;
  rate: number;
  rateType: FinancingRateType;
  /** Prazos a comparar, em meses (padrão: DEFAULT_COMPARISON_TERMS). */
  terms: number[];
}

export interface TermComparisonFieldErrors {
  vehiclePrice?: string;
  downPayment?: string;
  rate?: string;
  terms?: string;
}

export interface TermComparisonRow {
  term: number;
  installment: number;
  totalPaid: number;
  totalInterest: number;
}

export interface TermComparisonResult {
  financedAmount: number;
  rows: TermComparisonRow[];
}

export function validateTermComparisonInput(
  input: TermComparisonInput
): TermComparisonFieldErrors {
  const errors: TermComparisonFieldErrors = {};

  const hasValidVehiclePrice = Number.isFinite(input.vehiclePrice) && input.vehiclePrice > 0;
  const hasValidDownPayment = Number.isFinite(input.downPayment) && input.downPayment >= 0;

  if (!hasValidVehiclePrice) {
    errors.vehiclePrice = "Informe um valor do veículo maior que zero.";
  }
  if (!hasValidDownPayment) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }
  if (hasValidVehiclePrice && hasValidDownPayment && input.downPayment >= input.vehiclePrice) {
    errors.downPayment = "A entrada deve ser menor que o valor do veículo.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    input.terms.length === 0 ||
    input.terms.some(
      (term) => !Number.isFinite(term) || !Number.isInteger(term) || term <= 0 || term > MAX_INSTALLMENTS
    )
  ) {
    errors.terms = `Informe um ou mais prazos válidos, entre 1 e ${MAX_INSTALLMENTS} meses.`;
  }

  return errors;
}

export function isTermComparisonInputValid(input: TermComparisonInput): boolean {
  return Object.keys(validateTermComparisonInput(input)).length === 0;
}

export function compareFinancingTerms(input: TermComparisonInput): TermComparisonResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const financedAmount = input.vehiclePrice - input.downPayment;

  const rows = input.terms.map((term) => {
    const installment = calculatePricePayment(financedAmount, monthlyRate, term);
    const totalPaid = installment * term;
    return { term, installment, totalPaid, totalInterest: totalPaid - financedAmount };
  });

  return { financedAmount, rows };
}

// ---------------------------------------------------------------------------
// 6) Entrada maior x entrada menor
// ---------------------------------------------------------------------------

export interface DownPaymentScenarioInput {
  vehiclePrice: number;
  downPayment: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
}

export interface DownPaymentScenarioFieldErrors {
  vehiclePrice?: string;
  downPayment?: string;
  rate?: string;
  installments?: string;
}

export interface DownPaymentScenarioResult {
  downPayment: number;
  financedAmount: number;
  installment: number;
  totalPaid: number;
  totalInterest: number;
}

export function validateDownPaymentScenarioInput(
  input: DownPaymentScenarioInput
): DownPaymentScenarioFieldErrors {
  const errors: DownPaymentScenarioFieldErrors = {};

  const hasValidVehiclePrice = Number.isFinite(input.vehiclePrice) && input.vehiclePrice > 0;
  const hasValidDownPayment = Number.isFinite(input.downPayment) && input.downPayment >= 0;

  if (!hasValidVehiclePrice) {
    errors.vehiclePrice = "Informe um valor do veículo maior que zero.";
  }
  if (!hasValidDownPayment) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }
  if (hasValidVehiclePrice && hasValidDownPayment && input.downPayment >= input.vehiclePrice) {
    errors.downPayment = "A entrada deve ser menor que o valor do veículo.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isDownPaymentScenarioInputValid(input: DownPaymentScenarioInput): boolean {
  return Object.keys(validateDownPaymentScenarioInput(input)).length === 0;
}

function calculateDownPaymentScenario(input: DownPaymentScenarioInput): DownPaymentScenarioResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const financedAmount = input.vehiclePrice - input.downPayment;
  const installment = calculatePricePayment(financedAmount, monthlyRate, input.installments);
  const totalPaid = installment * input.installments;

  return {
    downPayment: input.downPayment,
    financedAmount,
    installment,
    totalPaid,
    totalInterest: totalPaid - financedAmount,
  };
}

export interface DownPaymentComparisonResult {
  scenarioA: DownPaymentScenarioResult;
  scenarioB: DownPaymentScenarioResult;
  /** B - A em cada métrica (entrada maior menos entrada menor, por convenção de exibição). */
  difference: {
    downPayment: number;
    installment: number;
    totalPaid: number;
    totalInterest: number;
  };
}

export function compareDownPaymentScenarios(
  scenarioAInput: DownPaymentScenarioInput,
  scenarioBInput: DownPaymentScenarioInput
): DownPaymentComparisonResult {
  const scenarioA = calculateDownPaymentScenario(scenarioAInput);
  const scenarioB = calculateDownPaymentScenario(scenarioBInput);

  return {
    scenarioA,
    scenarioB,
    difference: {
      downPayment: scenarioB.downPayment - scenarioA.downPayment,
      installment: scenarioB.installment - scenarioA.installment,
      totalPaid: scenarioB.totalPaid - scenarioA.totalPaid,
      totalInterest: scenarioB.totalInterest - scenarioA.totalInterest,
    },
  };
}

// ---------------------------------------------------------------------------
// 3) Descobrir taxa de juros (a partir de uma proposta já conhecida)
// ---------------------------------------------------------------------------

/**
 * Teto de busca inicial para a bisseção, em taxa mensal (1 = 100% ao mês).
 * Uma taxa de financiamento de veículo real nunca chega nem perto disso —
 * é só um limite de segurança para o algoritmo nunca rodar indefinidamente.
 */
const IMPLICIT_RATE_SEARCH_CEILING = 1;
/** Número de iterações da bisseção — converge bem além da precisão exibida. */
const IMPLICIT_RATE_BISECTION_STEPS = 100;
/** Diferença mínima de parcela, em R$, para não tratar como "taxa zero" por erro de ponto flutuante. */
const IMPLICIT_RATE_ZERO_EPSILON = 1e-9;

export interface ImplicitRateInput {
  /** Valor financiado (ou preço do veículo menos entrada — quem chama decide). */
  financedAmount: number;
  /** Parcela informada na proposta que se quer decifrar. */
  installment: number;
  installments: number;
}

export interface ImplicitRateFieldErrors {
  financedAmount?: string;
  installment?: string;
  installments?: string;
}

export interface ImplicitRateResult {
  monthlyRatePercent: number;
  annualRatePercent: number;
  totalPaid: number;
  totalInterest: number;
}

export function validateImplicitRateInput(input: ImplicitRateInput): ImplicitRateFieldErrors {
  const errors: ImplicitRateFieldErrors = {};

  const hasValidFinancedAmount = Number.isFinite(input.financedAmount) && input.financedAmount > 0;
  if (!hasValidFinancedAmount) {
    errors.financedAmount = "Informe um valor financiado maior que zero.";
  }
  if (!Number.isFinite(input.installment) || input.installment <= 0) {
    errors.installment = "Informe uma parcela maior que zero.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  if (
    hasValidFinancedAmount &&
    Number.isFinite(input.installment) &&
    input.installment > 0 &&
    Number.isFinite(input.installments) &&
    input.installments > 0
  ) {
    const minimumInstallment = input.financedAmount / input.installments;
    if (input.installment < minimumInstallment - IMPLICIT_RATE_ZERO_EPSILON) {
      errors.installment =
        "Essa parcela é menor do que o valor financiado dividido pelo prazo — não existe taxa (nem 0%) capaz de gerar esse resultado.";
    }
  }

  return errors;
}

export function isImplicitRateInputValid(input: ImplicitRateInput): boolean {
  return Object.keys(validateImplicitRateInput(input)).length === 0;
}

/**
 * Resolve a taxa mensal implícita pela bisseção: como calculatePricePayment é
 * estritamente crescente em relação à taxa (para financedAmount > 0 e
 * installments > 0), existe no máximo uma taxa não negativa que gera a
 * parcela informada. É um "cálculo iterativo robusto", não uma aproximação
 * grosseira — 100 passos de bisseção convergem muito além da precisão de
 * exibição (casas decimais de percentual).
 */
export function calculateImplicitMonthlyRate(input: ImplicitRateInput): number {
  const paymentAtZeroRate = input.financedAmount / input.installments;
  if (Math.abs(input.installment - paymentAtZeroRate) <= IMPLICIT_RATE_ZERO_EPSILON) {
    return 0;
  }

  let low = 0;
  let high = IMPLICIT_RATE_SEARCH_CEILING;
  // Garante que o teto realmente gera uma parcela maior que a informada,
  // dobrando o teto se necessário (proteção extra para prazos muito curtos
  // com parcelas informadas absurdamente altas).
  while (
    calculatePricePayment(input.financedAmount, high, input.installments) < input.installment &&
    high < Number.MAX_SAFE_INTEGER / 2
  ) {
    high *= 2;
  }

  for (let step = 0; step < IMPLICIT_RATE_BISECTION_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const midPayment = calculatePricePayment(input.financedAmount, mid, input.installments);
    if (midPayment < input.installment) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

export function calculateImplicitRateDetails(input: ImplicitRateInput): ImplicitRateResult {
  const monthlyRate = calculateImplicitMonthlyRate(input);
  const totalPaid = input.installment * input.installments;

  return {
    monthlyRatePercent: monthlyRate * 100,
    annualRatePercent: (Math.pow(1 + monthlyRate, 12) - 1) * 100,
    totalPaid,
    totalInterest: totalPaid - input.financedAmount,
  };
}

// ---------------------------------------------------------------------------
// 10) Financiamento x pagamento à vista
// ---------------------------------------------------------------------------

export interface FinancingVsCashInput {
  /** Preço do veículo (tabela, sem desconto). */
  vehiclePrice: number;
  /** Desconto oferecido para pagamento à vista, em % (0 = sem desconto). */
  cashDiscountPercent: number;
  downPayment: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
}

export interface FinancingVsCashFieldErrors {
  vehiclePrice?: string;
  cashDiscountPercent?: string;
  downPayment?: string;
  rate?: string;
  installments?: string;
}

export interface FinancingVsCashResult {
  cashPrice: number;
  financedAmount: number;
  installment: number;
  totalPaidFinancing: number;
  totalInterest: number;
  /** totalPaidFinancing - cashPrice. Positivo = financiar custa mais no total. */
  difference: number;
}

export function validateFinancingVsCashInput(
  input: FinancingVsCashInput
): FinancingVsCashFieldErrors {
  const errors: FinancingVsCashFieldErrors = {};

  const hasValidVehiclePrice = Number.isFinite(input.vehiclePrice) && input.vehiclePrice > 0;
  const hasValidDownPayment = Number.isFinite(input.downPayment) && input.downPayment >= 0;

  if (!hasValidVehiclePrice) {
    errors.vehiclePrice = "Informe um valor do veículo maior que zero.";
  }
  if (!Number.isFinite(input.cashDiscountPercent) || input.cashDiscountPercent < 0) {
    errors.cashDiscountPercent = "O desconto à vista não pode ser negativo.";
  } else if (input.cashDiscountPercent > 100) {
    errors.cashDiscountPercent = "O desconto à vista não pode ser maior que 100%.";
  }
  if (!hasValidDownPayment) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }
  if (hasValidVehiclePrice && hasValidDownPayment && input.downPayment >= input.vehiclePrice) {
    errors.downPayment = "A entrada deve ser menor que o valor do veículo.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isFinancingVsCashInputValid(input: FinancingVsCashInput): boolean {
  return Object.keys(validateFinancingVsCashInput(input)).length === 0;
}

export function compareFinancingVsCash(input: FinancingVsCashInput): FinancingVsCashResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const cashPrice = input.vehiclePrice * (1 - input.cashDiscountPercent / 100);
  const financedAmount = input.vehiclePrice - input.downPayment;
  const installment = calculatePricePayment(financedAmount, monthlyRate, input.installments);
  const totalPaidFinancing = input.downPayment + installment * input.installments;

  return {
    cashPrice,
    financedAmount,
    installment,
    totalPaidFinancing,
    totalInterest: totalPaidFinancing - input.downPayment - financedAmount,
    difference: totalPaidFinancing - cashPrice,
  };
}

// ---------------------------------------------------------------------------
// 13) Parcela máxima pela renda
// ---------------------------------------------------------------------------

export interface MaxInstallmentByIncomeInput {
  monthlyIncome: number;
  /** Percentual da renda considerado saudável para comprometer com a parcela do carro (ex.: 30). */
  commitmentPercent: number;
  /** Outras dívidas/parcelas mensais já comprometidas (opcional, padrão 0). */
  otherMonthlyDebts: number;
}

export interface MaxInstallmentByIncomeFieldErrors {
  monthlyIncome?: string;
  commitmentPercent?: string;
  otherMonthlyDebts?: string;
}

export interface MaxInstallmentByIncomeResult {
  /** Orçamento total considerado saudável (renda x percentual), antes de descontar outras dívidas. */
  budgetBeforeDebts: number;
  /** Parcela máxima recomendada para o carro, já descontando outras dívidas (nunca negativa). */
  maxInstallment: number;
  /** true quando outras dívidas já consomem todo o orçamento (ou mais), zerando a parcela recomendada. */
  debtsExceedBudget: boolean;
}

export function validateMaxInstallmentByIncomeInput(
  input: MaxInstallmentByIncomeInput
): MaxInstallmentByIncomeFieldErrors {
  const errors: MaxInstallmentByIncomeFieldErrors = {};

  if (!Number.isFinite(input.monthlyIncome) || input.monthlyIncome <= 0) {
    errors.monthlyIncome = "Informe uma renda mensal maior que zero.";
  }
  if (!Number.isFinite(input.commitmentPercent) || input.commitmentPercent <= 0) {
    errors.commitmentPercent = "Informe um percentual maior que zero.";
  } else if (input.commitmentPercent > 100) {
    errors.commitmentPercent = "O percentual não pode ser maior que 100%.";
  }
  if (!Number.isFinite(input.otherMonthlyDebts) || input.otherMonthlyDebts < 0) {
    errors.otherMonthlyDebts = "As outras dívidas mensais não podem ser negativas.";
  }

  return errors;
}

export function isMaxInstallmentByIncomeInputValid(input: MaxInstallmentByIncomeInput): boolean {
  return Object.keys(validateMaxInstallmentByIncomeInput(input)).length === 0;
}

export function calculateMaxInstallmentByIncome(
  input: MaxInstallmentByIncomeInput
): MaxInstallmentByIncomeResult {
  const budgetBeforeDebts = input.monthlyIncome * (input.commitmentPercent / 100);
  const maxInstallment = Math.max(0, budgetBeforeDebts - input.otherMonthlyDebts);

  return {
    budgetBeforeDebts,
    maxInstallment,
    debtsExceedBudget: input.otherMonthlyDebts >= budgetBeforeDebts,
  };
}

// ---------------------------------------------------------------------------
// 4) Comparar propostas de financiamento (até 3 propostas)
// ---------------------------------------------------------------------------

export const MIN_FINANCING_PROPOSALS = 2;
export const MAX_FINANCING_PROPOSALS = 3;

export interface FinancingProposalInput {
  /** Rótulo livre da proposta (ex.: nome do banco). Nunca vazio na exibição — ver defaultProposalLabel. */
  label: string;
  financedAmount: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
}

export interface FinancingProposalFieldErrors {
  financedAmount?: string;
  rate?: string;
  installments?: string;
}

export interface FinancingProposalResult {
  label: string;
  installment: number;
  totalPaid: number;
  totalInterest: number;
}

export function validateFinancingProposalInput(
  input: FinancingProposalInput
): FinancingProposalFieldErrors {
  const errors: FinancingProposalFieldErrors = {};

  if (!Number.isFinite(input.financedAmount) || input.financedAmount <= 0) {
    errors.financedAmount = "Informe um valor financiado maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isFinancingProposalInputValid(input: FinancingProposalInput): boolean {
  return Object.keys(validateFinancingProposalInput(input)).length === 0;
}

/**
 * Calcula cada proposta preenchida — a função NÃO decide qual é "a melhor":
 * apenas devolve os números de cada uma, na mesma ordem em que foram
 * informadas, para a interface apresentá-los lado a lado.
 */
export function compareFinancingProposals(
  inputs: FinancingProposalInput[]
): FinancingProposalResult[] {
  return inputs.map((input) => {
    const monthlyRate = toMonthlyRate(input.rate, input.rateType);
    const installment = calculatePricePayment(input.financedAmount, monthlyRate, input.installments);
    const totalPaid = installment * input.installments;

    return {
      label: input.label,
      installment,
      totalPaid,
      totalInterest: totalPaid - input.financedAmount,
    };
  });
}

// ---------------------------------------------------------------------------
// 7) Antecipação de parcelas
// ---------------------------------------------------------------------------

export interface EarlyPayoffInput {
  financedAmount: number;
  rate: number;
  rateType: FinancingRateType;
  /** Prazo total original do financiamento. */
  installments: number;
  /** Quantas parcelas já foram pagas até agora (0 = nenhuma ainda). */
  paidInstallments: number;
}

export interface EarlyPayoffFieldErrors {
  financedAmount?: string;
  rate?: string;
  installments?: string;
  paidInstallments?: string;
}

export interface EarlyPayoffResult {
  installment: number;
  remainingInstallments: number;
  /** Soma nominal das parcelas que ainda faltam, sem antecipar (o que seria pago seguindo o contrato até o fim). */
  nominalRemainingTotal: number;
  /** Valor aproximado necessário para quitar agora (valor presente das parcelas restantes, descontadas pela mesma taxa do contrato). */
  estimatedPayoffAmount: number;
  /** Economia estimada em juros ao antecipar (nominalRemainingTotal - estimatedPayoffAmount). */
  estimatedSavings: number;
}

export function validateEarlyPayoffInput(input: EarlyPayoffInput): EarlyPayoffFieldErrors {
  const errors: EarlyPayoffFieldErrors = {};

  if (!Number.isFinite(input.financedAmount) || input.financedAmount <= 0) {
    errors.financedAmount = "Informe um valor financiado maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  const hasValidInstallments =
    Number.isFinite(input.installments) && Number.isInteger(input.installments) && input.installments > 0;
  if (!hasValidInstallments) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }
  if (
    !Number.isFinite(input.paidInstallments) ||
    !Number.isInteger(input.paidInstallments) ||
    input.paidInstallments < 0
  ) {
    errors.paidInstallments = "Informe quantas parcelas já foram pagas (0 ou mais).";
  } else if (hasValidInstallments && input.paidInstallments >= input.installments) {
    errors.paidInstallments = "O número de parcelas pagas deve ser menor que o prazo total — o financiamento já estaria quitado.";
  }

  return errors;
}

export function isEarlyPayoffInputValid(input: EarlyPayoffInput): boolean {
  return Object.keys(validateEarlyPayoffInput(input)).length === 0;
}

export function calculateEarlyPayoff(input: EarlyPayoffInput): EarlyPayoffResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const installment = calculatePricePayment(input.financedAmount, monthlyRate, input.installments);
  const remainingInstallments = input.installments - input.paidInstallments;
  const nominalRemainingTotal = installment * remainingInstallments;
  const estimatedPayoffAmount = calculatePresentValueFromPayment(
    installment,
    monthlyRate,
    remainingInstallments
  );

  return {
    installment,
    remainingInstallments,
    nominalRemainingTotal,
    estimatedPayoffAmount,
    estimatedSavings: nominalRemainingTotal - estimatedPayoffAmount,
  };
}

// ---------------------------------------------------------------------------
// 9) CET estimado
// ---------------------------------------------------------------------------

export interface EstimatedCetInput {
  financedAmount: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
  /** Tarifas cobradas uma única vez (ex.: TAC), descontadas do valor efetivamente recebido. */
  upfrontFees: number;
  /** Seguro (ou outro custo) cobrado junto de cada parcela, além da prestação. */
  monthlyInsurance: number;
}

export interface EstimatedCetFieldErrors {
  financedAmount?: string;
  rate?: string;
  installments?: string;
  upfrontFees?: string;
  monthlyInsurance?: string;
}

export interface EstimatedCetResult {
  installment: number;
  totalMonthlyOutflow: number;
  netAmountReceived: number;
  nominalMonthlyRatePercent: number;
  cetMonthlyPercent: number;
  cetAnnualPercent: number;
}

export function validateEstimatedCetInput(input: EstimatedCetInput): EstimatedCetFieldErrors {
  const errors: EstimatedCetFieldErrors = {};

  const hasValidFinancedAmount = Number.isFinite(input.financedAmount) && input.financedAmount > 0;
  if (!hasValidFinancedAmount) {
    errors.financedAmount = "Informe um valor financiado maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }
  if (!Number.isFinite(input.upfrontFees) || input.upfrontFees < 0) {
    errors.upfrontFees = "As tarifas não podem ser negativas.";
  } else if (hasValidFinancedAmount && input.upfrontFees >= input.financedAmount) {
    errors.upfrontFees = "As tarifas devem ser menores que o valor financiado.";
  }
  if (!Number.isFinite(input.monthlyInsurance) || input.monthlyInsurance < 0) {
    errors.monthlyInsurance = "O seguro mensal não pode ser negativo.";
  }

  return errors;
}

export function isEstimatedCetInputValid(input: EstimatedCetInput): boolean {
  return Object.keys(validateEstimatedCetInput(input)).length === 0;
}

/**
 * Estima o CET reaproveitando o mesmo solver por bisseção de "Descobrir
 * taxa de juros" (calculateImplicitMonthlyRate): o CET é, por definição, a
 * taxa que iguala o valor efetivamente recebido (financiado menos tarifas
 * cobradas na entrada) ao valor presente de tudo que sai do bolso todo mês
 * (parcela + seguro/outros custos mensais).
 */
export function calculateEstimatedCet(input: EstimatedCetInput): EstimatedCetResult {
  const nominalMonthlyRate = toMonthlyRate(input.rate, input.rateType);
  const installment = calculatePricePayment(input.financedAmount, nominalMonthlyRate, input.installments);
  const totalMonthlyOutflow = installment + input.monthlyInsurance;
  const netAmountReceived = input.financedAmount - input.upfrontFees;

  const cetMonthlyRate = calculateImplicitMonthlyRate({
    financedAmount: netAmountReceived,
    installment: totalMonthlyOutflow,
    installments: input.installments,
  });

  return {
    installment,
    totalMonthlyOutflow,
    netAmountReceived,
    nominalMonthlyRatePercent: nominalMonthlyRate * 100,
    cetMonthlyPercent: cetMonthlyRate * 100,
    cetAnnualPercent: (Math.pow(1 + cetMonthlyRate, 12) - 1) * 100,
  };
}

// ---------------------------------------------------------------------------
// 11) Financiamento x consórcio
// ---------------------------------------------------------------------------

export interface FinancingVsConsortiumInput {
  vehiclePrice: number;
  downPayment: number;
  rate: number;
  rateType: FinancingRateType;
  installments: number;
  /** Parcela mensal informada pela administradora do consórcio (já com taxa de administração embutida). */
  consortiumInstallment: number;
  consortiumInstallments: number;
}

export interface FinancingVsConsortiumFieldErrors {
  vehiclePrice?: string;
  downPayment?: string;
  rate?: string;
  installments?: string;
  consortiumInstallment?: string;
  consortiumInstallments?: string;
}

export interface FinancingVsConsortiumResult {
  financing: {
    financedAmount: number;
    installment: number;
    totalPaid: number;
    totalInterest: number;
  };
  consortium: {
    totalPaid: number;
  };
  /** financing.totalPaid - consortium.totalPaid. */
  difference: number;
}

export function validateFinancingVsConsortiumInput(
  input: FinancingVsConsortiumInput
): FinancingVsConsortiumFieldErrors {
  const errors: FinancingVsConsortiumFieldErrors = {};

  const hasValidVehiclePrice = Number.isFinite(input.vehiclePrice) && input.vehiclePrice > 0;
  const hasValidDownPayment = Number.isFinite(input.downPayment) && input.downPayment >= 0;

  if (!hasValidVehiclePrice) {
    errors.vehiclePrice = "Informe um valor do veículo maior que zero.";
  }
  if (!hasValidDownPayment) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }
  if (hasValidVehiclePrice && hasValidDownPayment && input.downPayment >= input.vehiclePrice) {
    errors.downPayment = "A entrada deve ser menor que o valor do veículo.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }
  if (!Number.isFinite(input.consortiumInstallment) || input.consortiumInstallment <= 0) {
    errors.consortiumInstallment = "Informe uma parcela de consórcio maior que zero.";
  }
  if (
    !Number.isFinite(input.consortiumInstallments) ||
    !Number.isInteger(input.consortiumInstallments) ||
    input.consortiumInstallments <= 0
  ) {
    errors.consortiumInstallments = "Informe um prazo de consórcio válido: um número inteiro maior que zero.";
  } else if (input.consortiumInstallments > MAX_INSTALLMENTS) {
    errors.consortiumInstallments = `O prazo do consórcio não pode ser maior que ${MAX_INSTALLMENTS} meses.`;
  }

  return errors;
}

export function isFinancingVsConsortiumInputValid(input: FinancingVsConsortiumInput): boolean {
  return Object.keys(validateFinancingVsConsortiumInput(input)).length === 0;
}

export function compareFinancingVsConsortium(
  input: FinancingVsConsortiumInput
): FinancingVsConsortiumResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const financedAmount = input.vehiclePrice - input.downPayment;
  const installment = calculatePricePayment(financedAmount, monthlyRate, input.installments);
  const financingTotalPaid = input.downPayment + installment * input.installments;
  const consortiumTotalPaid = input.consortiumInstallment * input.consortiumInstallments;

  return {
    financing: {
      financedAmount,
      installment,
      totalPaid: financingTotalPaid,
      totalInterest: financingTotalPaid - input.downPayment - financedAmount,
    },
    consortium: {
      totalPaid: consortiumTotalPaid,
    },
    difference: financingTotalPaid - consortiumTotalPaid,
  };
}

// ---------------------------------------------------------------------------
// 12) Custo mensal de possuir um carro
// ---------------------------------------------------------------------------

export interface MonthlyCarCostInput {
  /** Parcela do financiamento (0 se o carro não estiver/for financiado). */
  installment: number;
  fuel: number;
  insurance: number;
  /** IPVA anual — a calculadora divide por 12 para entrar no custo mensal. */
  ipvaAnnual: number;
  /** Licenciamento anual — idem. */
  licensingAnnual: number;
  maintenance: number;
  parking: number;
  tolls: number;
  other: number;
}

export interface MonthlyCarCostFieldErrors {
  installment?: string;
  fuel?: string;
  insurance?: string;
  ipvaAnnual?: string;
  licensingAnnual?: string;
  maintenance?: string;
  parking?: string;
  tolls?: string;
  other?: string;
}

export interface MonthlyCarCostCategory {
  key: keyof MonthlyCarCostInput;
  label: string;
  monthlyAmount: number;
}

export interface MonthlyCarCostResult {
  monthlyTotal: number;
  annualTotal: number;
  categories: MonthlyCarCostCategory[];
}

const MONTHLY_CAR_COST_LABELS: Record<keyof MonthlyCarCostInput, string> = {
  installment: "Parcela do financiamento",
  fuel: "Combustível",
  insurance: "Seguro",
  ipvaAnnual: "IPVA (rateado)",
  licensingAnnual: "Licenciamento (rateado)",
  maintenance: "Manutenção",
  parking: "Estacionamento",
  tolls: "Pedágio",
  other: "Outros",
};

function validateNonNegativeField(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateMonthlyCarCostInput(input: MonthlyCarCostInput): MonthlyCarCostFieldErrors {
  const errors: MonthlyCarCostFieldErrors = {};
  const message = "Este valor não pode ser negativo.";

  if (!validateNonNegativeField(input.installment)) errors.installment = message;
  if (!validateNonNegativeField(input.fuel)) errors.fuel = message;
  if (!validateNonNegativeField(input.insurance)) errors.insurance = message;
  if (!validateNonNegativeField(input.ipvaAnnual)) errors.ipvaAnnual = message;
  if (!validateNonNegativeField(input.licensingAnnual)) errors.licensingAnnual = message;
  if (!validateNonNegativeField(input.maintenance)) errors.maintenance = message;
  if (!validateNonNegativeField(input.parking)) errors.parking = message;
  if (!validateNonNegativeField(input.tolls)) errors.tolls = message;
  if (!validateNonNegativeField(input.other)) errors.other = message;

  return errors;
}

export function isMonthlyCarCostInputValid(input: MonthlyCarCostInput): boolean {
  return Object.keys(validateMonthlyCarCostInput(input)).length === 0;
}

export function calculateMonthlyCarCost(input: MonthlyCarCostInput): MonthlyCarCostResult {
  const monthlyValues: Record<keyof MonthlyCarCostInput, number> = {
    installment: input.installment,
    fuel: input.fuel,
    insurance: input.insurance,
    ipvaAnnual: input.ipvaAnnual / 12,
    licensingAnnual: input.licensingAnnual / 12,
    maintenance: input.maintenance,
    parking: input.parking,
    tolls: input.tolls,
    other: input.other,
  };

  const categories = (Object.keys(monthlyValues) as (keyof MonthlyCarCostInput)[]).map((key) => ({
    key,
    label: MONTHLY_CAR_COST_LABELS[key],
    monthlyAmount: monthlyValues[key],
  }));

  const monthlyTotal = categories.reduce((sum, category) => sum + category.monthlyAmount, 0);

  return {
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    categories,
  };
}
