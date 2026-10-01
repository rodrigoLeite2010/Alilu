// Matemática comercial da ferramenta "imagem → vídeo com IA" (pura).
import { describe, expect, it } from "vitest";
import {
  analyzePackage,
  costBreakdown,
  economicsForCredits,
  providerCostUsd,
  salePriceForMargin,
  suggestedCreditCost,
  worstCostPerCredit,
} from "@/lib/ai-video/pricing";
import type { AiPricingConfig, AiVideoModelPricing } from "@/lib/ai-video/types";

const config: AiPricingConfig = {
  id: "cfg",
  creditValueBrl: 0.04,
  targetGrossMarginPct: 50,
  minimumGrossMarginPct: 40,
  usdBrlReferenceRate: 5.5,
  providerCostSafetyMultiplier: 1.2,
  paymentFeePct: 5,
  taxPct: 0,
  infraCostBrlPerGeneration: 0.15,
  welcomeBonusCredits: 100,
  maxProviderCostUsd: 1.5,
  dailyProviderSpendLimitUsd: 50,
  monthlyProviderSpendLimitUsd: 500,
  maxGenerationsPerUserPerHour: 10,
  moderationStrikesBeforeBlock: 3,
  moderationBlockHours: 24,
  retentionDaysFree: 7,
  retentionDaysPaid: 30,
  purchaseRefundWindowDays: 7,
  retryDiscountPct: 50,
  maxRetriesPerGeneration: 3,
  postprocessCostBrl: 0,
  issueReviewThreshold: 5,
  effectiveFrom: "2026-10-01T00:00:00.000Z",
};

function row(overrides: Partial<AiVideoModelPricing> = {}): AiVideoModelPricing {
  return {
    id: "row",
    tier: "ECONOMICO",
    provider: "runway",
    providerModel: "gen4_turbo",
    friendlyName: "Econômico",
    resolution: "720p",
    durationSeconds: 5,
    providerCreditsPerSecond: 5,
    providerFixedCredits: 0,
    providerCreditUsd: 0.01,
    aliluCreditCost: 100,
    isActive: true,
    ...overrides,
  };
}

describe("custos e margem", () => {
  it("custo do provedor = créditos/s × duração × US$/crédito", () => {
    expect(providerCostUsd(row())).toBeCloseTo(0.25);
    expect(providerCostUsd(row({ providerModel: "gen4.5", providerCreditsPerSecond: 12, durationSeconds: 10 }))).toBeCloseTo(1.2);
  });

  it("custo total aplica câmbio, multiplicador de segurança e infraestrutura", () => {
    const costs = costBreakdown(config, row());
    expect(costs.providerCostBrl).toBeCloseTo(1.375);
    expect(costs.protectedProviderCostBrl).toBeCloseTo(1.65);
    expect(costs.totalCostBrl).toBeCloseTo(1.8);
  });

  it("preço para a margem usa margem sobre a venda, não markup", () => {
    const noFees = { ...config, paymentFeePct: 0 };
    expect(salePriceForMargin(noFees, 1.8)).toBeCloseTo(3.6);
    expect(salePriceForMargin(config, 1.8)).toBeCloseTo(4.0);
    expect(salePriceForMargin({ ...config, paymentFeePct: 60 }, 1.8)).toBeNull();
  });

  it("créditos sugeridos batem com a tabela inicial (múltiplos de 5)", () => {
    expect(suggestedCreditCost(config, row())).toBe(100);
    expect(suggestedCreditCost(config, row({ durationSeconds: 10 }))).toBe(195);
    expect(suggestedCreditCost(config, row({ providerCreditsPerSecond: 12 }))).toBe(230);
    expect(suggestedCreditCost(config, row({ providerCreditsPerSecond: 12, durationSeconds: 10 }))).toBe(450);
  });

  it("margem de uma geração cobrando N créditos", () => {
    const econ = economicsForCredits(config, row(), 100);
    expect(econ.revenueBrl).toBeCloseTo(4);
    expect(econ.netRevenueBrl).toBeCloseTo(3.8);
    expect(econ.grossProfitBrl).toBeCloseTo(2);
    expect(econ.grossMarginPct).toBeCloseTo(50);
    expect(economicsForCredits(config, row(), 50).grossMarginPct).toBeLessThan(config.minimumGrossMarginPct);
  });
});

describe("pacotes", () => {
  const rows = [
    row({ aliluCreditCost: 100 }),
    row({ durationSeconds: 10, aliluCreditCost: 195 }),
    row({ providerCreditsPerSecond: 12, aliluCreditCost: 230 }),
    row({ providerCreditsPerSecond: 12, durationSeconds: 10, aliluCreditCost: 450 }),
    row({ providerCreditsPerSecond: 100, aliluCreditCost: 1, isActive: false }),
  ];

  it("o pior custo por crédito ignora modelos inativos", () => {
    const worst = worstCostPerCredit(config, rows);
    expect(worst).toBeGreaterThan(0.017);
    expect(worst).toBeLessThan(0.02);
  });

  it("os três pacotes iniciais ficam acima da margem mínima (Pro com preço reajustado)", () => {
    const worst = worstCostPerCredit(config, rows);
    for (const priceCents of [1990, 4990]) {
      const credits = priceCents === 1990 ? 500 : 1500;
      expect(analyzePackage(config, { credits, bonusCredits: 0, priceCents }, worst).belowMinimum).toBe(false);
    }
    const pro = analyzePackage(config, { credits: 5000, bonusCredits: 0, priceCents: 16490 }, worst);
    expect(pro.belowMinimum).toBe(false);
    expect(pro.worstCaseMarginPct).toBeGreaterThan(40);
    // O preço antigo do Pro ficava abaixo da mínima.
    expect(analyzePackage(config, { credits: 5000, bonusCredits: 0, priceCents: 14990 }, worst).belowMinimum).toBe(true);
  });
});
