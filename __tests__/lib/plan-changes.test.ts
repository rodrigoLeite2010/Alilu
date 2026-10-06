// Fase 3: checkout por plano, upgrade (cobrança proporcional), downgrade
// agendado e mapeamento do plano no webhook — contra Postgres real em
// memória (PGlite); só o Asaas (global.fetch) é mockado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const service = await import("@/lib/billing/backend/subscription-service");
const webhook = await import("@/lib/billing/backend/asaas-webhook-service");
const { SubscriptionBusinessError } = await import("@/lib/billing/backend/billing-types");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const originalFetch = global.fetch;
const fetchMock = vi.fn();
const NOW = new Date("2026-10-06T12:00:00.000Z");

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`plan-user${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedActive(
  userId: string,
  opts: { plan?: string; price?: number; periodEnds?: string; pending?: string | null } = {},
) {
  await db.sql`
    insert into automation_subscriptions
      (user_id, status, asaas_customer_id, asaas_subscription_id, plan_code, monthly_price_cents, pending_plan_code, current_period_ends_at, started_at)
    values (${userId}, 'ACTIVE', 'cus_1', 'sub_1', ${opts.plan ?? "AUTOMATION"}, ${opts.price ?? 1900},
            ${opts.pending ?? null}, ${opts.periodEnds ?? "2026-10-21T00:00:00.000Z"}, now())
  `;
}

async function row(userId: string) {
  const [r] = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
  return r;
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as { body: string }).body) as Record<string, unknown>;
}

beforeEach(async () => {
  db = await createTestDb();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  process.env.ASAAS_API_KEY = "sandbox-key-de-teste";
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
});

afterEach(async () => {
  await db.close();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("computeUpgradeProrationCents", () => {
  it("proporcional aos dias que faltam, com mínimo de R$ 5", () => {
    // 19 -> 49,90 = 30,90 de diferença; faltam 15 dias de 30 => ~15,45
    expect(service.computeUpgradeProrationCents(1900, 4990, new Date("2026-10-21T00:00:00Z"), NOW)).toBe(1545);
    // falta 1 dia => abaixo do mínimo, cobra R$ 5
    expect(service.computeUpgradeProrationCents(2490, 4990, new Date("2026-10-07T00:00:00Z"), NOW)).toBe(500);
    // ciclo recém-pago (30 dias) => diferença cheia
    expect(service.computeUpgradeProrationCents(1900, 2490, new Date("2026-11-05T12:00:00Z"), NOW)).toBe(590);
  });
});

describe("checkout por plano", () => {
  it("cria a assinatura no preço do plano escolhido e grava o plano (ainda sem liberar acesso)", async () => {
    const userId = await seedUser();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "cus_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_1", status: "PENDING" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "pay_1", status: "PENDING", invoiceUrl: "https://asaas/i/1", value: 49.9, dueDate: "2026-10-06" }] }));

    const result = await service.startAutomationCheckout(
      userId,
      { planCode: "PRO", name: "Fulano", cpfCnpj: "12345678900" },
      NOW,
    );

    expect(bodyOf(fetchMock.mock.calls[1]).value).toBe(49.9);
    expect(result.subscription.status).toBe("PENDING_PAYMENT");
    expect(result.subscription.planCode).toBe("PRO");
    expect(result.subscription.monthlyPriceCents).toBe(4990);
  });

  it("trocar de plano antes de pagar cancela a cobrança pendente anterior e cria outra", async () => {
    const userId = await seedUser();
    await db.sql`
      insert into automation_subscriptions (user_id, status, asaas_customer_id, asaas_subscription_id, plan_code, monthly_price_cents)
      values (${userId}, 'PENDING_PAYMENT', 'cus_1', 'sub_old', 'AUTOMATION', 1900)`;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, {})) // DELETE sub_old
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_new", status: "PENDING" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "pay_n", status: "PENDING", invoiceUrl: "https://asaas/i/n", value: 24.9, dueDate: "2026-10-06" }] }));

    await service.startAutomationCheckout(userId, { planCode: "CREATOR", name: "Fulano", cpfCnpj: "12345678900" }, NOW);

    expect((fetchMock.mock.calls[0][1] as { method: string }).method).toBe("DELETE");
    const r = await row(userId);
    expect(r.asaas_subscription_id).toBe("sub_new");
    expect(r.plan_code).toBe("CREATOR");
    expect(r.monthly_price_cents).toBe(2490);
  });

  it("quem já tem assinatura ativa não faz novo checkout (troca de plano é outro fluxo)", async () => {
    const userId = await seedUser();
    await seedActive(userId);
    await expect(
      service.startAutomationCheckout(userId, { planCode: "PRO", name: "F", cpfCnpj: "12345678900" }, NOW),
    ).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("changeAutomationPlan", () => {
  it("upgrade: cria cobrança avulsa proporcional e NÃO muda o plano antes do pagamento", async () => {
    const userId = await seedUser();
    await seedActive(userId);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "pay_up", status: "PENDING", invoiceUrl: "https://asaas/i/up" }));

    const result = await service.changeAutomationPlan(userId, "CREATOR", NOW);

    expect(result.kind).toBe("upgrade");
    if (result.kind !== "upgrade") throw new Error("esperava upgrade");
    expect(result.checkoutUrl).toBe("https://asaas/i/up");
    expect(result.amountCents).toBe(500); // (24,90-19) * 15/30 = 2,95 -> mínimo R$ 5
    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.externalReference).toBe(`plan-upgrade:${userId}:CREATOR`);
    expect(body.value).toBe(5);
    expect((await row(userId)).plan_code).toBe("AUTOMATION");
  });

  it("downgrade: baixa o valor do próximo ciclo no Asaas e só agenda (plano atual segue)", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990 });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const result = await service.changeAutomationPlan(userId, "CREATOR", NOW);

    expect(result.kind).toBe("downgrade");
    const call = fetchMock.mock.calls[0];
    expect((call[1] as { method: string }).method).toBe("PUT");
    expect(bodyOf(call)).toMatchObject({ value: 24.9, updatePendingPayments: true });
    const r = await row(userId);
    expect(r.plan_code).toBe("PRO");
    expect(r.pending_plan_code).toBe("CREATOR");
  });

  it("escolher o plano atual com downgrade agendado desfaz o agendamento e restaura o valor", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990, pending: "CREATOR" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await service.changeAutomationPlan(userId, "PRO", NOW);

    expect(bodyOf(fetchMock.mock.calls[0]).value).toBe(49.9);
    expect((await row(userId)).pending_plan_code).toBeNull();
  });

  it("recusa mesmo plano sem agendamento e quem não tem assinatura ativa", async () => {
    const userId = await seedUser();
    await expect(service.changeAutomationPlan(userId, "PRO", NOW)).rejects.toBeInstanceOf(SubscriptionBusinessError);
    await seedActive(userId);
    await expect(service.changeAutomationPlan(userId, "AUTOMATION", NOW)).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("webhook: upgrade e downgrade", () => {
  it("pagamento do upgrade confirmado: plano sobe, preço da assinatura sobe no Asaas; reentrega não repete", async () => {
    const userId = await seedUser();
    await seedActive(userId);
    const event = { id: "evt_up", event: "PAYMENT_CONFIRMED", payment: { object: "payment", id: "pay_up" } };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "pay_up", status: "CONFIRMED", subscription: null, value: 5, externalReference: `plan-upgrade:${userId}:PRO` }))
      .mockResolvedValueOnce(jsonResponse(200, {})); // PUT subscription

    await webhook.processAsaasWebhookEvent(event, NOW);

    const r = await row(userId);
    expect(r.plan_code).toBe("PRO");
    expect(r.monthly_price_cents).toBe(4990);
    expect(bodyOf(fetchMock.mock.calls[1]).value).toBe(49.9);

    const dup = await webhook.processAsaasWebhookEvent(event, NOW);
    expect(dup.status).toBe("duplicate");
  });

  it("evento de upgrade atrasado para um plano menor ou igual ao atual é ignorado", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990 });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "pay_x", status: "RECEIVED", subscription: null, externalReference: `plan-upgrade:${userId}:CREATOR` }),
    );

    await webhook.processAsaasWebhookEvent({ id: "evt_late", event: "PAYMENT_RECEIVED", payment: { object: "payment", id: "pay_x" } }, NOW);

    expect((await row(userId)).plan_code).toBe("PRO");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cobrança de upgrade não paga (status PENDING) não muda nada", async () => {
    const userId = await seedUser();
    await seedActive(userId);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "pay_p", status: "PENDING", subscription: null, externalReference: `plan-upgrade:${userId}:PRO` }),
    );

    await webhook.processAsaasWebhookEvent({ id: "evt_p", event: "PAYMENT_CONFIRMED", payment: { object: "payment", id: "pay_p" } }, NOW);

    expect((await row(userId)).plan_code).toBe("AUTOMATION");
  });

  it("downgrade agendado vale quando o pagamento do PRÓXIMO ciclo é confirmado", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990, pending: "CREATOR", periodEnds: "2026-10-21T00:00:00.000Z" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "pay_n", status: "CONFIRMED", subscription: "sub_1", dueDate: "2026-10-21" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_1", status: "ACTIVE", nextDueDate: "2026-11-21" }));

    await webhook.processAsaasWebhookEvent({ id: "evt_n", event: "PAYMENT_CONFIRMED", payment: { object: "payment", id: "pay_n" } }, NOW);

    const r = await row(userId);
    expect(r.plan_code).toBe("CREATOR");
    expect(r.monthly_price_cents).toBe(2490);
    expect(r.pending_plan_code).toBeNull();
  });

  it("PAYMENT_RECEIVED atrasado do ciclo JÁ pago não aplica o downgrade antes da hora", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990, pending: "CREATOR", periodEnds: "2026-10-21T00:00:00.000Z" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "pay_old", status: "RECEIVED", subscription: "sub_1", dueDate: "2026-09-21" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_1", status: "ACTIVE", nextDueDate: "2026-10-21" }));

    await webhook.processAsaasWebhookEvent({ id: "evt_o", event: "PAYMENT_RECEIVED", payment: { object: "payment", id: "pay_old" } }, NOW);

    const r = await row(userId);
    expect(r.plan_code).toBe("PRO");
    expect(r.pending_plan_code).toBe("CREATOR");
  });

  it("cancelar a assinatura limpa o downgrade agendado", async () => {
    const userId = await seedUser();
    await seedActive(userId, { plan: "PRO", price: 4990, pending: "CREATOR" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await service.cancelAutomationSubscription(userId, NOW);

    const r = await row(userId);
    expect(r.status).toBe("CANCELED");
    expect(r.pending_plan_code).toBeNull();
  });
});
