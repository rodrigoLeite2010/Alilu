/**
 * Lógica de cálculo da Calculadora de Margem de Lucro, isolada da interface
 * (ver PROMPT MESTRE, seção 14). Todo o processamento é síncrono e
 * client-side.
 *
 * Diferente da Calculadora de Markup (que FORMA um preço de venda a partir
 * do custo e de percentuais desejados), esta ferramenta ANALISA um custo e
 * um preço de venda já existentes:
 *
 *   lucro (R$)        = precoVenda - custo
 *   margem de lucro %  = lucro / precoVenda * 100   (lucro sobre o preço de venda)
 *   markup %           = lucro / custo * 100         (quanto o preço está acima do custo)
 *
 * Margem e markup são conceitos diferentes mesmo usando os mesmos números de
 * entrada — por isso os dois são exibidos lado a lado, evitando a confusão
 * comum entre eles.
 */

export interface ProfitMarginInput {
  /** Custo do produto/serviço (R$). */
  cost: number;
  /** Preço de venda praticado (R$). */
  salePrice: number;
}

export interface ProfitMarginFieldErrors {
  cost?: string;
  salePrice?: string;
}

export interface ProfitMarginResult {
  /** Margem de lucro sobre o preço de venda (%) — resultado principal. */
  headline: number;
  /** Lucro em valor absoluto (R$). Pode ser negativo (prejuízo). */
  profitAmount: number;
  /** Markup equivalente: quanto o preço de venda está acima do custo (%). */
  markupPercent: number;
}

export function validateProfitMarginInput(
  input: ProfitMarginInput
): ProfitMarginFieldErrors {
  const errors: ProfitMarginFieldErrors = {};

  if (!Number.isFinite(input.cost) || input.cost <= 0) {
    errors.cost = "Informe um custo maior que zero.";
  }
  if (!Number.isFinite(input.salePrice) || input.salePrice <= 0) {
    errors.salePrice = "Informe um preço de venda maior que zero.";
  }

  return errors;
}

export function isProfitMarginInputValid(input: ProfitMarginInput): boolean {
  return Object.keys(validateProfitMarginInput(input)).length === 0;
}

/**
 * Calcula a margem de lucro e o markup equivalente. Assume que `input` já
 * foi validado (ver validateProfitMarginInput). Preço de venda menor que o
 * custo é matematicamente válido (resulta em margem/lucro negativos —
 * prejuízo) e não é bloqueado pela validação.
 */
export function calculateProfitMargin(
  input: ProfitMarginInput
): ProfitMarginResult {
  const profitAmount = input.salePrice - input.cost;
  const headline = (profitAmount / input.salePrice) * 100;
  const markupPercent = (profitAmount / input.cost) * 100;

  return { headline, profitAmount, markupPercent };
}
