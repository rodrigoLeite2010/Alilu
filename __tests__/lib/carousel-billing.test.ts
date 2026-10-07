// Carrossel Inteligente — Fase 6: cobrança Asaas, desconto de cliente Alilu, webhook e métricas admin (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const asaas = vi.hoisted(() => ({
  createAsaasCustomer: vi.fn(),
  createAsaasSubscription: vi.fn(),
  getAsaasSubscription: vi.fn(),
  getAsaasPayment: vi.fn(),
  listAsaasSubscriptionPayments: vi.fn(),
  createAsaasPayment: vi.fn(),
  cancelAsaasSubscription: vi.fn(),
  updateAsaasSubscriptionValue: vi.fn(),
}));
vi.mock("@/lib/billing/backend/asaas-client", async (importOriginal) => ({ ...(await importOriginal<object>()), ...asaas }));

const sub = await import("@/lib/carousel/backend/carousel-subscription-service");
const repo = await import("@/lib/carousel/backend/carousel-billing-repository");
const access = await import("@/lib/carousel/backend/carousel-access-service");
const webhook = await import("@/lib/billing/backend/asaas-webhook-service");
const metrics = await import("@/lib/carousel/backend/carousel-admin-metrics");

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2026-11-07T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";
const CPF = "529.982.247-25";

async function user(email = "a@x.com"): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function aliluSub(userId: string, over: { status?: string; end?: string | null; complimentary?: boolean } = {}) {
  const end = over.end === undefined ? FUTURE : over.end;
  await db.sql`insert into automation_subscriptions (user_id, status, plan_code, current_period_ends_at, complimentary) values (${userId}, ${over.status ?? "ACTIVE"}, 'CREATOR', ${end}, ${over.complimentary ?? false})`;
}
async function activeCarousel(userId: string, over: { plan?: string; price?: number; list?: number; discount?: number; asaasId?: string } = {}) {
  await db.sql`
    insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, discount_percent, asaas_customer_id, asaas_subscription_id, started_at, current_period_ends_at)
    values (${userId}, ${over.plan ?? "STARTER"}, 'ACTIVE', ${over.list ?? 2990}, ${over.price ?? 2990}, ${over.discount ?? 0}, 'cus_1', ${over.asaasId ?? "sub_c1"}, ${PAST}, ${FUTURE})`;
}
let eventSeq = 0;
const event = (type: string, extra: Record<string, unknown> = {}) => ({ id: `evt_${++eventSeq}`, event: type, ...extra });

beforeEach(async () => {
  db = await createTestDb();
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.createAsaasCustomer.mockResolvedValue({ id: "cus_1" });
  asaas.createAsaasSubscription.mockResolvedValue({ id: "sub_c1", status: "ACTIVE", nextDueDate: "2026-10-07" });
  asaas.listAsaasSubscriptionPayments.mockResolvedValue([{ id: "pay_1", invoiceUrl: "https://asaas.test/i/1" }]);
  asaas.createAsaasPayment.mockResolvedValue({ id: "pay_up", invoiceUrl: "https://asaas.test/i/up" });
  asaas.cancelAsaasSubscription.mockResolvedValue(undefined);
  asaas.updateAsaasSubscriptionValue.mockResolvedValue(undefined);
});
afterEach(async () => {
  await db.close();
});

describe("checkout e desconto", () => {
  it("cliente novo paga o preço de tabela", async () => {
    const u = await user();
    const out = await sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW);
    expect(out.price).toEqual({ listPriceCents: 2990, priceCents: 2990, discountPercent: 0 });
    expect(out.checkoutUrl).toBe("https://asaas.test/i/1");
    expect(asaas.createAsaasSubscription).toHaveBeenCalledWith(expect.objectContaining({ value: 29.9, externalReference: `carousel:${u}` }));
    expect(out.subscription.status).toBe("PENDING_PAYMENT");
  });

  it("cliente Alilu com assinatura paga ativa ganha 10%, decidido no servidor", async () => {
    const u = await user();
    await aliluSub(u);
    const out = await sub.startCarouselCheckout(u, { planCode: "PRO", name: "Ana", cpfCnpj: CPF, ...({ priceCents: 1, discountPercent: 100 } as object) }, NOW);
    expect(out.price).toEqual({ listPriceCents: 4990, priceCents: 4491, discountPercent: 10 });
    expect(asaas.createAsaasSubscription).toHaveBeenCalledWith(expect.objectContaining({ value: 44.91 }));
    expect(out.subscription).toMatchObject({ listPriceCents: 4990, priceCents: 4491, discountPercent: 10 });
  });

  it.each([
    ["cortesia", { complimentary: true }],
    ["cancelada", { status: "CANCELED" }],
    ["em atraso", { status: "PAST_DUE" }],
    ["pendente", { status: "PENDING_PAYMENT" }],
    ["período vencido", { end: PAST }],
  ])("sem desconto: assinatura Alilu %s", async (_label, over) => {
    const u = await user();
    await aliluSub(u, over);
    const out = await sub.startCarouselCheckout(u, { planCode: "TURBO", name: "Ana", cpfCnpj: CPF }, NOW);
    expect(out.price.discountPercent).toBe(0);
    expect(out.price.priceCents).toBe(9990);
  });

  it("reaproveita o cliente do Asaas do Piloto", async () => {
    const u = await user();
    await db.sql`insert into automation_subscriptions (user_id, status, plan_code, asaas_customer_id) values (${u}, 'CANCELED', 'CREATOR', 'cus_piloto')`;
    await sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW);
    expect(asaas.createAsaasCustomer).not.toHaveBeenCalled();
    expect(asaas.createAsaasSubscription).toHaveBeenCalledWith(expect.objectContaining({ customerId: "cus_piloto" }));
  });

  it("valida CPF/nome e recusa quem já tem assinatura ativa", async () => {
    const u = await user();
    await expect(sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: "123" }, NOW)).rejects.toThrow(/CPF/);
    await expect(sub.startCarouselCheckout(u, { planCode: "STARTER", name: " ", cpfCnpj: CPF }, NOW)).rejects.toThrow(/nome/);
    await activeCarousel(u);
    await expect(sub.startCarouselCheckout(u, { planCode: "PRO", name: "Ana", cpfCnpj: CPF }, NOW)).rejects.toThrow(/já tem uma assinatura ativa/);
    expect(asaas.createAsaasSubscription).not.toHaveBeenCalled();
  });

  it("clicar duas vezes no mesmo plano reaproveita; trocar de plano cancela a pendente", async () => {
    const u = await user();
    await sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW);
    await sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW);
    expect(asaas.createAsaasSubscription).toHaveBeenCalledTimes(1);
    asaas.createAsaasSubscription.mockResolvedValueOnce({ id: "sub_c2", status: "ACTIVE", nextDueDate: "2026-10-07" });
    await sub.startCarouselCheckout(u, { planCode: "PRO", name: "Ana", cpfCnpj: CPF }, NOW);
    expect(asaas.cancelAsaasSubscription).toHaveBeenCalledWith("sub_c1");
    expect((await repo.getCarouselSubscription(u))?.planCode).toBe("PRO");
  });

  it("não cria assinatura em duplicidade sem link de pagamento", async () => {
    const u = await user();
    asaas.listAsaasSubscriptionPayments.mockResolvedValue([]);
    await expect(sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW)).rejects.toThrow(/link de pagamento/);
  });

  it("estado da tela de planos: desconto para cliente Alilu e preço travado para assinante", async () => {
    const u = await user();
    await aliluSub(u);
    const before = await sub.getCarouselBillingState(u, NOW);
    expect(before.existingAliluCustomer).toBe(true);
    expect(before.plans.map((p) => [p.code, p.priceCents, p.discountPercent])).toEqual([["STARTER", 2691, 10], ["PRO", 4491, 10], ["TURBO", 8991, 10], ["AGENCY", 17991, 10]]);
    const other = await user("b@x.com");
    await activeCarousel(other, { plan: "PRO", list: 4990, price: 4990, discount: 0 });
    const state = await sub.getCarouselBillingState(other, NOW);
    expect(state.plans.find((p) => p.code === "PRO")).toMatchObject({ current: true, priceCents: 4990, discountPercent: 0 });
  });
});

describe("webhook", () => {
  async function pendingCheckout(u: string) {
    await sub.startCarouselCheckout(u, { planCode: "STARTER", name: "Ana", cpfCnpj: CPF }, NOW);
  }
  it("pagamento confirmado libera o plano e a cota; reentrega é ignorada", async () => {
    const u = await user();
    await pendingCheckout(u);
    asaas.getAsaasPayment.mockResolvedValue({ id: "pay_1", status: "CONFIRMED", subscription: "sub_c1", dueDate: "2026-10-07", externalReference: null });
    asaas.getAsaasSubscription.mockResolvedValue({ id: "sub_c1", status: "ACTIVE", nextDueDate: "2026-11-07" });
    const e = event("PAYMENT_CONFIRMED", { payment: { id: "pay_1" } });
    expect((await webhook.processAsaasWebhookEvent(e, NOW)).status).toBe("processed");
    expect((await webhook.processAsaasWebhookEvent(e, NOW)).status).toBe("duplicate");
    const s = await repo.getCarouselSubscription(u);
    expect(s).toMatchObject({ status: "ACTIVE" });
    expect(s?.currentPeriodEndsAt?.toISOString()).toBe("2026-11-07T00:00:00.000Z");
    const a = await access.getCarouselAccess(u, NOW);
    expect(a).toMatchObject({ kind: "PLAN", allowed: true, limit: 60 });
  });
  it("atraso bloqueia e novo pagamento libera de novo", async () => {
    const u = await user();
    await activeCarousel(u);
    asaas.getAsaasPayment.mockResolvedValue({ id: "p", status: "OVERDUE", subscription: "sub_c1", dueDate: "2026-10-01", externalReference: null });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_OVERDUE", { payment: { id: "p" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.status).toBe("PAST_DUE");
    expect((await access.getCarouselAccess(u, NOW)).code).toBe("PAYMENT_OVERDUE");
    asaas.getAsaasPayment.mockResolvedValue({ id: "p", status: "CONFIRMED", subscription: "sub_c1", dueDate: "2026-10-01", externalReference: null });
    asaas.getAsaasSubscription.mockResolvedValue({ id: "sub_c1", status: "ACTIVE", nextDueDate: "2026-12-01" });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_CONFIRMED", { payment: { id: "p" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.status).toBe("ACTIVE");
  });
  it("cancelamento vindo do Asaas mantém acesso até o fim do período", async () => {
    const u = await user();
    await activeCarousel(u);
    await webhook.processAsaasWebhookEvent(event("SUBSCRIPTION_DELETED", { subscription: { id: "sub_c1" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.status).toBe("CANCELED");
    expect((await access.getCarouselAccess(u, NOW)).allowed).toBe(true);
    expect((await access.getCarouselAccess(u, new Date("2026-12-01T00:00:00Z"))).kind).not.toBe("PLAN");
  });
  it("evento do Piloto não toca na assinatura do Carrossel e vice-versa", async () => {
    const u = await user();
    await activeCarousel(u);
    await db.sql`insert into automation_subscriptions (user_id, status, asaas_subscription_id, plan_code) values (${u}, 'PENDING_PAYMENT', 'sub_piloto', 'CREATOR')`;
    asaas.getAsaasPayment.mockResolvedValue({ id: "p", status: "OVERDUE", subscription: "sub_piloto", dueDate: "2026-10-01", externalReference: null });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_OVERDUE", { payment: { id: "p" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.status).toBe("ACTIVE");
    const [automation] = await db.sql`select status from automation_subscriptions where user_id = ${u}`;
    expect(automation.status).toBe("PAST_DUE");
  });
  it("assinatura desconhecida é ignorada sem erro", async () => {
    asaas.getAsaasPayment.mockResolvedValue({ id: "p", status: "CONFIRMED", subscription: "sub_x", dueDate: "2026-10-01", externalReference: null });
    expect((await webhook.processAsaasWebhookEvent(event("PAYMENT_CONFIRMED", { payment: { id: "p" } }), NOW)).status).toBe("processed");
  });
});

describe("trocar de plano, cancelar e reativar", () => {
  it("upgrade: cobrança proporcional; plano só muda após o pagamento; desconto mantido", async () => {
    const u = await user();
    await activeCarousel(u, { plan: "STARTER", list: 2990, price: 2691, discount: 10 });
    const out = await sub.changeCarouselPlan(u, "PRO", NOW);
    expect(out.kind).toBe("upgrade");
    if (out.kind !== "upgrade") throw new Error("upgrade esperado");
    expect(out.amountCents).toBeGreaterThanOrEqual(500);
    expect(asaas.createAsaasPayment).toHaveBeenCalledWith(expect.objectContaining({ externalReference: `carousel-upgrade:${u}:PRO` }));
    expect((await repo.getCarouselSubscription(u))?.planCode).toBe("STARTER");

    asaas.getAsaasPayment.mockResolvedValue({ id: "pay_up", status: "RECEIVED", subscription: null, dueDate: "2026-10-07", externalReference: `carousel-upgrade:${u}:PRO` });
    const e = event("PAYMENT_RECEIVED", { payment: { id: "pay_up" } });
    await webhook.processAsaasWebhookEvent(e, NOW);
    expect(await repo.getCarouselSubscription(u)).toMatchObject({ planCode: "PRO", listPriceCents: 4990, priceCents: 4491, discountPercent: 10 });
    expect(asaas.updateAsaasSubscriptionValue).toHaveBeenCalledWith("sub_c1", 44.91);
    // evento atrasado/repetido com novo id: já está no plano, nada muda
    await webhook.processAsaasWebhookEvent(event("PAYMENT_RECEIVED", { payment: { id: "pay_up" } }), NOW);
    expect(asaas.updateAsaasSubscriptionValue).toHaveBeenCalledTimes(1);
  });
  it("cobrança de upgrade não paga não troca de plano", async () => {
    const u = await user();
    await activeCarousel(u);
    asaas.getAsaasPayment.mockResolvedValue({ id: "pay_up", status: "PENDING", subscription: null, dueDate: "2026-10-07", externalReference: `carousel-upgrade:${u}:PRO` });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_CONFIRMED", { payment: { id: "pay_up" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.planCode).toBe("STARTER");
  });
  it("downgrade: ciclo atual intacto; só vale quando o PRÓXIMO ciclo é pago", async () => {
    const u = await user();
    await activeCarousel(u, { plan: "TURBO", list: 9990, price: 9990 });
    const out = await sub.changeCarouselPlan(u, "STARTER", NOW);
    expect(out.kind).toBe("downgrade");
    expect(asaas.updateAsaasSubscriptionValue).toHaveBeenCalledWith("sub_c1", 29.9);
    expect(await repo.getCarouselSubscription(u)).toMatchObject({ planCode: "TURBO", pendingPlanCode: "STARTER" });
    // pagamento do MESMO ciclo (vencimento antes do fim do período): não troca
    asaas.getAsaasSubscription.mockResolvedValue({ id: "sub_c1", status: "ACTIVE", nextDueDate: "2026-11-07" });
    asaas.getAsaasPayment.mockResolvedValue({ id: "p1", status: "RECEIVED", subscription: "sub_c1", dueDate: "2026-10-01", externalReference: null });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_RECEIVED", { payment: { id: "p1" } }), NOW);
    expect((await repo.getCarouselSubscription(u))?.planCode).toBe("TURBO");
    // pagamento do próximo ciclo: troca
    asaas.getAsaasSubscription.mockResolvedValue({ id: "sub_c1", status: "ACTIVE", nextDueDate: "2026-12-07" });
    asaas.getAsaasPayment.mockResolvedValue({ id: "p2", status: "CONFIRMED", subscription: "sub_c1", dueDate: "2026-11-07", externalReference: null });
    await webhook.processAsaasWebhookEvent(event("PAYMENT_CONFIRMED", { payment: { id: "p2" } }), NOW);
    expect(await repo.getCarouselSubscription(u)).toMatchObject({ planCode: "STARTER", pendingPlanCode: null, priceCents: 2990 });
  });
  it("escolher o plano atual desfaz o downgrade agendado", async () => {
    const u = await user();
    await activeCarousel(u, { plan: "PRO", list: 4990, price: 4990 });
    await sub.changeCarouselPlan(u, "STARTER", NOW);
    const back = await sub.changeCarouselPlan(u, "PRO", NOW);
    expect(back.kind).toBe("downgrade");
    expect((await repo.getCarouselSubscription(u))?.pendingPlanCode).toBeNull();
    expect(asaas.updateAsaasSubscriptionValue).toHaveBeenLastCalledWith("sub_c1", 49.9);
    await expect(sub.changeCarouselPlan(u, "PRO", NOW)).rejects.toThrow(/já está no plano/);
  });
  it("trocar de plano exige assinatura paga ativa (cortesia/sem plano não)", async () => {
    const u = await user();
    await expect(sub.changeCarouselPlan(u, "PRO", NOW)).rejects.toThrow(/assinatura ativa/);
    await sub.adminGrantCarouselPlan(u, "STARTER", 30, null, NOW);
    await expect(sub.changeCarouselPlan(u, "PRO", NOW)).rejects.toThrow(/assinatura ativa/);
  });
  it("cancelar para o Asaas primeiro e mantém acesso; reativar cria nova cobrança só no fim do período", async () => {
    const u = await user();
    await activeCarousel(u);
    const canceled = await sub.cancelCarouselSubscription(u, NOW);
    expect(canceled.status).toBe("CANCELED");
    expect(asaas.cancelAsaasSubscription).toHaveBeenCalledWith("sub_c1");
    await expect(sub.cancelCarouselSubscription(u, NOW)).rejects.toThrow(/já está cancelada/);
    asaas.createAsaasSubscription.mockResolvedValue({ id: "sub_new", status: "ACTIVE", nextDueDate: "2026-11-07" });
    const re = await sub.reactivateCarouselSubscription(u, NOW);
    expect(re).toMatchObject({ status: "ACTIVE", asaasSubscriptionId: "sub_new" });
    expect(asaas.createAsaasSubscription).toHaveBeenCalledWith(expect.objectContaining({ nextDueDate: "2026-11-07", value: 29.9 }));
  });
  it("não reativa depois do período pago", async () => {
    const u = await user();
    await activeCarousel(u);
    await db.sql`update carousel_subscriptions set status = 'CANCELED', current_period_ends_at = ${PAST} where user_id = ${u}`;
    await expect(sub.reactivateCarouselSubscription(u, NOW)).rejects.toThrow(/período já pago terminou/);
  });
});

describe("cortesia do admin", () => {
  it("concede, dá acesso e acaba na data; não sobrepõe pagante", async () => {
    const u = await user();
    const granted = await sub.adminGrantCarouselPlan(u, "PRO", 30, "parceria", NOW);
    expect(granted).toMatchObject({ complimentary: true, status: "ACTIVE", planCode: "PRO" });
    expect((await access.getCarouselAccess(u, NOW)).limit).toBe(90);
    expect((await access.getCarouselAccess(u, new Date("2026-12-01T00:00:00Z"))).kind).not.toBe("PLAN");
    expect(await sub.adminEndCarouselComplimentary(u, NOW)).toBe(true);
    const payer = await user("p@x.com");
    await activeCarousel(payer);
    await expect(sub.adminGrantCarouselPlan(payer, "PRO", 30, null, NOW)).rejects.toThrow(/assinatura paga ativa/);
    await expect(sub.adminGrantCarouselPlan(u, "PRO", 0, null, NOW)).rejects.toThrow(/1 a 365/);
  });
  it("cortesia não dá desconto de cliente Alilu no outro produto", async () => {
    const u = await user();
    await sub.adminGrantCarouselPlan(u, "PRO", 30, null, NOW);
    expect(await access.isExistingAliluCustomer(u, NOW)).toBe(false);
  });
});

describe("métricas do admin", () => {
  it("MRR, descontos, teste, uso e custo de IA", async () => {
    const a = await user("a@x.com");
    const b = await user("b@x.com");
    const c = await user("c@x.com");
    await activeCarousel(a, { plan: "STARTER", list: 2990, price: 2691, discount: 10, asaasId: "s_a" });
    await activeCarousel(b, { plan: "PRO", list: 4990, price: 4990, asaasId: "s_b" });
    await sub.adminGrantCarouselPlan(c, "TURBO", 30, null, NOW);
    const [proj] = await db.sql`insert into carousel_projects (user_id, topic, completed_at) values (${a}, 't', now()) returning id`;
    await db.sql`insert into generation_usage (user_id, feature, provider, model, tokens_input, tokens_output, web_searches, carousel_project_id) values (${a}, 'carousel_research', 'anthropic', 'm', 1000, 2000, 3, ${proj.id})`;
    await db.sql`insert into carousel_trial_claims (user_id, email_key, project_id) values (${c}, 'c@x.com', ${proj.id})`;
    const m = await metrics.getCarouselAdminMetrics(new Date());
    expect(m.mrr.totalCents).toBe(2691 + 4990);
    expect(m.mrr.discountGivenCents).toBe(299);
    expect(m.subscribers).toMatchObject({ active: 2, complimentary: 1 });
    expect(m.plans.find((p) => p.code === "STARTER")).toMatchObject({ subscribers: 1, discounted: 1 });
    expect(m.ai).toMatchObject({ calls: 1, webSearches: 3, tokensInput: 1000, tokensOutput: 2000 });
    expect(m.projects.completedMonth).toBe(1);
    expect(m.trial.claimedTotal).toBe(1);
    expect(m.heavyUsers[0]).toMatchObject({ email: "a@x.com", webSearches: 3 });
    expect(m.alerts.length).toBeGreaterThan(0); // sem chaves/preços no ambiente de teste
  });
  it("custo da busca: US$ 10 por 1.000 buscas por padrão, sobrescrevível", () => {
    expect(metrics.readWebSearchUsdPerRequest({})).toBeCloseTo(0.01);
    expect(metrics.readWebSearchUsdPerRequest({ CAROUSEL_WEB_SEARCH_USD_PER_1K: "12,5" })).toBeCloseTo(0.0125);
    expect(metrics.readWebSearchUsdPerRequest({ CAROUSEL_WEB_SEARCH_USD_PER_1K: "x" })).toBeCloseTo(0.01);
  });
});
