import "server-only";
import { getDb } from "@/lib/db/client";
import type { AiCreditPackage, AiPricingConfig, AiVideoModelPricing, AiVideoTier } from "../types";

/**
 * Leitura/escrita da regra comercial (ai_pricing_config), da tabela de
 * preço por modelo (ai_video_model_pricing) e dos pacotes
 * (ai_credit_packages). Nada disso fica hardcoded no código: o admin
 * ajusta pela tela e o servidor recalcula tudo a cada geração/compra.
 */

const num = (value: unknown) => Number(value);

function mapConfig(row: Record<string, unknown>): AiPricingConfig {
  return {
    id: row.id as string,
    creditValueBrl: num(row.credit_value_brl),
    targetGrossMarginPct: num(row.target_gross_margin_pct),
    minimumGrossMarginPct: num(row.minimum_gross_margin_pct),
    usdBrlReferenceRate: num(row.usd_brl_reference_rate),
    providerCostSafetyMultiplier: num(row.provider_cost_safety_multiplier),
    paymentFeePct: num(row.payment_fee_pct),
    taxPct: num(row.tax_pct),
    infraCostBrlPerGeneration: num(row.infra_cost_brl_per_generation),
    welcomeBonusCredits: num(row.welcome_bonus_credits),
    maxProviderCostUsd: num(row.max_provider_cost_usd),
    dailyProviderSpendLimitUsd: num(row.daily_provider_spend_limit_usd),
    monthlyProviderSpendLimitUsd: num(row.monthly_provider_spend_limit_usd),
    maxGenerationsPerUserPerHour: num(row.max_generations_per_user_per_hour),
    moderationStrikesBeforeBlock: num(row.moderation_strikes_before_block),
    moderationBlockHours: num(row.moderation_block_hours),
    retentionDaysFree: num(row.retention_days_free),
    retentionDaysPaid: num(row.retention_days_paid),
    purchaseRefundWindowDays: num(row.purchase_refund_window_days),
    effectiveFrom: new Date(row.effective_from as string).toISOString(),
  };
}

function mapModelPricing(row: Record<string, unknown>): AiVideoModelPricing {
  return {
    id: row.id as string,
    tier: row.tier as AiVideoTier,
    provider: row.provider as string,
    providerModel: row.provider_model as string,
    friendlyName: row.friendly_name as string,
    resolution: row.resolution as string,
    durationSeconds: num(row.duration_seconds),
    providerCreditsPerSecond: num(row.provider_credits_per_second),
    providerFixedCredits: num(row.provider_fixed_credits),
    providerCreditUsd: num(row.provider_credit_usd),
    aliluCreditCost: num(row.alilu_credit_cost),
    isActive: Boolean(row.is_active),
  };
}

function mapPackage(row: Record<string, unknown>): AiCreditPackage {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    credits: num(row.credits),
    bonusCredits: num(row.bonus_credits),
    priceCents: num(row.price_cents),
    isActive: Boolean(row.is_active),
    displayOrder: num(row.display_order),
  };
}

export class AiPricingNotConfiguredError extends Error {}

export async function getActivePricingConfig(): Promise<AiPricingConfig> {
  const db = getDb();
  const rows = await db`
    select * from ai_pricing_config
    where is_active and effective_from <= now()
    order by effective_from desc, created_at desc
    limit 1
  `;
  if (!rows[0]) throw new AiPricingNotConfiguredError("Precificação de IA não configurada.");
  return mapConfig(rows[0]);
}

export type AiPricingConfigInput = Omit<AiPricingConfig, "id" | "effectiveFrom">;

/** Nova versão da regra comercial (histórico preservado — a versão anterior continua no banco). */
export async function insertPricingConfig(input: AiPricingConfigInput): Promise<AiPricingConfig> {
  const db = getDb();
  const rows = await db`
    insert into ai_pricing_config (
      credit_value_brl, target_gross_margin_pct, minimum_gross_margin_pct, usd_brl_reference_rate,
      provider_cost_safety_multiplier, payment_fee_pct, tax_pct, infra_cost_brl_per_generation,
      welcome_bonus_credits, max_provider_cost_usd, daily_provider_spend_limit_usd,
      monthly_provider_spend_limit_usd, max_generations_per_user_per_hour,
      moderation_strikes_before_block, moderation_block_hours, retention_days_free,
      retention_days_paid, purchase_refund_window_days
    ) values (
      ${input.creditValueBrl}, ${input.targetGrossMarginPct}, ${input.minimumGrossMarginPct}, ${input.usdBrlReferenceRate},
      ${input.providerCostSafetyMultiplier}, ${input.paymentFeePct}, ${input.taxPct}, ${input.infraCostBrlPerGeneration},
      ${input.welcomeBonusCredits}, ${input.maxProviderCostUsd}, ${input.dailyProviderSpendLimitUsd},
      ${input.monthlyProviderSpendLimitUsd}, ${input.maxGenerationsPerUserPerHour},
      ${input.moderationStrikesBeforeBlock}, ${input.moderationBlockHours}, ${input.retentionDaysFree},
      ${input.retentionDaysPaid}, ${input.purchaseRefundWindowDays}
    )
    returning *
  `;
  return mapConfig(rows[0]);
}

export async function listModelPricing(): Promise<AiVideoModelPricing[]> {
  const db = getDb();
  const rows = await db`
    select * from ai_video_model_pricing
    order by array_position(array['ECONOMICO','PADRAO','ALTA']::text[], tier), duration_seconds
  `;
  return rows.map(mapModelPricing);
}

export async function getActiveModelPricing(tier: AiVideoTier, durationSeconds: number): Promise<AiVideoModelPricing | null> {
  const db = getDb();
  const rows = await db`
    select * from ai_video_model_pricing
    where tier = ${tier} and duration_seconds = ${durationSeconds} and is_active
    order by updated_at desc
    limit 1
  `;
  return rows[0] ? mapModelPricing(rows[0]) : null;
}

export async function getModelPricingById(id: string): Promise<AiVideoModelPricing | null> {
  const db = getDb();
  const rows = await db`select * from ai_video_model_pricing where id = ${id}`;
  return rows[0] ? mapModelPricing(rows[0]) : null;
}

export async function updateModelPricing(
  id: string,
  patch: { aliluCreditCost: number; isActive: boolean; providerCreditsPerSecond: number },
): Promise<void> {
  const db = getDb();
  await db`
    update ai_video_model_pricing
    set alilu_credit_cost = ${patch.aliluCreditCost}, is_active = ${patch.isActive},
        provider_credits_per_second = ${patch.providerCreditsPerSecond}, updated_at = now()
    where id = ${id}
  `;
}

export async function listPackages(onlyActive = false): Promise<AiCreditPackage[]> {
  const db = getDb();
  const rows = onlyActive
    ? await db`select * from ai_credit_packages where is_active order by display_order, credits`
    : await db`select * from ai_credit_packages order by display_order, credits`;
  return rows.map(mapPackage);
}

export async function getPackageByCode(code: string): Promise<AiCreditPackage | null> {
  const db = getDb();
  const rows = await db`select * from ai_credit_packages where code = ${code}`;
  return rows[0] ? mapPackage(rows[0]) : null;
}

export async function updatePackage(
  id: string,
  patch: { credits: number; bonusCredits: number; priceCents: number; isActive: boolean },
): Promise<void> {
  const db = getDb();
  await db`
    update ai_credit_packages
    set credits = ${patch.credits}, bonus_credits = ${patch.bonusCredits}, price_cents = ${patch.priceCents},
        is_active = ${patch.isActive}, updated_at = now()
    where id = ${id}
  `;
}
