/**
 * Lógica de cálculo da Calculadora de Markup, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side.
 *
 * Usa o método do "markup divisor", o mais usado no varejo/serviços
 * brasileiro para formar preço de venda a partir do custo: despesas
 * variáveis (impostos, comissões, taxas de cartão), despesas fixas
 * (rateadas) e a margem de lucro desejada são todas expressas como
 * percentual do PREÇO DE VENDA (não do custo) — por isso não podem
 * simplesmente ser somadas ao custo.
 *
 *   divisor = (100 - despesasVariaveis% - despesasFixas% - margemDesejada%) / 100
 *   precoVenda = custo / divisor
 *
 * Quando a soma dos percentuais chega a 100% ou mais, não existe preço de
 * venda finito que cubra tudo isso (o divisor fica zero ou negativo) — a
 * entrada é inválida.
 */

export interface MarkupInput {
  /** Custo do produto/serviço (R$). */
  cost: number;
  /** Despesas variáveis sobre o preço de venda: impostos, comissões, taxas de cartão etc. (%) */
  variableExpenses: number;
  /** Despesas fixas rateadas sobre o preço de venda (%) */
  fixedExpenses: number;
  /** Margem de lucro desejada sobre o preço de venda (%) */
  desiredMargin: number;
}

export interface MarkupFieldErrors {
  cost?: string;
  variableExpenses?: string;
  fixedExpenses?: string;
  desiredMargin?: string;
}

export interface MarkupResult {
  /** Preço de venda sugerido. */
  headline: number;
  /** Divisor de markup usado (0 a 1). */
  divisor: number;
  /** Markup multiplicador equivalente (preço de venda / custo). */
  multiplier: number;
  /** Valor de lucro embutido no preço de venda (R$). */
  profitAmount: number;
  /** Soma dos percentuais informados (despesas + margem). */
  totalPercent: number;
}

export function validateMarkupInput(input: MarkupInput): MarkupFieldErrors {
  const errors: MarkupFieldErrors = {};

  if (!Number.isFinite(input.cost) || input.cost <= 0) {
    errors.cost = "Informe um custo maior que zero.";
  }
  if (!Number.isFinite(input.variableExpenses) || input.variableExpenses < 0) {
    errors.variableExpenses = "As despesas variáveis não podem ser negativas.";
  }
  if (!Number.isFinite(input.fixedExpenses) || input.fixedExpenses < 0) {
    errors.fixedExpenses = "As despesas fixas não podem ser negativas.";
  }
  if (!Number.isFinite(input.desiredMargin) || input.desiredMargin < 0) {
    errors.desiredMargin = "A margem de lucro desejada não pode ser negativa.";
  }

  const total =
    (Number.isFinite(input.variableExpenses) ? input.variableExpenses : 0) +
    (Number.isFinite(input.fixedExpenses) ? input.fixedExpenses : 0) +
    (Number.isFinite(input.desiredMargin) ? input.desiredMargin : 0);

  if (total >= 100) {
    errors.desiredMargin =
      "A soma das despesas com a margem desejada precisa ser menor que 100%.";
  }

  return errors;
}

export function isMarkupInputValid(input: MarkupInput): boolean {
  return Object.keys(validateMarkupInput(input)).length === 0;
}

/**
 * Calcula o preço de venda pelo método do markup divisor. Assume que
 * `input` já foi validado (ver validateMarkupInput).
 */
export function calculateMarkup(input: MarkupInput): MarkupResult {
  const totalPercent =
    input.variableExpenses + input.fixedExpenses + input.desiredMargin;
  const divisor = (100 - totalPercent) / 100;
  const headline = input.cost / divisor;
  const multiplier = headline / input.cost;
  const profitAmount = headline * (input.desiredMargin / 100);

  return {
    headline,
    divisor,
    multiplier,
    profitAmount,
    totalPercent,
  };
}
