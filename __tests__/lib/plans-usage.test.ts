// Planos (Automático R$ 19 / Criador / Pro), franquia de publicações com IA
// por ciclo, importador só para pagos, botão de IA, avisos e o crédito a
// R$ 0,05 — contra Postgres REAL em memória (PGlite, mesmas migrações de produção).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
const originalExemptEmails = process.env.AUTOMATION_BILLING_EXEMPT_EMAILS;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const plans = await import("@/lib/billing/plans");
const usage = await import("@/lib/billing/backend/plan-usage-repository");
const access = await import("@/lib/billing/backend/automation-access-service");
const { SubscriptionRequiredError } = await import("@/lib/billing/backend/billing-types");

const NOW = new Date("2026-10-06T15:00:00.000Z"); // 12h em São Paulo
const PERIOD_END = "2026-10-20T00:00:00.000Z";

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`plan-user${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedPaid(plan: "AUTOMATION" | "CREATOR" | "PRO", status = "ACTIVE", suffix = "1") {
  const userId = await seedUser(suffix);
  await db.sql`
    insert into automation_subscriptions (user_id, status, plan_code, current_period_ends_at)
    values (${userId}, ${status}, ${plan}, ${PERIOD_END})
  `;
  return userId;
}

async function setUsed(userId: string, used: number, cycleKey = "2026-10-20") {
  await db.sql`
    insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${userId}, ${cycleKey}, 'CREATOR', ${used})
    on conflict (user_id, cycle_key) do update set used = ${used}
  `;
}

async function cycleUsed(userId: string, cycleKey = "2026-10-20") {
  const [row] = await db.sql`select used from plan_usage_cycles where user_id = ${userId} and cycle_key = ${cycleKey}`;
  return row ? Number(row.used) : 0;
}

async function code(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(SubscriptionRequiredError);
  return (error as InstanceType<typeof SubscriptionRequiredError>).code;
}

beforeEach(async () => {
  db = await createTestDb();
  process.env.AUTOMATION_BILLING_EXEMPT_EMAILS = "";
});
afterEach(async () => {
  await db.close();
  process.env.AUTOMATION_BILLING_EXEMPT_EMAILS = originalExemptEmails;
  vi.restoreAllMocks();
});

describe("catálogo de planos", () => {
  it("preços e limites vêm de um lugar só", () => {
    expect(plans.PLAN_DEFINITIONS.AUTOMATION.priceCents).toBe(1900);
    expect(plans.PLAN_DEFINITIONS.CREATOR).toMatchObject({ priceCents: 2490, aiPostsPerCycle: 90, aiDailyReference: 3, includesAi: true });
    expect(plans.PLAN_DEFINITIONS.PRO).toMatchObject({ priceCents: 4990, aiPostsPerCycle: 300, aiDailyReference: 10, includesAi: true });
    expect(plans.PLAN_DEFINITIONS.AUTOMATION.includesAi).toBe(false);
    expect(plans.listPlans().map((plan) => plan.code)).toEqual(["AUTOMATION", "CREATOR", "PRO"]);
    expect(plans.cheapestAiPlan().code).toBe("CREATOR");
    expect(plans.FREE_TRIAL).toMatchObject({ days: 7, dailyLimit: 3, includesImporter: false });
  });
});

describe("franquia por ciclo (reserva atômica)", () => {
  it("nunca passa do limite, mesmo com requisições simultâneas", async () => {
    const userId = await seedPaid("CREATOR");
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        usage.reservePlanUsage({ userId, cycleKey: "2026-10-20", planCode: "CREATOR", limit: 3, referenceType: "T", referenceId: `r${index}` }),
      ),
    );
    expect(results.filter((result) => result.status === "reserved")).toHaveLength(3);
    expect(results.filter((result) => result.status === "limit")).toHaveLength(5);
    expect(await cycleUsed(userId)).toBe(3);
    const events = await db.sql`select * from plan_usage_events where user_id = ${userId}`;
    expect(events).toHaveLength(3); // reserva recusada não deixa evento
  });

  it("a mesma referência (retry/clique duplo) conta uma vez só", async () => {
    const userId = await seedPaid("CREATOR");
    const input = { userId, cycleKey: "2026-10-20", planCode: "CREATOR", limit: 5, referenceType: "T", referenceId: "mesma" };
    expect((await usage.reservePlanUsage(input)).status).toBe("reserved");
    expect((await usage.reservePlanUsage(input)).status).toBe("duplicate");
    expect(await cycleUsed(userId)).toBe(1);
  });

  it("devolver é idempotente e a mesma referência pode reservar de novo (retry do cron)", async () => {
    const userId = await seedPaid("CREATOR");
    const ref = { userId, referenceType: "T", referenceId: "run-1" };
    const input = { ...ref, cycleKey: "2026-10-20", planCode: "CREATOR", limit: 5 };
    await usage.reservePlanUsage(input);
    expect(await usage.releasePlanUsage(ref)).toBe(true);
    expect(await usage.releasePlanUsage(ref)).toBe(false);
    expect(await cycleUsed(userId)).toBe(0);
    expect((await usage.reservePlanUsage(input)).status).toBe("reserved");
    expect(await cycleUsed(userId)).toBe(1);
  });

  it("devolução com a franquia cheia não deixa reservar acima do limite", async () => {
    const userId = await seedPaid("CREATOR");
    const ref = { userId, referenceType: "T", referenceId: "x" };
    const base = { cycleKey: "2026-10-20", planCode: "CREATOR", limit: 1 };
    await usage.reservePlanUsage({ ...ref, ...base });
    await usage.releasePlanUsage(ref);
    await usage.reservePlanUsage({ ...ref, referenceId: "y", ...base }); // outra execução ocupa a vaga
    expect((await usage.reservePlanUsage({ ...ref, ...base })).status).toBe("limit");
    expect(await cycleUsed(userId)).toBe(1);
  });

  it("ciclo novo (renovação) começa zerado", async () => {
    const userId = await seedPaid("CREATOR");
    await setUsed(userId, 90, "2026-10-20");
    const result = await usage.reservePlanUsage({ userId, cycleKey: "2026-11-20", planCode: "CREATOR", limit: 90, referenceType: "T", referenceId: "n" });
    expect(result).toEqual({ status: "reserved", used: 1 });
  });
});

describe("reserveAutomationUse por plano", () => {
  it("Automático (R$ 19): texto manual sem limite; IA é negada com convite de upgrade", async () => {
    const userId = await seedPaid("AUTOMATION");
    for (let index = 0; index < 5; index += 1) {
      await access.reserveAutomationUse(userId, NOW, { usesAi: false, referenceId: `m${index}` });
    }
    expect(await cycleUsed(userId)).toBe(0);
    const denied = access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "ia" });
    expect(await code(denied)).toBe("AI_PLAN_REQUIRED");
    await expect(access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "ia2" })).rejects.toThrow(/Criador/);
  });

  it("Criador: IA consome a franquia; esgotada, bloqueia a IA mas o texto manual segue livre", async () => {
    const userId = await seedPaid("CREATOR");
    const reservation = await access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "a" });
    expect(reservation.consumedTrialSlot).toBe(false);
    expect(await cycleUsed(userId)).toBe(1);

    await setUsed(userId, 90);
    expect(await code(access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "b" }))).toBe("PLAN_LIMIT_REACHED");
    await expect(access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "c" })).rejects.toThrow(/Pro/);
    await expect(access.reserveAutomationUse(userId, NOW, { usesAi: false, referenceId: "d" })).resolves.toBeDefined();
    expect(await cycleUsed(userId)).toBe(90);
  });

  it("Pro: limite de 300 e aviso de que renova no próximo ciclo", async () => {
    const userId = await seedPaid("PRO");
    await setUsed(userId, 300);
    await expect(access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "p" })).rejects.toThrow(/300 publicações/);
  });

  it("falha na geração devolve a vaga; retry da mesma execução não conta duas vezes", async () => {
    const userId = await seedPaid("CREATOR");
    const first = await access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "run-9" });
    await access.releaseAutomationUse(first);
    expect(await cycleUsed(userId)).toBe(0);
    await access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "run-9" });
    await access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "run-9" });
    expect(await cycleUsed(userId)).toBe(1);
  });

  it("teste grátis: IA liberada dentro de 3 por dia; o dia vira à meia-noite de São Paulo (não 21h)", async () => {
    const userId = await seedUser();
    await access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "1" });
    await access.reserveAutomationUse(userId, new Date("2026-10-06T20:00:00.000Z"), { usesAi: true, referenceId: "2" });
    // 22h em São Paulo (01h UTC do dia 7): ainda é o mesmo dia civil do Brasil.
    await access.reserveAutomationUse(userId, new Date("2026-10-07T01:00:00.000Z"), { usesAi: true, referenceId: "3" });
    expect(await code(access.reserveAutomationUse(userId, new Date("2026-10-07T02:00:00.000Z"), { usesAi: false }))).toBe("TRIAL_DAILY_LIMIT");
    // 00h05 em São Paulo (03h05 UTC): dia novo, contador zerado.
    await expect(access.reserveAutomationUse(userId, new Date("2026-10-07T03:05:00.000Z"), { usesAi: true })).resolves.toBeDefined();
  });

  it("pagamento em atraso e pendente têm códigos próprios", async () => {
    const overdue = await seedPaid("CREATOR", "PAST_DUE", "2");
    expect(await code(access.reserveAutomationUse(overdue, NOW, { usesAi: true }))).toBe("PAYMENT_OVERDUE");
    const pending = await seedPaid("CREATOR", "PENDING_PAYMENT", "3");
    expect(await code(access.reserveAutomationUse(pending, NOW, { usesAi: true }))).toBe("PAYMENT_PENDING");
  });

  it("assinatura cancelada continua valendo até o fim do período pago, com o plano que tinha", async () => {
    const userId = await seedPaid("CREATOR", "CANCELED");
    await expect(access.reserveAutomationUse(userId, NOW, { usesAi: true, referenceId: "k" })).resolves.toBeDefined();
    expect(await code(access.reserveAutomationUse(userId, new Date("2026-10-21T12:00:00.000Z"), { usesAi: true }))).toBe("SUBSCRIPTION_REQUIRED");
  });
});

describe("importador de Instagram: só planos pagos", () => {
  it("sem plano e no teste: bloqueado; qualquer plano pago: liberado", async () => {
    const none = await seedUser("n");
    expect(await access.canUseImporter(none, NOW)).toMatchObject({ allowed: false, code: "PAID_PLAN_REQUIRED" });
    await db.sql`insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at) values (${none}, 'TRIAL', ${NOW.toISOString()}, '2026-10-12T00:00:00Z')`;
    expect((await access.canUseImporter(none, NOW)).allowed).toBe(false);
    for (const plan of ["AUTOMATION", "CREATOR", "PRO"] as const) {
      expect((await access.canUseImporter(await seedPaid(plan, "ACTIVE", `i-${plan}`), NOW)).allowed).toBe(true);
    }
    expect(await access.canUseImporter(await seedPaid("PRO", "PAST_DUE", "od"), NOW)).toMatchObject({ allowed: false, code: "PAYMENT_OVERDUE" });
  });

  it("e-mail isento (administração) passa", async () => {
    const userId = await seedUser("ex");
    process.env.AUTOMATION_BILLING_EXEMPT_EMAILS = "plan-userex@example.com";
    expect((await access.canUseImporter(userId, NOW)).allowed).toBe(true);
    expect((await access.canUseAiCaption(userId, NOW)).allowed).toBe(true);
  });
});

describe("botão de IA do compositor", () => {
  it("quem não tem plano com IA recebe o convite de upgrade; Criador/Pro e teste válido usam", async () => {
    expect(await access.canUseAiCaption(await seedUser("a"), NOW)).toMatchObject({ allowed: false, code: "AI_PLAN_REQUIRED" });
    const auto = await access.canUseAiCaption(await seedPaid("AUTOMATION", "ACTIVE", "b"), NOW);
    expect(auto).toMatchObject({ allowed: false, code: "AI_PLAN_REQUIRED" });
    expect(auto.reason).toMatch(/Criador/);
    expect((await access.canUseAiCaption(await seedPaid("CREATOR", "ACTIVE", "c"), NOW)).allowed).toBe(true);
    expect((await access.canUseAiCaption(await seedPaid("PRO", "ACTIVE", "d"), NOW)).allowed).toBe(true);

    const trial = await seedUser("t");
    await db.sql`insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at) values (${trial}, 'TRIAL', ${NOW.toISOString()}, '2026-10-12T00:00:00Z')`;
    expect((await access.canUseAiCaption(trial, NOW)).allowed).toBe(true);
    expect(await access.canUseAiCaption(trial, new Date("2026-10-13T12:00:00.000Z"))).toMatchObject({ allowed: false, code: "TRIAL_ENDED" });
  });

  it("tem teto diário de legendas", async () => {
    const userId = await seedPaid("CREATOR");
    for (let index = 0; index < plans.AI_CAPTION_DAILY_CAP; index += 1) {
      await db.sql`insert into generation_usage (user_id, feature, provider, model) values (${userId}, 'ai_caption', 'anthropic', 'm')`;
    }
    expect(await access.canUseAiCaption(userId, new Date())).toMatchObject({ allowed: false, code: "AI_DAILY_CAP" });
  });
});

describe("pode configurar IA na automação", () => {
  it("planos sem IA e teste vencido não; teste, plano com IA e quem ainda não começou sim", async () => {
    expect((await access.canUseAiAutomation(await seedUser("new"), NOW)).allowed).toBe(true);
    expect((await access.canUseAiAutomation(await seedPaid("CREATOR", "ACTIVE", "c"), NOW)).allowed).toBe(true);
    expect(await access.canUseAiAutomation(await seedPaid("AUTOMATION", "ACTIVE", "a"), NOW)).toMatchObject({ allowed: false, code: "AI_PLAN_REQUIRED" });
    const expired = await seedUser("exp");
    await db.sql`insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at) values (${expired}, 'TRIAL', '2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z')`;
    expect(await access.canUseAiAutomation(expired, NOW)).toMatchObject({ allowed: false, code: "TRIAL_ENDED" });
  });
});

describe("resumo e avisos", () => {
  it("Criador com 72 de 90: aviso de proximidade, restantes e ritmo diário", async () => {
    const userId = await seedPaid("CREATOR");
    await setUsed(userId, 72);
    for (let index = 0; index < 4; index += 1) {
      await usage.reservePlanUsage({ userId, cycleKey: "2026-10-20", planCode: "CREATOR", limit: 90, referenceType: "D", referenceId: `d${index}` });
    }
    const summary = await access.getBillingSummary(userId, NOW);
    expect(summary.plan).toMatchObject({ code: "CREATOR", name: "Criador", priceCents: 2490 });
    expect(summary.features).toEqual({ manualAutomation: true, ai: true, importer: true });
    expect(summary.aiUsage).toMatchObject({ used: 76, limit: 90, remaining: 14, dailyUsed: 4, dailyReference: 3 });
    const codes = summary.notices.map((notice) => notice.code);
    expect(codes).toContain("PLAN_LIMIT_NEAR");
    expect(codes).toContain("DAILY_PACE");
    expect(summary.notices.find((notice) => notice.code === "PLAN_LIMIT_NEAR")?.message).toMatch(/76 de 90.*Restam 14/);
  });

  it("franquia esgotada vira aviso de bloqueio, e o primeiro aviso é o mais grave", async () => {
    const userId = await seedPaid("CREATOR");
    await setUsed(userId, 90);
    const summary = await access.getBillingSummary(userId, NOW);
    expect(summary.notices[0]).toMatchObject({ code: "PLAN_LIMIT_REACHED", level: "blocked" });
  });

  it("plano Automático: sem IA, com importador, sem franquia", async () => {
    const summary = await access.getBillingSummary(await seedPaid("AUTOMATION"), NOW);
    expect(summary.features).toEqual({ manualAutomation: true, ai: false, importer: true });
    expect(summary.aiUsage).toBeNull();
  });

  it("teste: avisa quando resta 1 automação hoje e quando está acabando", async () => {
    const userId = await seedUser("tt");
    await db.sql`
      insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at, trial_usage_date, trial_usage_count)
      values (${userId}, 'TRIAL', '2026-09-30T12:00:00Z', '2026-10-07T12:00:00Z', '2026-10-06', 2)
    `;
    const summary = await access.getBillingSummary(userId, NOW);
    expect(summary.features).toEqual({ manualAutomation: true, ai: true, importer: false });
    const codes = summary.notices.map((notice) => notice.code);
    expect(codes).toContain("TRIAL_DAILY_LAST");
    expect(codes).toContain("TRIAL_ENDING");
  });

  it("downgrade agendado aparece como plano pendente", async () => {
    const userId = await seedPaid("PRO");
    await db.sql`update automation_subscriptions set pending_plan_code = 'CREATOR' where user_id = ${userId}`;
    const summary = await access.getBillingSummary(userId, NOW);
    expect(summary.pendingPlan).toEqual({ code: "CREATOR", name: "Criador" });
    expect(summary.plan?.code).toBe("PRO"); // o limite do Pro vale até o fim do ciclo
  });
});

describe("crédito a R$ 0,05 (100 créditos = R$ 5)", () => {
  it("regra comercial ativa, pacotes novos e preços de vídeo recalculados", async () => {
    const [config] = await db.sql`
      select * from ai_pricing_config where is_active and effective_from <= now() order by effective_from desc, created_at desc limit 1
    `;
    expect(Number(config.credit_value_brl)).toBe(0.05);
    expect(Number(config.target_gross_margin_pct)).toBe(50);

    const packages = await db.sql`select code, credits, price_cents from ai_credit_packages where is_active order by display_order`;
    expect(packages).toEqual([
      { code: "C100", credits: 100, price_cents: 500 },
      { code: "C500", credits: 500, price_cents: 2500 },
      { code: "C1000", credits: 1000, price_cents: 5000 },
      { code: "C2000", credits: 2000, price_cents: 10000 },
    ]);
    for (const row of packages) expect(Number(row.price_cents) / Number(row.credits)).toBe(5); // 1 crédito = 5 centavos

    // Mesma fórmula do admin (lib/ai-video/pricing.ts): a margem alvo de 50% é preservada.
    const { economicsForCredits } = await import("@/lib/ai-video/pricing");
    const { getActivePricingConfig, listModelPricing } = await import("@/lib/ai-video/backend/pricing-repository");
    const pricingConfig = await getActivePricingConfig();
    const rows = (await listModelPricing()).filter((row) => row.isActive);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(economicsForCredits(pricingConfig, row, row.aliluCreditCost).grossMarginPct).toBeGreaterThanOrEqual(50);
    }
    const economico = rows.find((row) => row.tier === "ECONOMICO");
    expect(economico?.aliluCreditCost).toBeLessThan(65); // antes de R$ 0,04/crédito eram 65
  });
});
