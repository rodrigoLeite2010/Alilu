// Processamento de eventos de Webhook do Asaas contra um Postgres REAL
// em memória (PGlite) — só as consultas servidor-servidor de volta ao
// Asaas (GET /payments/{id}, GET /subscriptions/{id}) são mockadas via
// global.fetch. Cobre idempotência, confirmação de pagamento → ACTIVE,
// atraso → PAST_DUE, e cancelamento vindo do Asaas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const webhook = await import("@/lib/billing/backend/asaas-webhook-service");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const originalFetch = global.fetch;
const originalApiKey = process.env.ASAAS_API_KEY;
const originalBaseUrl = process.env.ASAAS_BASE_URL;
const originalWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
const fetchMock = vi.fn();

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`webhook-user${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedSubscription(userId: string, overrides: Record<string, unknown> = {}) {
  const status = overrides.status ?? "PENDING_PAYMENT";
  const asaasSubscriptionId = overrides.asaasSubscriptionId ?? "sub_000001";
  await db.sql`
    insert into automation_subscriptions (user_id, status, asaas_customer_id, asaas_subscription_id)
    values (${userId}, ${status}, 'cus_000001', ${asaasSubscriptionId})
  `;
  return asaasSubscriptionId as string;
}

beforeEach(async () => {
  db = await createTestDb();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  process.env.ASAAS_API_KEY = "sandbox-key-de-teste";
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
  process.env.ASAAS_WEBHOOK_TOKEN = "webhook-token-de-teste";
});

afterEach(async () => {
  await db.close();
  global.fetch = originalFetch;
  process.env.ASAAS_API_KEY = originalApiKey;
  process.env.ASAAS_BASE_URL = originalBaseUrl;
  process.env.ASAAS_WEBHOOK_TOKEN = originalWebhookToken;
  vi.restoreAllMocks();
});

describe("assertValidWebhookToken", () => {
  it("aceita o token correto e rejeita qualquer outro (ou ausente)", () => {
    expect(() => webhook.assertValidWebhookToken("webhook-token-de-teste")).not.toThrow();
    expect(() => webhook.assertValidWebhookToken("token-errado")).toThrow(webhook.AsaasWebhookAuthError);
    expect(() => webhook.assertValidWebhookToken(null)).toThrow(webhook.AsaasWebhookAuthError);
  });
});

describe("idempotência", () => {
  it("o mesmo event_id processado duas vezes só é aplicado uma vez", async () => {
    const userId = await seedUser();
    const subscriptionId = await seedSubscription(userId);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "pay_1", status: "RECEIVED", subscription: subscriptionId }))
      .mockResolvedValueOnce(jsonResponse(200, { id: subscriptionId, status: "ACTIVE", nextDueDate: "2026-10-15" }));

    const event = { id: "evt_dup_1", event: "PAYMENT_RECEIVED", dateCreated: "2026-09-15", payment: { object: "payment", id: "pay_1" } };

    const first = await webhook.processAsaasWebhookEvent(event, new Date("2026-09-15T12:00:00.000Z"));
    expect(first.status).toBe("processed");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = await webhook.processAsaasWebhookEvent(event, new Date("2026-09-15T12:05:00.000Z"));
    expect(second.status).toBe("duplicate");
    expect(fetchMock).toHaveBeenCalledTimes(2); // não fez nenhuma chamada nova ao Asaas

    const [row] = await db.sql`select status from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("ACTIVE");
  });
});

describe("PAYMENT_CONFIRMED / PAYMENT_RECEIVED", () => {
  it("libera o acesso (ACTIVE) e grava current_period_ends_at a partir do nextDueDate da assinatura", async () => {
    const userId = await seedUser();
    const subscriptionId = await seedSubscription(userId);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "pay_1", status: "CONFIRMED", subscription: subscriptionId }))
      .mockResolvedValueOnce(jsonResponse(200, { id: subscriptionId, status: "ACTIVE", nextDueDate: "2026-10-15" }));

    const result = await webhook.processAsaasWebhookEvent({
      id: "evt_1",
      event: "PAYMENT_CONFIRMED",
      dateCreated: "2026-09-15",
      payment: { object: "payment", id: "pay_1" },
    });

    expect(result.status).toBe("processed");
    const [row] = await db.sql`select status, started_at, current_period_ends_at from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("ACTIVE");
    expect(row.started_at).not.toBeNull();
    expect(new Date(row.current_period_ends_at as string).toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("ignora silenciosamente um pagamento que não pertence a nenhuma assinatura do Piloto", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "pay_avulso", status: "RECEIVED", subscription: null }));

    const result = await webhook.processAsaasWebhookEvent({
      id: "evt_2",
      event: "PAYMENT_RECEIVED",
      dateCreated: "2026-09-15",
      payment: { object: "payment", id: "pay_avulso" },
    });

    expect(result.status).toBe("processed"); // registrado, mas sem efeito local
    expect(fetchMock).toHaveBeenCalledTimes(1); // nunca chegou a consultar a assinatura
  });
});

describe("PAYMENT_OVERDUE", () => {
  it("bloqueia (PAST_DUE) sem apagar nada", async () => {
    const userId = await seedUser();
    const subscriptionId = await seedSubscription(userId, { status: "ACTIVE" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "pay_2", status: "OVERDUE", subscription: subscriptionId }));

    await webhook.processAsaasWebhookEvent({
      id: "evt_3",
      event: "PAYMENT_OVERDUE",
      dateCreated: "2026-09-15",
      payment: { object: "payment", id: "pay_2" },
    });

    const [row] = await db.sql`select status from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("PAST_DUE");
  });
});

describe("SUBSCRIPTION_DELETED / SUBSCRIPTION_INACTIVATED", () => {
  it("marca CANCELED sem tocar em current_period_ends_at", async () => {
    const userId = await seedUser();
    const subscriptionId = await seedSubscription(userId, { status: "ACTIVE" });
    const periodEnd = "2026-10-15T00:00:00.000Z";
    await db.sql`update automation_subscriptions set current_period_ends_at = ${periodEnd} where user_id = ${userId}`;

    const result = await webhook.processAsaasWebhookEvent({
      id: "evt_4",
      event: "SUBSCRIPTION_DELETED",
      dateCreated: "2026-09-20",
      subscription: { id: subscriptionId, status: "INACTIVE" },
    });

    expect(result.status).toBe("processed");
    expect(fetchMock).not.toHaveBeenCalled(); // não precisa de nenhuma consulta ao Asaas para esse tipo de evento
    const [row] = await db.sql`select status, current_period_ends_at from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("CANCELED");
    expect(new Date(row.current_period_ends_at as string).toISOString()).toBe(periodEnd);
  });
});

describe("evento fora do escopo do MVP", () => {
  it("fica registrado (idempotência funciona) mas não muda status nenhum", async () => {
    const userId = await seedUser();
    await seedSubscription(userId, { status: "PENDING_PAYMENT" });

    const result = await webhook.processAsaasWebhookEvent({
      id: "evt_5",
      event: "PAYMENT_CHECKOUT_VIEWED",
      dateCreated: "2026-09-15",
      payment: { object: "payment", id: "pay_x" },
    });

    expect(result.status).toBe("processed");
    expect(fetchMock).not.toHaveBeenCalled();
    const [row] = await db.sql`select status from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("PENDING_PAYMENT");

    const [eventRow] = await db.sql`select * from asaas_webhook_events where event_id = ${"evt_5"}`;
    expect(eventRow.processed_at).not.toBeNull();
  });
});
