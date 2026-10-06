import "server-only";
import { getDb } from "@/lib/db/client";
import { getActivePricingConfig } from "@/lib/ai-video/backend/pricing-repository";
import { getCostsDashboard, type CostPeriodSummary } from "@/lib/ai-video/backend/admin-service";
import { PLAN_CODES, PLAN_DEFINITIONS, PLAN_USAGE_WARNING_RATIO, isPlanCode, type PlanCode } from "../plans";

/**
 * Métricas do admin para assinaturas + créditos + custo de IA: MRR por
 * plano, movimento (novos/cancelados), uso da franquia de IA, créditos
 * (vendas, saldo em aberto), custo de IA de texto por usuário/plano e a
 * margem estimada. Somente leitura — nunca altera nada e nunca é exposto a
 * quem não é admin (a página checa ADMIN_EMAILS no servidor).
 *
 * Custo de IA de texto: o provedor/modelo é configurável (CONTENT_AI_MODEL),
 * então o preço por milhão de tokens também é — CONTENT_AI_INPUT_USD_PER_MTOK
 * e CONTENT_AI_OUTPUT_USD_PER_MTOK. Sem eles o painel mostra só tokens e
 * chamadas e avisa que o custo em R$ não pôde ser calculado (nunca inventa preço).
 */

export interface TextAiPricing {
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
}

function positiveNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function readTextAiPricing(env: Record<string, string | undefined> = process.env): TextAiPricing | null {
  const input = positiveNumber(env.CONTENT_AI_INPUT_USD_PER_MTOK);
  const output = positiveNumber(env.CONTENT_AI_OUTPUT_USD_PER_MTOK);
  return input !== null && output !== null ? { inputUsdPerMtok: input, outputUsdPerMtok: output } : null;
}

/** Custo estimado em R$ de um volume de tokens de texto. */
export function estimateTextCostBrl(tokensInput: number, tokensOutput: number, pricing: TextAiPricing, usdBrl: number): number {
  const usd = (tokensInput * pricing.inputUsdPerMtok + tokensOutput * pricing.outputUsdPerMtok) / 1_000_000;
  return usd * usdBrl;
}

export interface PlanMetrics {
  code: PlanCode;
  name: string;
  priceCents: number;
  /** Assinantes ACTIVE (pagando). */
  subscribers: number;
  mrrCents: number;
  pastDue: number;
  pastDueCents: number;
  /** Cancelaram mas ainda têm acesso até o fim do período pago. */
  canceledWithAccess: number;
  /** Downgrades agendados saindo deste plano. */
  scheduledDowngrades: number;
  /** MRR que deixa de entrar quando os downgrades agendados valerem. */
  scheduledDowngradeLossCents: number;
  /** Uso da franquia de IA do ciclo (só planos com IA). */
  aiUsage: { subscribers: number; usedTotal: number; limitTotal: number; nearLimit: number; atLimit: number } | null;
  /** Custo estimado de IA de texto no mês dos usuários deste plano (null = preço do modelo não configurado). */
  textCostBrl: number | null;
  /** Receita líquida mensal (MRR − taxas − impostos). */
  netRevenueBrl: number;
  /** Margem estimada = (líquida − custo de IA de texto) ÷ líquida; null sem custo configurado ou sem receita. */
  marginPct: number | null;
}

export interface HeavyUser {
  email: string;
  planCode: PlanCode | null;
  status: string | null;
  calls: number;
  tokensInput: number;
  tokensOutput: number;
  costBrl: number | null;
  /** Mensalidade líquida que o usuário paga (0 se não tem plano pago). */
  netRevenueBrl: number;
  /** Custo de IA acima da mensalidade líquida. */
  loss: boolean;
}

export interface BillingMetrics {
  generatedAt: string;
  mrr: { totalCents: number; atRiskCents: number; scheduledDowngradeLossCents: number; netBrl: number };
  subscribers: {
    active: number;
    pastDue: number;
    pendingPayment: number;
    canceledWithAccess: number;
    trial: number;
    expired: number;
  };
  movement30d: { newPaid: number; canceled: number; churnPct: number };
  plans: PlanMetrics[];
  credits: {
    purchasedMonthBrl: number;
    purchasesMonth: number;
    outstandingCredits: number;
    outstandingLiabilityBrl: number;
    creditValueBrl: number | null;
    unrecoveredCredits: number;
  };
  textAi: {
    pricingConfigured: boolean;
    usdBrl: number | null;
    calls: number;
    tokensInput: number;
    tokensOutput: number;
    costBrl: number | null;
    byFeature: Array<{ feature: string; calls: number; tokensInput: number; tokensOutput: number; costBrl: number | null }>;
  };
  video: Pick<
    CostPeriodSummary,
    "generations" | "revenueAllocatedBrl" | "apiCostBrl" | "paymentAndTaxBrl" | "grossProfitBrl" | "grossMarginPct" | "creditsConsumed"
  > | null;
  heavyUsers: HeavyUser[];
  alerts: string[];
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

export async function getBillingMetrics(now: Date = new Date()): Promise<BillingMetrics> {
  const db = getDb();
  const monthStart = startOfUtcMonth(now);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const nowIso = now.toISOString();
  const alerts: string[] = [];

  // Regra comercial (taxa de pagamento + imposto → receita líquida) e câmbio.
  let netFactor = 1;
  let usdBrl: number | null = null;
  let creditValueBrl: number | null = null;
  try {
    const config = await getActivePricingConfig();
    netFactor = 1 - config.paymentFeePct / 100 - config.taxPct / 100;
    usdBrl = config.usdBrlReferenceRate;
    creditValueBrl = config.creditValueBrl;
  } catch {
    alerts.push("Precificação de IA não configurada: receita líquida e custo em R$ estão sem taxas/câmbio.");
  }

  // 1) Assinaturas por plano e situação.
  const subRows = await db`
    select plan_code, status,
      (current_period_ends_at is not null and current_period_ends_at > ${nowIso}) as in_period,
      (trial_ends_at is not null and trial_ends_at > ${nowIso}) as in_trial,
      count(*)::int as n,
      coalesce(sum(monthly_price_cents), 0)::int as cents
    from automation_subscriptions
    group by plan_code, status, in_period, in_trial
  `;
  const pendingRows = await db`
    select plan_code, pending_plan_code, count(*)::int as n
    from automation_subscriptions
    where status = 'ACTIVE' and pending_plan_code is not null
    group by plan_code, pending_plan_code
  `;

  const plans = new Map<PlanCode, PlanMetrics>();
  for (const code of PLAN_CODES) {
    const def = PLAN_DEFINITIONS[code];
    plans.set(code, {
      code,
      name: def.name,
      priceCents: def.priceCents,
      subscribers: 0,
      mrrCents: 0,
      pastDue: 0,
      pastDueCents: 0,
      canceledWithAccess: 0,
      scheduledDowngrades: 0,
      scheduledDowngradeLossCents: 0,
      aiUsage: def.includesAi ? { subscribers: 0, usedTotal: 0, limitTotal: 0, nearLimit: 0, atLimit: 0 } : null,
      textCostBrl: null,
      netRevenueBrl: 0,
      marginPct: null,
    });
  }
  const subscribers = { active: 0, pastDue: 0, pendingPayment: 0, canceledWithAccess: 0, trial: 0, expired: 0 };
  for (const row of subRows) {
    const code = isPlanCode(row.plan_code) ? row.plan_code : "AUTOMATION";
    const plan = plans.get(code)!;
    const n = num(row.n);
    const cents = num(row.cents);
    switch (row.status) {
      case "ACTIVE":
        plan.subscribers += n;
        plan.mrrCents += cents;
        subscribers.active += n;
        break;
      case "PAST_DUE":
        plan.pastDue += n;
        plan.pastDueCents += cents;
        subscribers.pastDue += n;
        break;
      case "PENDING_PAYMENT":
        subscribers.pendingPayment += n;
        break;
      case "CANCELED":
        if (row.in_period) {
          plan.canceledWithAccess += n;
          subscribers.canceledWithAccess += n;
        } else subscribers.expired += n;
        break;
      case "TRIAL":
        if (row.in_trial) subscribers.trial += n;
        else subscribers.expired += n;
        break;
      case "EXPIRED":
        subscribers.expired += n;
        break;
      default:
        break;
    }
  }
  for (const row of pendingRows) {
    if (!isPlanCode(row.plan_code) || !isPlanCode(row.pending_plan_code)) continue;
    const plan = plans.get(row.plan_code)!;
    const n = num(row.n);
    plan.scheduledDowngrades += n;
    plan.scheduledDowngradeLossCents += n * Math.max(0, plan.priceCents - PLAN_DEFINITIONS[row.pending_plan_code].priceCents);
  }

  // 2) Movimento dos últimos 30 dias.
  const [movement] = await db`
    select
      count(*) filter (where started_at >= ${since30.toISOString()})::int as new_paid,
      count(*) filter (where canceled_at >= ${since30.toISOString()})::int as canceled
    from automation_subscriptions
  `;
  const newPaid = num(movement?.new_paid);
  const canceled30 = num(movement?.canceled);
  const churnBase = subscribers.active + canceled30;
  const churnPct = churnBase > 0 ? (canceled30 / churnBase) * 100 : 0;

  // 3) Uso da franquia de IA do ciclo atual (assinantes ACTIVE de planos com IA).
  const usageRows = await db`
    select s.plan_code, coalesce(c.used, 0)::int as used
    from automation_subscriptions s
    left join plan_usage_cycles c
      on c.user_id = s.user_id
     and c.cycle_key = to_char(s.current_period_ends_at at time zone 'UTC', 'YYYY-MM-DD')
    where s.status = 'ACTIVE'
  `;
  for (const row of usageRows) {
    if (!isPlanCode(row.plan_code)) continue;
    const def = PLAN_DEFINITIONS[row.plan_code];
    const usage = plans.get(row.plan_code)!.aiUsage;
    if (!usage || def.aiPostsPerCycle === null) continue;
    const used = num(row.used);
    usage.subscribers += 1;
    usage.usedTotal += used;
    usage.limitTotal += def.aiPostsPerCycle;
    if (used >= def.aiPostsPerCycle) usage.atLimit += 1;
    else if (used / def.aiPostsPerCycle >= PLAN_USAGE_WARNING_RATIO) usage.nearLimit += 1;
  }

  // 4) Créditos: vendas do mês e saldo em aberto (passivo).
  const [purchases] = await db`
    select count(*)::int as n, coalesce(sum(price_cents), 0)::int as cents
    from ai_credit_purchases where status = 'PAID' and paid_at >= ${monthStart.toISOString()}
  `;
  const [wallets] = await db`
    select coalesce(sum(available + reserved), 0)::bigint as outstanding, coalesce(sum(unrecovered_credits), 0)::bigint as unrecovered
    from ai_credit_wallets
  `;
  const outstandingCredits = num(wallets?.outstanding);

  // 5) IA de texto: tokens do mês por função e por usuário.
  const textPricing = readTextAiPricing();
  const featureRows = await db`
    select coalesce(feature, 'automation') as feature, count(*)::int as calls,
      coalesce(sum(tokens_input), 0)::bigint as tin, coalesce(sum(tokens_output), 0)::bigint as tout
    from generation_usage
    where created_at >= ${monthStart.toISOString()}
    group by 1 order by 2 desc
  `;
  const costOf = (tin: number, tout: number): number | null =>
    textPricing && usdBrl !== null ? estimateTextCostBrl(tin, tout, textPricing, usdBrl) : null;
  const byFeature = featureRows.map((row) => ({
    feature: String(row.feature),
    calls: num(row.calls),
    tokensInput: num(row.tin),
    tokensOutput: num(row.tout),
    costBrl: costOf(num(row.tin), num(row.tout)),
  }));
  const textTotals = byFeature.reduce(
    (acc, item) => ({ calls: acc.calls + item.calls, tin: acc.tin + item.tokensInput, tout: acc.tout + item.tokensOutput }),
    { calls: 0, tin: 0, tout: 0 },
  );

  const userRows = await db`
    select u.email, s.plan_code, s.status, s.monthly_price_cents,
      count(*)::int as calls,
      coalesce(sum(g.tokens_input), 0)::bigint as tin, coalesce(sum(g.tokens_output), 0)::bigint as tout
    from generation_usage g
    join users u on u.id = g.user_id
    left join automation_subscriptions s on s.user_id = g.user_id
    where g.user_id is not null and g.created_at >= ${monthStart.toISOString()}
    group by u.email, s.plan_code, s.status, s.monthly_price_cents
    order by tout desc, calls desc
  `;
  const heavyUsers: HeavyUser[] = [];
  for (const row of userRows) {
    const code = isPlanCode(row.plan_code) ? row.plan_code : null;
    const paying = row.status === "ACTIVE" || row.status === "PAST_DUE";
    const netRevenueBrl = paying ? (num(row.monthly_price_cents) / 100) * netFactor : 0;
    const costBrl = costOf(num(row.tin), num(row.tout));
    if (code && costBrl !== null) {
      const plan = plans.get(code)!;
      plan.textCostBrl = (plan.textCostBrl ?? 0) + costBrl;
    }
    heavyUsers.push({
      email: String(row.email),
      planCode: code,
      status: row.status ? String(row.status) : null,
      calls: num(row.calls),
      tokensInput: num(row.tin),
      tokensOutput: num(row.tout),
      costBrl,
      netRevenueBrl,
      loss: costBrl !== null && costBrl > netRevenueBrl,
    });
  }

  // 6) Receita líquida e margem estimada por plano.
  let totalMrrCents = 0;
  let totalAtRiskCents = 0;
  let totalDowngradeLoss = 0;
  for (const plan of plans.values()) {
    totalMrrCents += plan.mrrCents;
    totalAtRiskCents += plan.pastDueCents;
    totalDowngradeLoss += plan.scheduledDowngradeLossCents;
    plan.netRevenueBrl = (plan.mrrCents / 100) * netFactor;
    if (plan.netRevenueBrl > 0 && plan.textCostBrl !== null) {
      plan.marginPct = ((plan.netRevenueBrl - plan.textCostBrl) / plan.netRevenueBrl) * 100;
    } else if (plan.netRevenueBrl > 0 && textPricing && usdBrl !== null) {
      plan.textCostBrl = 0;
      plan.marginPct = 100;
    }
  }

  // 7) Vídeo com IA (painel de custos que já existe) — falha aqui não derruba o resto.
  let video: BillingMetrics["video"] = null;
  let unrecoveredCredits = num(wallets?.unrecovered);
  try {
    const costs = await getCostsDashboard(now);
    const m = costs.month;
    video = {
      generations: m.generations,
      revenueAllocatedBrl: m.revenueAllocatedBrl,
      apiCostBrl: m.apiCostBrl,
      paymentAndTaxBrl: m.paymentAndTaxBrl,
      grossProfitBrl: m.grossProfitBrl,
      grossMarginPct: m.grossMarginPct,
      creditsConsumed: m.creditsConsumed,
    };
    unrecoveredCredits = costs.unrecoveredCredits;
  } catch {
    // sem precificação de vídeo configurada: seção some
  }

  // Alertas.
  if (!textPricing) {
    alerts.push(
      "Defina CONTENT_AI_INPUT_USD_PER_MTOK e CONTENT_AI_OUTPUT_USD_PER_MTOK (preço do modelo de texto por milhão de tokens) para ver o custo e a margem de IA em R$.",
    );
  }
  if (subscribers.pastDue > 0) {
    alerts.push(`${subscribers.pastDue} assinante(s) em atraso — R$ ${(totalAtRiskCents / 100).toFixed(2).replace(".", ",")}/mês em risco.`);
  }
  for (const plan of plans.values()) {
    if (plan.aiUsage && plan.aiUsage.subscribers > 0 && plan.aiUsage.atLimit / plan.aiUsage.subscribers >= 0.3) {
      alerts.push(`${plan.aiUsage.atLimit} de ${plan.aiUsage.subscribers} assinantes do plano ${plan.name} esgotaram a franquia de IA — candidatos a upgrade (ou o limite está baixo).`);
    }
    if (plan.marginPct !== null && plan.marginPct < 50) {
      alerts.push(`Margem estimada do plano ${plan.name} está em ${plan.marginPct.toFixed(0)}% — revise preço ou franquia.`);
    }
  }
  const losing = heavyUsers.filter((user) => user.loss).length;
  if (losing > 0) alerts.push(`${losing} usuário(s) com custo de IA de texto acima da mensalidade líquida neste mês.`);

  return {
    generatedAt: nowIso,
    mrr: {
      totalCents: totalMrrCents,
      atRiskCents: totalAtRiskCents,
      scheduledDowngradeLossCents: totalDowngradeLoss,
      netBrl: (totalMrrCents / 100) * netFactor,
    },
    subscribers,
    movement30d: { newPaid, canceled: canceled30, churnPct },
    plans: [...plans.values()].sort((a, b) => PLAN_DEFINITIONS[a.code].rank - PLAN_DEFINITIONS[b.code].rank),
    credits: {
      purchasedMonthBrl: num(purchases?.cents) / 100,
      purchasesMonth: num(purchases?.n),
      outstandingCredits,
      outstandingLiabilityBrl: creditValueBrl !== null ? outstandingCredits * creditValueBrl : 0,
      creditValueBrl,
      unrecoveredCredits,
    },
    textAi: {
      pricingConfigured: Boolean(textPricing) && usdBrl !== null,
      usdBrl,
      calls: textTotals.calls,
      tokensInput: textTotals.tin,
      tokensOutput: textTotals.tout,
      costBrl: costOf(textTotals.tin, textTotals.tout),
      byFeature,
    },
    video,
    heavyUsers: heavyUsers.slice(0, 10),
    alerts,
  };
}
