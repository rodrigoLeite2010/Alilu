import {
  toMonthlyRate,
  type CompoundInterestRateType,
} from "@/lib/calculators/compound-interest";

/**
 * Lógica de cálculo de "Quanto Guardar por Mês", isolada da interface (ver
 * PROMPT MESTRE, seção 14). Reaproveita o motor de juros compostos (mesma
 * conversão de taxa anual->mensal de lib/calculators/compound-interest.ts,
 * mesma convenção de aporte ao final do mês), resolvendo a fórmula de valor
 * futuro de uma série de aportes (anuidade postecipada) para o aporte
 * mensal necessário, em vez de para o saldo final:
 *
 *   FV = inicial × (1+i)^n + aporte × [((1+i)^n − 1) / i]         (i > 0)
 *   FV = inicial + aporte × n                                      (i = 0)
 *
 * Isolando "aporte" (o valor desconhecido desta calculadora):
 *
 *   aporte = (meta − inicial × (1+i)^n) / [((1+i)^n − 1) / i]      (i > 0)
 *   aporte = (meta − inicial) / n                                   (i = 0)
 *
 * Todo o processamento é síncrono e client-side. Nenhum valor é
 * arredondado durante o cálculo.
 */

export interface SavingsGoalInput {
  /** Meta financeira a atingir (R$). */
  goal: number;
  /** Valor já disponível hoje (R$). */
  initialAmount: number;
  /** Prazo, sempre um número inteiro positivo. */
  period: number;
  /** Se o prazo informado é em meses ou em anos. */
  periodType: "meses" | "anos";
  /** Rentabilidade estimada (opcional; 0 = sem rentabilidade, só poupança "no colchão"). */
  rate: number;
  /** Se a taxa informada é mensal ou anual. */
  rateType: CompoundInterestRateType;
}

export interface SavingsGoalFieldErrors {
  goal?: string;
  initialAmount?: string;
  period?: string;
  rate?: string;
}

export interface SavingsGoalResult {
  /** Aporte mensal necessário — resultado principal. Nunca negativo (mínimo 0). */
  headline: number;
  /** Total aportado ao longo do prazo (headline × número de meses). */
  totalContributed: number;
  /** Rendimento estimado total (meta − inicial − totalContributed). */
  estimatedYield: number;
  monthlyRate: number;
  totalMonths: number;
  /** true quando a meta já é alcançável só com o valor inicial (aporte necessário seria negativo, exibido como 0). */
  goalAlreadyReachable: boolean;
}

export function validateSavingsGoalInput(
  input: SavingsGoalInput
): SavingsGoalFieldErrors {
  const errors: SavingsGoalFieldErrors = {};

  if (!Number.isFinite(input.goal) || input.goal <= 0) {
    errors.goal = "Informe uma meta financeira maior que zero.";
  }
  if (!Number.isFinite(input.initialAmount) || input.initialAmount < 0) {
    errors.initialAmount = "O valor já disponível não pode ser negativo.";
  }
  if (
    !Number.isFinite(input.period) ||
    !Number.isInteger(input.period) ||
    input.period <= 0
  ) {
    errors.period = "Informe um prazo válido: um número inteiro maior que zero.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A rentabilidade não pode ser negativa.";
  }
  if (
    Number.isFinite(input.goal) &&
    Number.isFinite(input.initialAmount) &&
    input.initialAmount > input.goal
  ) {
    errors.initialAmount = "O valor já disponível não pode ser maior que a meta.";
  }

  return errors;
}

export function isSavingsGoalInputValid(input: SavingsGoalInput): boolean {
  return Object.keys(validateSavingsGoalInput(input)).length === 0;
}

/**
 * Calcula o aporte mensal necessário para atingir a meta. Assume que
 * `input` já foi validado (ver validateSavingsGoalInput).
 */
export function calculateSavingsGoal(input: SavingsGoalInput): SavingsGoalResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const totalMonths = input.periodType === "meses" ? input.period : input.period * 12;

  let requiredContribution: number;

  if (monthlyRate === 0) {
    requiredContribution = (input.goal - input.initialAmount) / totalMonths;
  } else {
    const growthFactor = Math.pow(1 + monthlyRate, totalMonths);
    const futureValueOfInitial = input.initialAmount * growthFactor;
    const annuityFactor = (growthFactor - 1) / monthlyRate;
    requiredContribution = (input.goal - futureValueOfInitial) / annuityFactor;
  }

  const goalAlreadyReachable = requiredContribution <= 0;
  const headline = Math.max(requiredContribution, 0);
  const totalContributed = headline * totalMonths;
  const estimatedYield = input.goal - input.initialAmount - totalContributed;

  return {
    headline,
    totalContributed,
    estimatedYield,
    monthlyRate,
    totalMonths,
    goalAlreadyReachable,
  };
}
