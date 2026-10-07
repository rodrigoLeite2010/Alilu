import "server-only";
import { getDb } from "@/lib/db/client";
import { getActivePricingConfig } from "@/lib/ai-video/backend/pricing-repository";
import { estimateTextCostBrl, readTextAiPricing } from "@/lib/billing/backend/admin-metrics-service";
import { CAROUSEL_PLAN_CODES, CAROUSEL_PLAN_DEFINITIONS, isCarouselPlanCode, type CarouselPlanCode } from "../carousel-plans";

/**
 * Painel admin do Carrossel Inteligente: assinantes, MRR, uso, custo de IA
 * (tokens + buscas na web), receita líquida e margem. Somente leitura.
 * Sem preço do modelo configurado, mostra só tokens/chamadas e avisa — nunca inventa custo.
 */

/** Busca na web da Anthropic: US$ 10 por 1.000 buscas (docs, 2026). Sobrescrevível por env. */
export const DEFAULT_WEB_SEARCH_USD_PER_REQUEST = 0.01;

export function readWebSearchUsdPerRequest(env: Record<string, string | undefined> = process.env): number {
  const raw = env.CAROUSEL_WEB_SEARCH_USD_PER_1K;
  const parsed = raw ? Number(raw.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 1000 : DEFAULT_WEB_SEARCH_USD_PER_REQUEST;
}

const num = (value: unknown): number => Number(value ?? 0);

export interface CarouselPlanMetrics {
  code: CarouselPlanCode;
  name: string;
  listPriceCents: number;
  subscribers: number;
  mrrCents: number;
  discounted: number;
  discountGivenCents: number;
  complimentary: number;
  pastDue: number;
  canceledWithAccess: number;
  /** Carrosséis concluídos no mês pelos assinantes do plano. */
  completedMonth: number;
  quotaPerCycle: number;
  costBrl: number | null;
  netRevenueBrl: number;
  marginPct: number | null;
}

export interface CarouselAdminMetrics {
  generatedAt: string;
  mrr: { totalCents: number; netBrl: number; discountGivenCents: number };
  subscribers: { active: number; pastDue: number; pendingPayment: number; complimentary: number; canceledWithAccess: number };
  movement30d: { newPaid: number; canceled: number };
  trial: { claimedTotal: number; claimed30d: number; convertedToPaid: number };
  projects: { createdMonth: number; completedMonth: number; failedMonth: number; byStatus: Record<string, number> };
  ai: {
    pricingConfigured: boolean;
    usdBrl: number | null;
    calls: number;
    tokensInput: number;
    tokensOutput: number;
    webSearches: number;
    costBrl: number | null;
    costPerCompletedBrl: number | null;
    byFeature: Array<{ feature: string; calls: number; tokensInput: number; tokensOutput: number; webSearches: number; costBrl: number | null }>;
  };
  plans: CarouselPlanMetrics[];
  heavyUsers: Array<{ email: string; planCode: string | null; status: string | null; calls: number; webSearches: number; costBrl: number | null; netRevenueBrl: number; loss: boolean }>;
  alerts: string[];
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getCarouselAdminMetrics(now: Date = new Date()): Promise<CarouselAdminMetrics> {
  const db = getDb();
  const monthStart = startOfUtcMonth(now).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const nowIso = now.toISOString();
  const alerts: string[] = [];

  let netFactor = 1;
  let usdBrl: number | null = null;
  try {
    const config = await getActivePricingConfig();
    netFactor = 1 - config.paymentFeePct / 100 - config.taxPct / 100;
    usdBrl = config.usdBrlReferenceRate;
  } catch {
    alerts.push("Precificação de IA não configurada: receita líquida e custo em R$ ficam sem taxas/câmbio.");
  }
  const textPricing = readTextAiPricing();
  const searchUsd = readWebSearchUsdPerRequest();
  if (!textPricing) alerts.push("Preço do modelo de texto não configurado (CONTENT_AI_INPUT_USD_PER_MTOK / OUTPUT): custo de IA aparece só em tokens e buscas.");
  if (!process.env.PEXELS_API_KEY) alerts.push("Banco de fotos não configurado (PEXELS_API_KEY): slides com foto saem só com o template.");
  if (!process.env.CONTENT_AI_API_KEY) alerts.push("IA não configurada (CONTENT_AI_API_KEY): o Carrossel Inteligente não consegue gerar conteúdo.");

  const costOf = (tin: number, tout: number, searches: number): number | null =>
    textPricing && usdBrl !== null ? estimateTextCostBrl(tin, tout, textPricing, usdBrl) + searches * searchUsd * usdBrl : null;

  // Assinaturas por plano e situação.
  const subRows = await db`
    select plan_code, status, complimentary, (discount_percent > 0) as discounted,
      (current_period_ends_at is not null and current_period_ends_at > ${nowIso}) as in_period,
      count(*)::int as n, coalesce(sum(price_cents), 0)::int as price, coalesce(sum(list_price_cents), 0)::int as list
    from carousel_subscriptions
    group by plan_code, status, complimentary, discounted, in_period
  `;
  const plans = new Map<CarouselPlanCode, CarouselPlanMetrics>();
  for (const code of CAROUSEL_PLAN_CODES) {
    const def = CAROUSEL_PLAN_DEFINITIONS[code];
    plans.set(code, { code, name: def.name, listPriceCents: def.priceCents, subscribers: 0, mrrCents: 0, discounted: 0, discountGivenCents: 0, complimentary: 0, pastDue: 0, canceledWithAccess: 0, completedMonth: 0, quotaPerCycle: def.carouselsPerCycle, costBrl: null, netRevenueBrl: 0, marginPct: null });
  }
  const subscribers = { active: 0, pastDue: 0, pendingPayment: 0, complimentary: 0, canceledWithAccess: 0 };
  for (const row of subRows) {
    if (!isCarouselPlanCode(row.plan_code)) continue;
    const plan = plans.get(row.plan_code)!;
    const n = num(row.n);
    const complimentary = row.complimentary === true;
    if (row.status === "ACTIVE") {
      if (complimentary) {
        plan.complimentary += n;
        subscribers.complimentary += n;
      } else {
        plan.subscribers += n;
        plan.mrrCents += num(row.price);
        subscribers.active += n;
        if (row.discounted) {
          plan.discounted += n;
          plan.discountGivenCents += num(row.list) - num(row.price);
        }
      }
    } else if (row.status === "PAST_DUE") {
      plan.pastDue += n;
      subscribers.pastDue += n;
    } else if (row.status === "PENDING_PAYMENT") {
      subscribers.pendingPayment += n;
    } else if (row.status === "CANCELED" && row.in_period) {
      plan.canceledWithAccess += n;
      subscribers.canceledWithAccess += n;
    }
  }

  const [movement] = await db`
    select count(*) filter (where started_at >= ${since30} and complimentary = false)::int as new_paid,
           count(*) filter (where canceled_at >= ${since30})::int as canceled
    from carousel_subscriptions
  `;
  const [trial] = await db`
    select count(*)::int as total, count(*) filter (where claimed_at >= ${since30})::int as recent,
      count(*) filter (where exists (
        select 1 from carousel_subscriptions s where s.user_id = carousel_trial_claims.user_id and s.status in ('ACTIVE', 'PAST_DUE', 'CANCELED') and s.complimentary = false and s.started_at is not null
      ))::int as converted
    from carousel_trial_claims
  `;

  // Projetos.
  const statusRows = await db`select status, count(*)::int as n from carousel_projects group by status`;
  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[String(row.status)] = num(row.n);
  const [projectMonth] = await db`
    select count(*) filter (where created_at >= ${monthStart})::int as created,
           count(*) filter (where completed_at >= ${monthStart})::int as completed,
           count(*) filter (where status = 'FAILED' and updated_at >= ${monthStart})::int as failed
    from carousel_projects
  `;
  const completedByPlan = await db`
    select s.plan_code, count(*)::int as n
    from carousel_projects p join carousel_subscriptions s on s.user_id = p.user_id and s.status in ('ACTIVE', 'PAST_DUE')
    where p.completed_at >= ${monthStart} group by s.plan_code
  `;
  for (const row of completedByPlan) if (isCarouselPlanCode(row.plan_code)) plans.get(row.plan_code)!.completedMonth = num(row.n);

  // IA do mês (somente funções do carrossel).
  const featureRows = await db`
    select feature, count(*)::int as calls, coalesce(sum(tokens_input), 0)::bigint as tin, coalesce(sum(tokens_output), 0)::bigint as tout,
      coalesce(sum(web_searches), 0)::int as searches
    from generation_usage where feature like 'carousel\\_%' and created_at >= ${monthStart}
    group by feature order by calls desc
  `;
  const byFeature = featureRows.map((row) => ({
    feature: String(row.feature),
    calls: num(row.calls),
    tokensInput: num(row.tin),
    tokensOutput: num(row.tout),
    webSearches: num(row.searches),
    costBrl: costOf(num(row.tin), num(row.tout), num(row.searches)),
  }));
  const totals = byFeature.reduce((acc, f) => ({ calls: acc.calls + f.calls, tin: acc.tin + f.tokensInput, tout: acc.tout + f.tokensOutput, searches: acc.searches + f.webSearches }), { calls: 0, tin: 0, tout: 0, searches: 0 });
  const totalCost = costOf(totals.tin, totals.tout, totals.searches);
  const completedMonth = num(projectMonth?.completed);

  // Custo por usuário / plano.
  const userRows = await db`
    select u.email, s.plan_code, s.status, s.price_cents, s.complimentary, count(*)::int as calls,
      coalesce(sum(g.tokens_input), 0)::bigint as tin, coalesce(sum(g.tokens_output), 0)::bigint as tout, coalesce(sum(g.web_searches), 0)::int as searches
    from generation_usage g
    join users u on u.id = g.user_id
    left join carousel_subscriptions s on s.user_id = g.user_id
    where g.feature like 'carousel\\_%' and g.created_at >= ${monthStart}
    group by u.email, s.plan_code, s.status, s.price_cents, s.complimentary
    order by tout desc, calls desc
  `;
  const heavyUsers: CarouselAdminMetrics["heavyUsers"] = [];
  for (const row of userRows) {
    const paying = (row.status === "ACTIVE" || row.status === "PAST_DUE") && row.complimentary !== true;
    const netRevenueBrl = paying ? (num(row.price_cents) / 100) * netFactor : 0;
    const costBrl = costOf(num(row.tin), num(row.tout), num(row.searches));
    if (isCarouselPlanCode(row.plan_code) && paying && costBrl !== null) {
      const plan = plans.get(row.plan_code)!;
      plan.costBrl = (plan.costBrl ?? 0) + costBrl;
    }
    heavyUsers.push({ email: String(row.email), planCode: row.plan_code ? String(row.plan_code) : null, status: row.status ? String(row.status) : null, calls: num(row.calls), webSearches: num(row.searches), costBrl, netRevenueBrl, loss: costBrl !== null && costBrl > netRevenueBrl });
  }

  let totalMrr = 0;
  let totalDiscount = 0;
  for (const plan of plans.values()) {
    totalMrr += plan.mrrCents;
    totalDiscount += plan.discountGivenCents;
    plan.netRevenueBrl = (plan.mrrCents / 100) * netFactor;
    if (plan.netRevenueBrl > 0 && plan.costBrl !== null) plan.marginPct = ((plan.netRevenueBrl - plan.costBrl) / plan.netRevenueBrl) * 100;
    else if (plan.netRevenueBrl > 0 && textPricing && usdBrl !== null) {
      plan.costBrl = 0;
      plan.marginPct = 100;
    }
  }
  const lossUsers = heavyUsers.filter((user) => user.loss && user.netRevenueBrl > 0).length;
  if (lossUsers > 0) alerts.push(`${lossUsers} assinante(s) com custo de IA acima da mensalidade líquida neste mês.`);

  return {
    generatedAt: nowIso,
    mrr: { totalCents: totalMrr, netBrl: (totalMrr / 100) * netFactor, discountGivenCents: totalDiscount },
    subscribers,
    movement30d: { newPaid: num(movement?.new_paid), canceled: num(movement?.canceled) },
    trial: { claimedTotal: num(trial?.total), claimed30d: num(trial?.recent), convertedToPaid: num(trial?.converted) },
    projects: { createdMonth: num(projectMonth?.created), completedMonth, failedMonth: num(projectMonth?.failed), byStatus },
    ai: {
      pricingConfigured: textPricing !== null && usdBrl !== null,
      usdBrl,
      calls: totals.calls,
      tokensInput: totals.tin,
      tokensOutput: totals.tout,
      webSearches: totals.searches,
      costBrl: totalCost,
      costPerCompletedBrl: totalCost !== null && completedMonth > 0 ? totalCost / completedMonth : null,
      byFeature,
    },
    plans: [...plans.values()],
    heavyUsers: heavyUsers.slice(0, 10),
    alerts,
  };
}
