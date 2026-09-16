import type { CalculatorResult } from "@/lib/calculators/types";

/**
 * Lógica de cálculo da Calculadora de Juros Compostos (ETAPA 3), isolada da
 * interface (PROMPT MESTRE, seção 14). Todo o processamento é síncrono e
 * client-side: nenhum valor digitado é enviado para servidor ou armazenado.
 *
 * REGRA DO APORTE (documentada conforme exigido pela ETAPA 3): o aporte
 * mensal é considerado ao FINAL de cada mês — primeiro o saldo do início do
 * mês rende juros, depois o aporte do mês é somado. Ou seja, um aporte feito
 * no mês M só começa a render juros a partir do mês M+1 (modelo de
 * "anuidade postecipada", o mesmo usado pela fórmula clássica de valor
 * futuro com aportes). Essa regra é mantida em todo o arquivo.
 *
 * Nenhum valor é arredondado durante o cálculo — arredondamento/formatação
 * (ex.: formatCurrencyBRL) deve acontecer somente na exibição.
 */

export type CompoundInterestRateType = "mensal" | "anual";
export type CompoundInterestPeriodType = "meses" | "anos";

export interface CompoundInterestInput {
  /** Valor inicial (R$). Pode ser zero se houver aporte mensal > 0. */
  initialAmount: number;
  /** Aporte mensal (R$), opcional (0 = sem aporte). */
  monthlyContribution: number;
  /** Taxa de juros informada (ex.: 1.5 representa 1,5%). */
  rate: number;
  /** Se a taxa informada é mensal ou anual. */
  rateType: CompoundInterestRateType;
  /** Duração do período, sempre um número inteiro positivo. */
  period: number;
  /** Se o período informado é em meses ou em anos. */
  periodType: CompoundInterestPeriodType;
}

export interface CompoundInterestFieldErrors {
  initialAmount?: string;
  monthlyContribution?: string;
  rate?: string;
  period?: string;
}

/** Uma linha da tabela mês a mês exibida no resultado. */
export interface CompoundInterestMonth {
  /** Número do mês, começando em 1. */
  month: number;
  /** Saldo no início do mês (antes de render juros e do aporte). */
  startingBalance: number;
  /** Juros gerados neste mês, sobre o saldo inicial do mês. */
  interest: number;
  /** Aporte somado ao final deste mês. */
  contribution: number;
  /** Saldo ao final do mês (após juros e aporte). */
  endingBalance: number;
  /** Capital investido acumulado até este mês (valor inicial + aportes já feitos). */
  cumulativeInvested: number;
  /** Juros acumulados até este mês. */
  cumulativeInterest: number;
}

export interface CompoundInterestDetails {
  initialAmount: number;
  /** Soma de todos os aportes mensais (não inclui o valor inicial). */
  totalContributed: number;
  /** Capital total investido: valor inicial + total aportado (sem juros). */
  totalInvested: number;
  /** Juros acumulados: valor final - total investido. */
  totalInterest: number;
  /** Taxa mensal efetivamente usada no cálculo (após conversão, se anual). */
  monthlyRate: number;
  /** Quantidade total de meses simulados. */
  totalMonths: number;
}

export interface CompoundInterestResult
  extends CalculatorResult<CompoundInterestDetails> {
  /** Valor final do investimento (mesmo valor de `headline`). */
  finalAmount: number;
  months: CompoundInterestMonth[];
}

/**
 * Valida os campos da calculadora. Retorna um objeto com uma mensagem por
 * campo inválido (vazio = tudo válido). Não faz nenhum cálculo.
 */
export function validateCompoundInterestInput(
  input: CompoundInterestInput
): CompoundInterestFieldErrors {
  const errors: CompoundInterestFieldErrors = {};

  const hasValidInitial =
    Number.isFinite(input.initialAmount) && input.initialAmount >= 0;
  const hasValidContribution =
    Number.isFinite(input.monthlyContribution) &&
    input.monthlyContribution >= 0;

  if (!hasValidInitial) {
    errors.initialAmount = "O valor inicial não pode ser negativo.";
  }

  if (!hasValidContribution) {
    errors.monthlyContribution = "O aporte mensal não pode ser negativo.";
  }

  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }

  if (
    !Number.isFinite(input.period) ||
    !Number.isInteger(input.period) ||
    input.period <= 0
  ) {
    errors.period =
      "Informe um período válido: um número inteiro maior que zero.";
  }

  if (
    hasValidInitial &&
    hasValidContribution &&
    input.initialAmount === 0 &&
    input.monthlyContribution === 0
  ) {
    errors.initialAmount =
      "Informe um valor inicial ou um aporte mensal maior que zero.";
  }

  return errors;
}

export function isCompoundInterestInputValid(
  input: CompoundInterestInput
): boolean {
  return Object.keys(validateCompoundInterestInput(input)).length === 0;
}

/** Converte a taxa informada (mensal ou anual) para a taxa mensal equivalente. */
export function toMonthlyRate(
  rate: number,
  rateType: CompoundInterestRateType
): number {
  const rateFraction = rate / 100;
  if (rateType === "mensal") {
    return rateFraction;
  }
  // Taxa anual -> taxa mensal equivalente (juros compostos): (1+i_anual)^(1/12) - 1.
  return Math.pow(1 + rateFraction, 1 / 12) - 1;
}

/**
 * Calcula a evolução mês a mês do investimento e o resumo final. Assume que
 * `input` já foi validado (ver validateCompoundInterestInput) — não lança
 * erro para entradas inválidas, mas o resultado não tem significado para
 * elas.
 */
export function calculateCompoundInterest(
  input: CompoundInterestInput
): CompoundInterestResult {
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const totalMonths =
    input.periodType === "meses" ? input.period : input.period * 12;

  const months: CompoundInterestMonth[] = [];
  let balance = input.initialAmount;
  let cumulativeContributed = 0;

  for (let month = 1; month <= totalMonths; month += 1) {
    const startingBalance = balance;
    const interest = startingBalance * monthlyRate;
    const contribution = input.monthlyContribution;
    const endingBalance = startingBalance + interest + contribution;

    cumulativeContributed += contribution;
    const cumulativeInvested = input.initialAmount + cumulativeContributed;

    months.push({
      month,
      startingBalance,
      interest,
      contribution,
      endingBalance,
      cumulativeInvested,
      cumulativeInterest: endingBalance - cumulativeInvested,
    });

    balance = endingBalance;
  }

  const totalContributed = cumulativeContributed;
  const totalInvested = input.initialAmount + totalContributed;
  const finalAmount = balance;
  const totalInterest = finalAmount - totalInvested;

  return {
    headline: finalAmount,
    finalAmount,
    details: {
      initialAmount: input.initialAmount,
      totalContributed,
      totalInvested,
      totalInterest,
      monthlyRate,
      totalMonths,
    },
    assumptions: [
      "O aporte mensal é considerado ao final de cada mês (só passa a render juros a partir do mês seguinte).",
      "Esta é uma simulação matemática: os resultados não constituem promessa de rentabilidade.",
    ],
    months,
  };
}
