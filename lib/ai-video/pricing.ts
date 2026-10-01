import type { AiCreditPackage, AiPricingConfig, AiVideoModelPricing } from "./types";

/**
 * Matemática comercial da ferramenta de vídeo com IA — pura, sem banco
 * (testável e reaproveitada pelo simulador do admin na própria tela).
 *
 * MARGEM BRUTA DE VERDADE (sobre a venda), nunca "custo + X%":
 *
 *   custoProvedorBRL = custoUSD × câmbio de referência
 *   custoProtegido   = custoProvedorBRL × multiplicador de segurança
 *   custoTotal       = custoProtegido + infraestrutura por geração
 *   receitaLíquida   = receita × (1 − taxa de pagamento − imposto)
 *   margem           = (receitaLíquida − custoTotal) / receita
 *   preçoParaMargem  = custoTotal / (1 − taxa − imposto − margemAlvo)
 *
 * Ex.: custoTotal R$ 1,80, margem 50%, sem taxas → R$ 3,60 (não R$ 2,70).
 */

const pct = (value: number) => value / 100;

export function providerCostUsd(row: Pick<AiVideoModelPricing, "providerCreditsPerSecond" | "providerFixedCredits" | "providerCreditUsd" | "durationSeconds">): number {
  return (row.providerCreditsPerSecond * row.durationSeconds + row.providerFixedCredits) * row.providerCreditUsd;
}

export interface CostBreakdown {
  providerCostUsd: number;
  providerCostBrl: number;
  protectedProviderCostBrl: number;
  infraCostBrl: number;
  totalCostBrl: number;
}

export function costBreakdown(config: AiPricingConfig, row: AiVideoModelPricing): CostBreakdown {
  const usd = providerCostUsd(row);
  const providerCostBrl = usd * config.usdBrlReferenceRate;
  const protectedProviderCostBrl = providerCostBrl * config.providerCostSafetyMultiplier;
  return {
    providerCostUsd: usd,
    providerCostBrl,
    protectedProviderCostBrl,
    infraCostBrl: config.infraCostBrlPerGeneration,
    totalCostBrl: protectedProviderCostBrl + config.infraCostBrlPerGeneration,
  };
}

/** Parte da receita que sobra depois da taxa de pagamento e dos impostos (0..1). */
export function netRevenueFactor(config: AiPricingConfig): number {
  return 1 - pct(config.paymentFeePct) - pct(config.taxPct);
}

/** Preço de venda (R$) que dá exatamente a margem alvo. `null` se a combinação de taxas + margem for impossível (≥ 100%). */
export function salePriceForMargin(config: AiPricingConfig, totalCostBrl: number, marginPct = config.targetGrossMarginPct): number | null {
  const denominator = netRevenueFactor(config) - pct(marginPct);
  if (denominator <= 0) return null;
  return totalCostBrl / denominator;
}

/** Créditos sugeridos para a margem alvo — arredondados para cima, em múltiplos de 5. */
export function suggestedCreditCost(config: AiPricingConfig, row: AiVideoModelPricing): number | null {
  const price = salePriceForMargin(config, costBreakdown(config, row).totalCostBrl);
  if (price === null || config.creditValueBrl <= 0) return null;
  return Math.max(5, Math.ceil(price / config.creditValueBrl / 5) * 5);
}

export interface GenerationEconomics extends CostBreakdown {
  credits: number;
  revenueBrl: number;
  netRevenueBrl: number;
  grossProfitBrl: number;
  grossMarginPct: number;
}

/** Quanto uma geração cobrando `credits` créditos rende — usado na geração real e no simulador ("e se eu cobrar 80?"). */
export function economicsForCredits(
  config: AiPricingConfig,
  row: AiVideoModelPricing,
  credits: number,
  creditValueBrl = config.creditValueBrl,
): GenerationEconomics {
  const costs = costBreakdown(config, row);
  const revenueBrl = credits * creditValueBrl;
  const netRevenueBrl = revenueBrl * netRevenueFactor(config);
  const grossProfitBrl = netRevenueBrl - costs.totalCostBrl;
  return {
    ...costs,
    credits,
    revenueBrl,
    netRevenueBrl,
    grossProfitBrl,
    grossMarginPct: revenueBrl > 0 ? (grossProfitBrl / revenueBrl) * 100 : -Infinity,
  };
}

/**
 * "Gerar novamente com desconto": preço cheio × (1 − desconto), em
 * múltiplos de 5 — mas NUNCA abaixo do custo (o desconto é limitado ao
 * ponto de equilíbrio: lucro bruto ≥ 0). Nunca acima do preço cheio.
 */
export function retryCreditCost(config: AiPricingConfig, row: AiVideoModelPricing, listCredits = row.aliluCreditCost): number {
  const discounted = Math.ceil((listCredits * (1 - pct(config.retryDiscountPct))) / 5) * 5;
  let credits = Math.max(5, discounted);
  while (credits < listCredits && economicsForCredits(config, row, credits).grossProfitBrl < 0) credits += 5;
  return Math.min(credits, listCredits);
}

/** Custo total (R$) por crédito Alilu cobrado — o pior caso entre os modelos ativos decide a margem dos pacotes. */
export function worstCostPerCredit(config: AiPricingConfig, rows: AiVideoModelPricing[]): number {
  return rows
    .filter((row) => row.isActive && row.aliluCreditCost > 0)
    .reduce((worst, row) => Math.max(worst, costBreakdown(config, row).totalCostBrl / row.aliluCreditCost), 0);
}

export interface PackageAnalysis {
  totalCredits: number;
  priceBrl: number;
  pricePerCreditBrl: number;
  /** Margem bruta do pacote no pior modelo ativo, já descontando taxa de pagamento e impostos. */
  worstCaseMarginPct: number;
  belowMinimum: boolean;
  /** Preço mínimo (R$) para o pacote ficar na margem mínima. */
  minimumPriceBrl: number | null;
}

export function analyzePackage(
  config: AiPricingConfig,
  pkg: Pick<AiCreditPackage, "credits" | "bonusCredits" | "priceCents">,
  costPerCredit: number,
): PackageAnalysis {
  const totalCredits = pkg.credits + pkg.bonusCredits;
  const priceBrl = pkg.priceCents / 100;
  const pricePerCreditBrl = totalCredits > 0 ? priceBrl / totalCredits : 0;
  const net = pricePerCreditBrl * netRevenueFactor(config);
  const worstCaseMarginPct = pricePerCreditBrl > 0 ? ((net - costPerCredit) / pricePerCreditBrl) * 100 : -Infinity;
  const minPricePerCredit = salePriceForMargin(config, costPerCredit, config.minimumGrossMarginPct);
  return {
    totalCredits,
    priceBrl,
    pricePerCreditBrl,
    worstCaseMarginPct,
    belowMinimum: worstCaseMarginPct < config.minimumGrossMarginPct,
    minimumPriceBrl: minPricePerCredit === null ? null : minPricePerCredit * totalCredits,
  };
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
