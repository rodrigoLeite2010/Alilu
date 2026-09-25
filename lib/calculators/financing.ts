/**
 * Lógica de cálculo do Simulador de Financiamento SAC x Price (ETAPA 4),
 * isolada da interface (PROMPT MESTRE, seção 14). Todo o processamento é
 * síncrono e client-side: nenhum valor digitado é enviado para servidor ou
 * armazenado.
 *
 * SISTEMAS:
 * - PRICE (prestação constante / "Tabela Price"): a prestação é a mesma em
 *   todas as parcelas; a composição entre juros e amortização muda mês a
 *   mês (mais juros no início, mais amortização no fim).
 * - SAC (Sistema de Amortização Constante): a amortização é a mesma em
 *   todas as parcelas; a prestação diminui ao longo do financiamento, pois
 *   os juros incidem sobre um saldo devedor cada vez menor.
 *
 * Em ambos os sistemas, os juros de cada parcela incidem sobre o saldo
 * devedor no INÍCIO daquele mês (juros calculados antes da amortização do
 * próprio mês ser aplicada) — a mesma convenção usada pela Calculadora de
 * Juros Compostos (ETAPA 3) para o rendimento mensal.
 *
 * Nenhum valor é arredondado durante o cálculo — arredondamento/formatação
 * (ex.: formatCurrencyBRL) deve acontecer somente na exibição.
 */

export type FinancingSystem = "price" | "sac" | "comparar";
export type FinancingRateType = "mensal" | "anual";

/**
 * Limite de parcelas aceito pela simulação. Não é uma regra de negócio de
 * nenhum sistema de amortização real — é só um teto razoável para evitar
 * tabelas de amortização gigantes (problemas de performance/UI), bem acima
 * de qualquer financiamento comum (50 anos de parcelas mensais).
 */
export const MAX_INSTALLMENTS = 600;

export interface FinancingInput {
  /** Valor do bem financiado (R$). */
  assetValue: number;
  /** Entrada (R$), opcional (0 = sem entrada). */
  downPayment: number;
  /** Taxa de juros informada (ex.: 1.5 representa 1,5%). */
  rate: number;
  /** Se a taxa informada é mensal ou anual. */
  rateType: FinancingRateType;
  /** Número de parcelas, sempre um número inteiro positivo. */
  installments: number;
  /** Sistema de amortização a simular. */
  system: FinancingSystem;
}

export interface FinancingFieldErrors {
  assetValue?: string;
  downPayment?: string;
  rate?: string;
  installments?: string;
}

/** Uma linha da tabela de amortização (Price ou SAC). */
export interface FinancingInstallment {
  /** Número da parcela, começando em 1. */
  number: number;
  /** Valor da prestação (juros + amortização) desta parcela. */
  payment: number;
  /** Juros desta parcela, sobre o saldo devedor no início do mês. */
  interest: number;
  /** Amortização (redução do saldo devedor) desta parcela. */
  amortization: number;
  /** Saldo devedor ao final desta parcela. */
  balance: number;
}

export interface FinancingSystemResult {
  system: "price" | "sac";
  /** Valor financiado (igual em Price e SAC, para o mesmo cenário). */
  financedAmount: number;
  /** Valor da primeira parcela. */
  firstPayment: number;
  /** Valor da última parcela. */
  lastPayment: number;
  /** Soma de todas as prestações pagas. */
  totalPaid: number;
  /** Total de juros pagos (totalPaid - financedAmount). */
  totalInterest: number;
  /** Tabela de amortização completa, mês a mês. */
  installments: FinancingInstallment[];
}

export interface FinancingResult {
  assetValue: number;
  downPayment: number;
  /** Valor financiado = valor do bem - entrada. */
  financedAmount: number;
  /** Taxa mensal efetivamente usada no cálculo (após conversão, se anual). */
  monthlyRate: number;
  installmentsCount: number;
  system: FinancingSystem;
  /** Presente quando system é "price" ou "comparar". */
  price?: FinancingSystemResult;
  /** Presente quando system é "sac" ou "comparar". */
  sac?: FinancingSystemResult;
}

/**
 * Valida os campos do simulador. Retorna um objeto com uma mensagem por
 * campo inválido (vazio = tudo válido). Não faz nenhum cálculo.
 */
export function validateFinancingInput(
  input: FinancingInput
): FinancingFieldErrors {
  const errors: FinancingFieldErrors = {};

  const hasValidAssetValue =
    Number.isFinite(input.assetValue) && input.assetValue > 0;
  const hasValidDownPayment =
    Number.isFinite(input.downPayment) && input.downPayment >= 0;

  if (!hasValidAssetValue) {
    errors.assetValue = "Informe um valor do bem maior que zero.";
  }

  if (!hasValidDownPayment) {
    errors.downPayment = "A entrada não pode ser negativa.";
  }

  if (
    hasValidAssetValue &&
    hasValidDownPayment &&
    input.downPayment >= input.assetValue
  ) {
    errors.downPayment = "A entrada deve ser menor que o valor do bem.";
  }

  if (!Number.isFinite(input.rate) || input.rate < 0) {
    errors.rate = "A taxa de juros não pode ser negativa.";
  }

  if (
    !Number.isFinite(input.installments) ||
    !Number.isInteger(input.installments) ||
    input.installments <= 0
  ) {
    errors.installments =
      "Informe um número de parcelas válido: um número inteiro maior que zero.";
  } else if (input.installments > MAX_INSTALLMENTS) {
    errors.installments = `O número de parcelas não pode ser maior que ${MAX_INSTALLMENTS}.`;
  }

  return errors;
}

export function isFinancingInputValid(input: FinancingInput): boolean {
  return Object.keys(validateFinancingInput(input)).length === 0;
}

/** Converte a taxa informada (mensal ou anual) para a taxa mensal equivalente. */
export function toMonthlyRate(
  rate: number,
  rateType: FinancingRateType
): number {
  const rateFraction = rate / 100;
  if (rateType === "mensal") {
    return rateFraction;
  }
  // Taxa anual -> taxa mensal equivalente (juros compostos): (1+i_anual)^(1/12) - 1.
  return Math.pow(1 + rateFraction, 1 / 12) - 1;
}

/**
 * Prestação constante da Tabela Price para um valor financiado, taxa mensal
 * e número de parcelas — a mesma fórmula financeira padrão (PMT). Extraída
 * como função pura e exportada porque o cluster de Financiamento de
 * Veículos (lib/calculators/vehicle-financing.ts) reaproveita exatamente
 * este cálculo (e o seu inverso, o valor presente) em várias ferramentas —
 * nunca duplicar esta fórmula em outro arquivo. Com taxa zero, a prestação
 * é simplesmente o valor financiado dividido pelo número de parcelas.
 */
export function calculatePricePayment(
  financedAmount: number,
  monthlyRate: number,
  installmentsCount: number
): number {
  if (monthlyRate === 0) {
    return financedAmount / installmentsCount;
  }
  return (
    (financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, installmentsCount))) /
    (Math.pow(1 + monthlyRate, installmentsCount) - 1)
  );
}

/**
 * Valor presente de uma prestação constante (o inverso de
 * calculatePricePayment): quanto é possível financiar, a uma taxa mensal e
 * número de parcelas dados, para chegar numa prestação-alvo. Usado pelo
 * cluster de Financiamento de Veículos para "quanto cabe no bolso" e
 * "quanto preciso dar de entrada" (ambos perguntam o inverso do PMT).
 */
export function calculatePresentValueFromPayment(
  payment: number,
  monthlyRate: number,
  installmentsCount: number
): number {
  if (monthlyRate === 0) {
    return payment * installmentsCount;
  }
  return (payment * (Math.pow(1 + monthlyRate, installmentsCount) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, installmentsCount));
}

/**
 * Tabela de amortização pela Tabela Price: prestação constante, calculada
 * por calculatePricePayment (acima).
 */
function buildPriceInstallments(
  financedAmount: number,
  monthlyRate: number,
  installmentsCount: number
): FinancingInstallment[] {
  const payment = calculatePricePayment(financedAmount, monthlyRate, installmentsCount);

  const rows: FinancingInstallment[] = [];
  let balance = financedAmount;

  for (let number = 1; number <= installmentsCount; number += 1) {
    const interest = balance * monthlyRate;
    const amortization = payment - interest;
    balance -= amortization;
    // Normaliza o resíduo de ponto flutuante da última parcela: depois de N
    // subtrações sucessivas, o saldo teoricamente zerado pode terminar como
    // um valor ínfimo (ex.: -1,8e-12) em vez de exatamente 0. Isso não é só
    // um problema de exibição — deixaria o saldo "quitado" tecnicamente
    // diferente de zero.
    const normalizedBalance = number === installmentsCount ? 0 : balance;
    rows.push({ number, payment, interest, amortization, balance: normalizedBalance });
  }

  return rows;
}

/**
 * Tabela de amortização pelo SAC: amortização constante (valor financiado /
 * número de parcelas); a prestação diminui a cada mês, pois os juros
 * incidem sobre um saldo devedor decrescente.
 */
function buildSacInstallments(
  financedAmount: number,
  monthlyRate: number,
  installmentsCount: number
): FinancingInstallment[] {
  const amortization = financedAmount / installmentsCount;
  const rows: FinancingInstallment[] = [];
  let balance = financedAmount;

  for (let number = 1; number <= installmentsCount; number += 1) {
    const interest = balance * monthlyRate;
    const payment = amortization + interest;
    balance -= amortization;
    // Mesma normalização do resíduo de ponto flutuante aplicada em
    // buildPriceInstallments — ver comentário lá.
    const normalizedBalance = number === installmentsCount ? 0 : balance;
    rows.push({ number, payment, interest, amortization, balance: normalizedBalance });
  }

  return rows;
}

function buildSystemResult(
  system: "price" | "sac",
  financedAmount: number,
  installments: FinancingInstallment[]
): FinancingSystemResult {
  const firstPayment = installments[0]?.payment ?? 0;
  const lastPayment = installments[installments.length - 1]?.payment ?? 0;
  const totalPaid = installments.reduce((sum, row) => sum + row.payment, 0);
  const totalInterest = installments.reduce(
    (sum, row) => sum + row.interest,
    0
  );

  return {
    system,
    financedAmount,
    firstPayment,
    lastPayment,
    totalPaid,
    totalInterest,
    installments,
  };
}

/**
 * Calcula a simulação completa de financiamento. Assume que `input` já foi
 * validado (ver validateFinancingInput) — não lança erro para entradas
 * inválidas, mas o resultado não tem significado para elas.
 */
export function calculateFinancing(input: FinancingInput): FinancingResult {
  const financedAmount = input.assetValue - input.downPayment;
  const monthlyRate = toMonthlyRate(input.rate, input.rateType);
  const installmentsCount = input.installments;

  const wantsPrice = input.system === "price" || input.system === "comparar";
  const wantsSac = input.system === "sac" || input.system === "comparar";

  const price = wantsPrice
    ? buildSystemResult(
        "price",
        financedAmount,
        buildPriceInstallments(financedAmount, monthlyRate, installmentsCount)
      )
    : undefined;

  const sac = wantsSac
    ? buildSystemResult(
        "sac",
        financedAmount,
        buildSacInstallments(financedAmount, monthlyRate, installmentsCount)
      )
    : undefined;

  return {
    assetValue: input.assetValue,
    downPayment: input.downPayment,
    financedAmount,
    monthlyRate,
    installmentsCount,
    system: input.system,
    price,
    sac,
  };
}
