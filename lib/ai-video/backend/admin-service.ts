import "server-only";
import { getDb } from "@/lib/db/client";
import {
  analyzePackage,
  costBreakdown,
  economicsForCredits,
  suggestedCreditCost,
  worstCostPerCredit,
} from "../pricing";
import type { AiCreditPackage, AiPricingConfig, AiVideoModelPricing } from "../types";
import {
  getActivePricingConfig,
  getModelPricingById,
  insertPricingConfig,
  listModelPricing,
  listPackages,
  updateModelPricing,
  updatePackage,
  type AiPricingConfigInput,
} from "./pricing-repository";

/**
 * Admin > IA: precificação (com simulação de margem) e custos. Nada aqui
 * é exposto ao usuário comum — as rotas/páginas checam ADMIN_EMAILS.
 */

export class AdminPricingError extends Error {}

export interface ModelPricingView {
  row: AiVideoModelPricing;
  providerCostUsd: number;
  providerCostBrl: number;
  protectedCostBrl: number;
  totalCostBrl: number;
  salePriceBrl: number;
  grossMarginPct: number;
  suggestedCredits: number | null;
}

export interface PackageView {
  pkg: AiCreditPackage;
  priceBrl: number;
  pricePerCreditBrl: number;
  worstCaseMarginPct: number;
  belowMinimum: boolean;
  minimumPriceBrl: number | null;
}

export interface PricingAdminView {
  config: AiPricingConfig;
  models: ModelPricingView[];
  packages: PackageView[];
  provider: { provider: string; currentEstimatedBalanceUsd: number | null; autoRechargeEnabled: boolean; lowBalanceThresholdUsd: number } | null;
}

export async function getPricingAdminView(): Promise<PricingAdminView> {
  const [config, rows, packages] = await Promise.all([getActivePricingConfig(), listModelPricing(), listPackages()]);
  const costPerCredit = worstCostPerCredit(config, rows);
  const db = getDb();
  const providerRows = await db`select * from ai_provider_accounts where provider = 'runway'`;
  return {
    config,
    models: rows.map((row) => {
      const costs = costBreakdown(config, row);
      const economics = economicsForCredits(config, row, row.aliluCreditCost);
      return {
        row,
        providerCostUsd: costs.providerCostUsd,
        providerCostBrl: costs.providerCostBrl,
        protectedCostBrl: costs.protectedProviderCostBrl,
        totalCostBrl: costs.totalCostBrl,
        salePriceBrl: economics.revenueBrl,
        grossMarginPct: economics.grossMarginPct,
        suggestedCredits: suggestedCreditCost(config, row),
      };
    }),
    packages: packages.map((pkg) => ({ pkg, ...analyzePackage(config, pkg, costPerCredit) })),
    provider: providerRows[0]
      ? {
          provider: providerRows[0].provider as string,
          currentEstimatedBalanceUsd:
            providerRows[0].current_estimated_balance_usd === null ? null : Number(providerRows[0].current_estimated_balance_usd),
          autoRechargeEnabled: Boolean(providerRows[0].auto_recharge_enabled),
          lowBalanceThresholdUsd: Number(providerRows[0].low_balance_threshold_usd),
        }
      : null,
  };
}

function assertFiniteRange(value: unknown, min: number, max: number, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new AdminPricingError(`${label}: valor inválido (entre ${min} e ${max}).`);
  }
  return number;
}

/** Nova versão da regra comercial (validada). */
export async function updatePricingConfig(input: Record<string, unknown>): Promise<void> {
  const current = await getActivePricingConfig();
  const merged: AiPricingConfigInput = {
    creditValueBrl: assertFiniteRange(input.creditValueBrl ?? current.creditValueBrl, 0.001, 10, "Valor do crédito"),
    targetGrossMarginPct: assertFiniteRange(input.targetGrossMarginPct ?? current.targetGrossMarginPct, 0, 95, "Margem alvo"),
    minimumGrossMarginPct: assertFiniteRange(input.minimumGrossMarginPct ?? current.minimumGrossMarginPct, 0, 95, "Margem mínima"),
    usdBrlReferenceRate: assertFiniteRange(input.usdBrlReferenceRate ?? current.usdBrlReferenceRate, 1, 50, "Câmbio"),
    providerCostSafetyMultiplier: assertFiniteRange(input.providerCostSafetyMultiplier ?? current.providerCostSafetyMultiplier, 1, 5, "Multiplicador de segurança"),
    paymentFeePct: assertFiniteRange(input.paymentFeePct ?? current.paymentFeePct, 0, 30, "Taxa de pagamento"),
    taxPct: assertFiniteRange(input.taxPct ?? current.taxPct, 0, 50, "Impostos"),
    infraCostBrlPerGeneration: assertFiniteRange(input.infraCostBrlPerGeneration ?? current.infraCostBrlPerGeneration, 0, 100, "Infraestrutura"),
    welcomeBonusCredits: Math.round(assertFiniteRange(input.welcomeBonusCredits ?? current.welcomeBonusCredits, 0, 10000, "Bônus")),
    maxProviderCostUsd: assertFiniteRange(input.maxProviderCostUsd ?? current.maxProviderCostUsd, 0.01, 100, "Custo máximo por geração"),
    dailyProviderSpendLimitUsd: assertFiniteRange(input.dailyProviderSpendLimitUsd ?? current.dailyProviderSpendLimitUsd, 0, 100000, "Limite diário"),
    monthlyProviderSpendLimitUsd: assertFiniteRange(input.monthlyProviderSpendLimitUsd ?? current.monthlyProviderSpendLimitUsd, 0, 1000000, "Limite mensal"),
    maxGenerationsPerUserPerHour: Math.round(assertFiniteRange(input.maxGenerationsPerUserPerHour ?? current.maxGenerationsPerUserPerHour, 1, 1000, "Gerações por hora")),
    moderationStrikesBeforeBlock: Math.round(assertFiniteRange(input.moderationStrikesBeforeBlock ?? current.moderationStrikesBeforeBlock, 1, 100, "Recusas antes do bloqueio")),
    moderationBlockHours: Math.round(assertFiniteRange(input.moderationBlockHours ?? current.moderationBlockHours, 1, 720, "Horas de bloqueio")),
    retentionDaysFree: Math.round(assertFiniteRange(input.retentionDaysFree ?? current.retentionDaysFree, 1, 365, "Retenção (grátis)")),
    retentionDaysPaid: Math.round(assertFiniteRange(input.retentionDaysPaid ?? current.retentionDaysPaid, 1, 365, "Retenção (pagos)")),
    purchaseRefundWindowDays: Math.round(assertFiniteRange(input.purchaseRefundWindowDays ?? current.purchaseRefundWindowDays, 7, 365, "Prazo de reembolso")),
  };
  if (merged.minimumGrossMarginPct > merged.targetGrossMarginPct) {
    throw new AdminPricingError("A margem mínima não pode ser maior que a margem alvo.");
  }
  await insertPricingConfig(merged);
}

/** Ajusta créditos/custo do provedor de um modelo — recusa ativar abaixo da margem mínima. */
export async function updateModelPricingAdmin(id: string, input: Record<string, unknown>): Promise<void> {
  const row = await getModelPricingById(id);
  if (!row) throw new AdminPricingError("Linha de preço não encontrada.");
  const config = await getActivePricingConfig();
  const aliluCreditCost = Math.round(assertFiniteRange(input.aliluCreditCost ?? row.aliluCreditCost, 1, 100000, "Créditos"));
  const providerCreditsPerSecond = assertFiniteRange(input.providerCreditsPerSecond ?? row.providerCreditsPerSecond, 0.01, 1000, "Créditos do provedor por segundo");
  const isActive = typeof input.isActive === "boolean" ? input.isActive : row.isActive;
  const economics = economicsForCredits(config, { ...row, providerCreditsPerSecond }, aliluCreditCost);
  if (isActive && economics.grossMarginPct < config.minimumGrossMarginPct) {
    throw new AdminPricingError(
      `Com ${aliluCreditCost} créditos a margem fica em ${economics.grossMarginPct.toFixed(1)}%, abaixo da mínima (${config.minimumGrossMarginPct}%).`,
    );
  }
  await updateModelPricing(id, { aliluCreditCost, isActive, providerCreditsPerSecond });
}

/** Ajusta um pacote — recusa ativar abaixo da margem mínima (pior modelo ativo). */
export async function updatePackageAdmin(id: string, input: Record<string, unknown>): Promise<void> {
  const packages = await listPackages();
  const pkg = packages.find((candidate) => candidate.id === id);
  if (!pkg) throw new AdminPricingError("Pacote não encontrado.");
  const config = await getActivePricingConfig();
  const credits = Math.round(assertFiniteRange(input.credits ?? pkg.credits, 1, 1_000_000, "Créditos"));
  const bonusCredits = Math.round(assertFiniteRange(input.bonusCredits ?? pkg.bonusCredits, 0, 1_000_000, "Bônus"));
  const priceCents = Math.round(assertFiniteRange(input.priceCents ?? pkg.priceCents, 100, 10_000_000, "Preço"));
  const isActive = typeof input.isActive === "boolean" ? input.isActive : pkg.isActive;
  const analysis = analyzePackage(config, { credits, bonusCredits, priceCents }, worstCostPerCredit(config, await listModelPricing()));
  if (isActive && analysis.belowMinimum) {
    throw new AdminPricingError(
      `Margem do pacote ficaria em ${analysis.worstCaseMarginPct.toFixed(1)}%, abaixo da mínima (${config.minimumGrossMarginPct}%). Preço mínimo: R$ ${analysis.minimumPriceBrl?.toFixed(2)}.`,
    );
  }
  await updatePackage(id, { credits, bonusCredits, priceCents, isActive });
}

export async function updateProviderAccountAdmin(input: Record<string, unknown>): Promise<void> {
  const db = getDb();
  const balance = input.currentEstimatedBalanceUsd === null || input.currentEstimatedBalanceUsd === undefined || input.currentEstimatedBalanceUsd === ""
    ? null
    : assertFiniteRange(input.currentEstimatedBalanceUsd, 0, 10_000_000, "Saldo");
  const threshold = assertFiniteRange(input.lowBalanceThresholdUsd ?? 20, 0, 1_000_000, "Limite de saldo baixo");
  const autoRecharge = Boolean(input.autoRechargeEnabled);
  await db`
    update ai_provider_accounts
    set current_estimated_balance_usd = ${balance}, low_balance_threshold_usd = ${threshold},
        auto_recharge_enabled = ${autoRecharge}, last_balance_check_at = now(), updated_at = now()
    where provider = 'runway'
  `;
}

export interface CostPeriodSummary {
  generations: number;
  completed: number;
  failed: number;
  creditsConsumed: number;
  creditsRefunded: number;
  revenueAllocatedBrl: number;
  apiCostBrl: number;
  paymentAndTaxBrl: number;
  failureCostBrl: number;
  grossProfitBrl: number;
  grossMarginPct: number;
  averageCostPerVideoBrl: number;
  averageGenerationSeconds: number | null;
  purchasesRevenueBrl: number;
  purchasesCount: number;
  providerSpendUsd: number;
}

export interface CostByModel {
  provider: string;
  model: string;
  generations: number;
  averageCostBrl: number;
  creditsConsumed: number;
  revenueBrl: number;
  grossProfitBrl: number;
  grossMarginPct: number;
}

async function summarize(since: Date): Promise<CostPeriodSummary> {
  const db = getDb();
  const config = await getActivePricingConfig();
  const netFactor = 1 - config.paymentFeePct / 100 - config.taxPct / 100;
  const [gen] = await db`
    select
      count(*) filter (where status <> 'PRICE_GUARD_BLOCKED')::int as generations,
      count(*) filter (where status in ('COMPLETED', 'EXPIRED'))::int as completed,
      count(*) filter (where status in ('FAILED', 'REFUNDED'))::int as failed,
      coalesce(sum(credit_cost) filter (where status in ('COMPLETED', 'EXPIRED')), 0) as credits_consumed,
      coalesce(sum(credit_cost) filter (where status = 'REFUNDED'), 0) as credits_refunded,
      coalesce(sum(revenue_allocated_brl) filter (where status in ('COMPLETED', 'EXPIRED')), 0) as revenue,
      coalesce(sum(estimated_cost_brl) filter (where status in ('COMPLETED', 'EXPIRED')), 0) as api_cost,
      coalesce(sum(estimated_cost_brl) filter (where status in ('FAILED', 'REFUNDED') and provider_charged), 0) as failure_cost,
      coalesce(sum(coalesce(provider_actual_cost_usd, 0)) filter (where provider_charged), 0) as provider_spend_usd,
      avg(extract(epoch from (completed_at - created_at))) filter (where status in ('COMPLETED', 'EXPIRED')) as avg_seconds
    from ai_video_generations
    where created_at >= ${since.toISOString()}
  `;
  const [purchases] = await db`
    select count(*)::int as total, coalesce(sum(price_cents), 0) as cents
    from ai_credit_purchases where status = 'PAID' and paid_at >= ${since.toISOString()}
  `;
  const revenue = Number(gen.revenue);
  const apiCost = Number(gen.api_cost);
  const failureCost = Number(gen.failure_cost);
  const paymentAndTax = revenue * (1 - netFactor);
  const grossProfit = revenue - paymentAndTax - apiCost - failureCost;
  const completed = Number(gen.completed);
  return {
    generations: Number(gen.generations),
    completed,
    failed: Number(gen.failed),
    creditsConsumed: Number(gen.credits_consumed),
    creditsRefunded: Number(gen.credits_refunded),
    revenueAllocatedBrl: revenue,
    apiCostBrl: apiCost,
    paymentAndTaxBrl: paymentAndTax,
    failureCostBrl: failureCost,
    grossProfitBrl: grossProfit,
    grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    averageCostPerVideoBrl: completed > 0 ? apiCost / completed : 0,
    averageGenerationSeconds: gen.avg_seconds === null ? null : Number(gen.avg_seconds),
    purchasesRevenueBrl: Number(purchases.cents) / 100,
    purchasesCount: Number(purchases.total),
    providerSpendUsd: Number(gen.provider_spend_usd),
  };
}

export async function getCostsDashboard(now: Date = new Date()): Promise<{
  today: CostPeriodSummary;
  month: CostPeriodSummary;
  byModel: CostByModel[];
  unrecoveredCredits: number;
  welcomeBonusCredits: number;
  alerts: string[];
}> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [todaySummary, monthSummary] = await Promise.all([summarize(today), summarize(month)]);
  const db = getDb();
  const config = await getActivePricingConfig();
  const netFactor = 1 - config.paymentFeePct / 100 - config.taxPct / 100;
  const modelRows = await db`
    select provider, provider_model, count(*)::int as generations,
      coalesce(avg(estimated_cost_brl), 0) as avg_cost,
      coalesce(sum(credit_cost), 0) as credits,
      coalesce(sum(revenue_allocated_brl), 0) as revenue,
      coalesce(sum(estimated_cost_brl), 0) as cost
    from ai_video_generations
    where status in ('COMPLETED', 'EXPIRED') and created_at >= ${month.toISOString()}
    group by provider, provider_model
    order by generations desc
  `;
  const [extra] = await db`
    select
      (select coalesce(sum(unrecovered_credits), 0) from ai_credit_wallets) as unrecovered,
      (select coalesce(sum(amount), 0) from ai_credit_transactions where type = 'BONUS' and created_at >= ${month.toISOString()}) as bonus
  `;
  const providerRows = await db`select * from ai_provider_accounts`;
  const alerts: string[] = [];
  for (const row of providerRows) {
    const balance = row.current_estimated_balance_usd === null ? null : Number(row.current_estimated_balance_usd);
    if (balance !== null && balance < Number(row.low_balance_threshold_usd)) {
      alerts.push(`Saldo do provedor ${row.provider} baixo: US$ ${balance.toFixed(2)} (limite US$ ${Number(row.low_balance_threshold_usd).toFixed(2)}).`);
    }
  }
  if (todaySummary.providerSpendUsd > config.dailyProviderSpendLimitUsd * 0.8) {
    alerts.push(`Gasto com o provedor hoje já passou de 80% do limite diário (US$ ${config.dailyProviderSpendLimitUsd}).`);
  }
  if (monthSummary.providerSpendUsd > config.monthlyProviderSpendLimitUsd * 0.8) {
    alerts.push(`Gasto com o provedor no mês já passou de 80% do limite mensal (US$ ${config.monthlyProviderSpendLimitUsd}).`);
  }
  const [blocked] = await db`
    select count(*)::int as total from ai_video_generations where status = 'PRICE_GUARD_BLOCKED' and created_at >= ${today.toISOString()}
  `;
  if (Number(blocked.total) > 0) alerts.push(`${blocked.total} geração(ões) bloqueadas hoje pela trava de preço/limite de gasto.`);

  return {
    today: todaySummary,
    month: monthSummary,
    byModel: modelRows.map((row) => {
      const revenue = Number(row.revenue);
      const profit = revenue * netFactor - Number(row.cost);
      return {
        provider: row.provider as string,
        model: row.provider_model as string,
        generations: Number(row.generations),
        averageCostBrl: Number(row.avg_cost),
        creditsConsumed: Number(row.credits),
        revenueBrl: revenue,
        grossProfitBrl: profit,
        grossMarginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    }),
    unrecoveredCredits: Number(extra.unrecovered),
    welcomeBonusCredits: Number(extra.bonus),
    alerts,
  };
}
