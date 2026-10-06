// Métricas do admin (MRR, uso da franquia, créditos, custo de IA e margem)
// contra Postgres real em memória (PGlite) com todas as migrações.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const metrics = await import("@/lib/billing/backend/admin-metrics-service");

const NOW = new Date("2026-10-15T12:00:00.000Z");
const PERIOD_END = "2026-10-25T00:00:00.000Z";

async function user(email: string) {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}

async function sub(
  userId: string,
  opts: { plan: string; status: string; price: number; periodEnd?: string | null; pending?: string | null; startedAt?: string; canceledAt?: string },
) {
  await db.sql`
    insert into automation_subscriptions
      (user_id, status, plan_code, monthly_price_cents, pending_plan_code, current_period_ends_at, started_at, canceled_at)
    values (${userId}, ${opts.status}, ${opts.plan}, ${opts.price}, ${opts.pending ?? null}, ${opts.periodEnd ?? null}, ${opts.startedAt ?? null}, ${opts.canceledAt ?? null})
  `;
}

async function usage(userId: string, tin: number, tout: number, feature = "automation", at = "2026-10-10T12:00:00.000Z") {
  await db.sql`
    insert into generation_usage (user_id, feature, provider, model, tokens_input, tokens_output, created_at)
    values (${userId}, ${feature}, 'anthropic', 'm', ${tin}, ${tout}, ${at})
  `;
}

const env = { ...process.env };

beforeEach(async () => {
  db = await createTestDb();
  process.env.CONTENT_AI_INPUT_USD_PER_MTOK = "3";
  process.env.CONTENT_AI_OUTPUT_USD_PER_MTOK = "15";
});

afterEach(async () => {
  await db.close();
  process.env = { ...env };
});

describe("readTextAiPricing / estimateTextCostBrl", () => {
  it("só existe com os dois preços válidos", () => {
    expect(metrics.readTextAiPricing({})).toBeNull();
    expect(metrics.readTextAiPricing({ CONTENT_AI_INPUT_USD_PER_MTOK: "3" })).toBeNull();
    expect(metrics.readTextAiPricing({ CONTENT_AI_INPUT_USD_PER_MTOK: "3", CONTENT_AI_OUTPUT_USD_PER_MTOK: "abc" })).toBeNull();
    expect(metrics.readTextAiPricing({ CONTENT_AI_INPUT_USD_PER_MTOK: "3,5", CONTENT_AI_OUTPUT_USD_PER_MTOK: "15" })).toEqual({
      inputUsdPerMtok: 3.5,
      outputUsdPerMtok: 15,
    });
  });

  it("converte tokens em R$ pelo câmbio", () => {
    // 1M entrada × US$3 + 1M saída × US$15 = US$18 × 5,00 = R$ 90
    expect(metrics.estimateTextCostBrl(1_000_000, 1_000_000, { inputUsdPerMtok: 3, outputUsdPerMtok: 15 }, 5)).toBeCloseTo(90, 5);
  });
});

describe("getBillingMetrics", () => {
  it("banco vazio: tudo zerado, sem erro", async () => {
    const data = await metrics.getBillingMetrics(NOW);
    expect(data.mrr.totalCents).toBe(0);
    expect(data.subscribers.active).toBe(0);
    expect(data.heavyUsers).toEqual([]);
    expect(data.plans.map((plan) => plan.code)).toEqual(["AUTOMATION", "CREATOR", "PRO"]);
    expect(data.movement30d.churnPct).toBe(0);
  });

  it("MRR por plano, atraso, cancelados com acesso, downgrade agendado e movimento de 30 dias", async () => {
    await sub(await user("a@x.com"), { plan: "AUTOMATION", status: "ACTIVE", price: 1900, periodEnd: PERIOD_END, startedAt: "2026-10-01T00:00:00Z" });
    await sub(await user("b@x.com"), { plan: "CREATOR", status: "ACTIVE", price: 2490, periodEnd: PERIOD_END, startedAt: "2026-08-01T00:00:00Z" });
    await sub(await user("c@x.com"), { plan: "PRO", status: "ACTIVE", price: 4990, periodEnd: PERIOD_END, pending: "CREATOR", startedAt: "2026-08-01T00:00:00Z" });
    await sub(await user("d@x.com"), { plan: "CREATOR", status: "PAST_DUE", price: 2490, periodEnd: PERIOD_END });
    await sub(await user("e@x.com"), { plan: "AUTOMATION", status: "CANCELED", price: 1900, periodEnd: PERIOD_END, canceledAt: "2026-10-10T00:00:00Z" });
    await sub(await user("f@x.com"), { plan: "AUTOMATION", status: "CANCELED", price: 1900, periodEnd: "2026-09-01T00:00:00Z", canceledAt: "2026-08-20T00:00:00Z" });
    await sub(await user("g@x.com"), { plan: "AUTOMATION", status: "PENDING_PAYMENT", price: 1900 });

    const data = await metrics.getBillingMetrics(NOW);

    expect(data.mrr.totalCents).toBe(1900 + 2490 + 4990);
    expect(data.mrr.atRiskCents).toBe(2490);
    expect(data.mrr.scheduledDowngradeLossCents).toBe(4990 - 2490);
    expect(data.subscribers).toMatchObject({ active: 3, pastDue: 1, pendingPayment: 1, canceledWithAccess: 1, expired: 1 });

    const pro = data.plans.find((plan) => plan.code === "PRO")!;
    expect(pro.scheduledDowngrades).toBe(1);
    expect(pro.scheduledDowngradeLossCents).toBe(2500);
    const creator = data.plans.find((plan) => plan.code === "CREATOR")!;
    expect(creator.pastDue).toBe(1);

    expect(data.movement30d.newPaid).toBe(1);
    expect(data.movement30d.canceled).toBe(1); // só o cancelamento de 10/10 está nos últimos 30 dias
    expect(data.movement30d.churnPct).toBeCloseTo((1 / (3 + 1)) * 100, 5);
    expect(data.alerts.some((alert) => alert.includes("em atraso"))).toBe(true);
  });

  it("uso da franquia de IA: médios, ≥80% e esgotados por plano", async () => {
    const heavy = await user("h@x.com");
    const full = await user("f@x.com");
    const light = await user("l@x.com");
    for (const [id, used] of [[heavy, 75], [full, 90], [light, 10]] as const) {
      await sub(id, { plan: "CREATOR", status: "ACTIVE", price: 2490, periodEnd: PERIOD_END });
      await db.sql`insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${id}, '2026-10-25', 'CREATOR', ${used})`;
    }
    // ciclo antigo não conta
    await db.sql`insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${light}, '2026-09-25', 'CREATOR', 88)`;

    const data = await metrics.getBillingMetrics(NOW);
    const usage = data.plans.find((plan) => plan.code === "CREATOR")!.aiUsage!;

    expect(usage).toEqual({ subscribers: 3, usedTotal: 175, limitTotal: 270, nearLimit: 1, atLimit: 1 });
    expect(data.plans.find((plan) => plan.code === "AUTOMATION")!.aiUsage).toBeNull();
  });

  it("créditos: vendas pagas do mês e saldo em aberto como passivo", async () => {
    const buyer = await user("buyer@x.com");
    await db.sql`
      insert into ai_credit_purchases (user_id, package_name, credits, price_cents, status, paid_at)
      values (${buyer}, 'p', 500, 2500, 'PAID', '2026-10-05T00:00:00Z'),
             (${buyer}, 'p', 100, 500, 'PAID', '2026-09-05T00:00:00Z'),
             (${buyer}, 'p', 100, 500, 'PENDING', null)`;
    await db.sql`insert into ai_credit_wallets (user_id, available, reserved) values (${buyer}, 400, 20)`;

    const data = await metrics.getBillingMetrics(NOW);

    expect(data.credits.purchasedMonthBrl).toBe(25);
    expect(data.credits.purchasesMonth).toBe(1);
    expect(data.credits.outstandingCredits).toBe(420);
    expect(data.credits.creditValueBrl).toBeCloseTo(0.05, 5);
    expect(data.credits.outstandingLiabilityBrl).toBeCloseTo(21, 5);
  });

  it("custo de IA de texto por plano, margem estimada e usuário que custa mais do que paga", async () => {
    const cheap = await user("cheap@x.com");
    const costly = await user("costly@x.com");
    await sub(cheap, { plan: "CREATOR", status: "ACTIVE", price: 2490, periodEnd: PERIOD_END });
    await sub(costly, { plan: "AUTOMATION", status: "ACTIVE", price: 1900, periodEnd: PERIOD_END });
    await usage(cheap, 100_000, 50_000);
    await usage(cheap, 100_000, 50_000, "ai-caption");
    // 40M de saída = US$ 600 (≈ R$ 3.000+): muito acima da mensalidade
    await usage(costly, 1_000_000, 40_000_000);
    // mês anterior não conta
    await usage(cheap, 9_999_999, 9_999_999, "automation", "2026-09-10T00:00:00Z");

    const data = await metrics.getBillingMetrics(NOW);

    expect(data.textAi.pricingConfigured).toBe(true);
    expect(data.textAi.calls).toBe(3);
    expect(data.textAi.byFeature.map((item) => item.feature).sort()).toEqual(["ai-caption", "automation"]);
    const rate = data.textAi.usdBrl!;
    const cheapCost = (2 * (100_000 * 3 + 50_000 * 15)) / 1_000_000 * rate;
    const creator = data.plans.find((plan) => plan.code === "CREATOR")!;
    expect(creator.textCostBrl).toBeCloseTo(cheapCost, 5);
    expect(creator.netRevenueBrl).toBeGreaterThan(0);
    expect(creator.netRevenueBrl).toBeLessThan(24.9); // desconta taxa de pagamento e imposto
    expect(creator.marginPct!).toBeCloseTo(((creator.netRevenueBrl - cheapCost) / creator.netRevenueBrl) * 100, 5);
    expect(creator.marginPct!).toBeGreaterThan(0);
    const automation = data.plans.find((plan) => plan.code === "AUTOMATION")!;
    expect(automation.marginPct!).toBeLessThan(0);

    expect(data.heavyUsers[0].email).toBe("costly@x.com");
    expect(data.heavyUsers[0].loss).toBe(true);
    expect(data.heavyUsers.find((user) => user.email === "cheap@x.com")!.loss).toBe(false);
    expect(data.alerts.some((alert) => alert.includes("acima da mensalidade"))).toBe(true);
    expect(data.alerts.some((alert) => alert.includes("Margem estimada do plano Automático"))).toBe(true);
  });

  it("sem preço do modelo: mostra tokens, custo em branco e avisa o que configurar", async () => {
    delete process.env.CONTENT_AI_INPUT_USD_PER_MTOK;
    delete process.env.CONTENT_AI_OUTPUT_USD_PER_MTOK;
    const u = await user("u@x.com");
    await sub(u, { plan: "CREATOR", status: "ACTIVE", price: 2490, periodEnd: PERIOD_END });
    await usage(u, 1000, 2000);

    const data = await metrics.getBillingMetrics(NOW);

    expect(data.textAi.pricingConfigured).toBe(false);
    expect(data.textAi.tokensInput).toBe(1000);
    expect(data.textAi.costBrl).toBeNull();
    expect(data.plans.find((plan) => plan.code === "CREATOR")!.marginPct).toBeNull();
    expect(data.heavyUsers[0].costBrl).toBeNull();
    expect(data.heavyUsers[0].loss).toBe(false);
    expect(data.alerts.some((alert) => alert.includes("CONTENT_AI_INPUT_USD_PER_MTOK"))).toBe(true);
  });
});
