// Checkout e cancelamento da assinatura do Piloto Automático contra um
// Postgres REAL em memória (PGlite) — só a chamada de rede ao Asaas é
// mockada (global.fetch), o SQL de leitura/escrita é de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const service = await import("@/lib/billing/backend/subscription-service");
const { SubscriptionBusinessError } = await import("@/lib/billing/backend/billing-types");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const originalFetch = global.fetch;
const originalApiKey = process.env.ASAAS_API_KEY;
const originalBaseUrl = process.env.ASAAS_BASE_URL;
const fetchMock = vi.fn();

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`sub-user${suffix}@example.com`}) returning id`;
  return user.id as string;
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
  process.env.ASAAS_API_KEY = originalApiKey;
  process.env.ASAAS_BASE_URL = originalBaseUrl;
  vi.restoreAllMocks();
});

describe("startAutomationCheckout", () => {
  it("cria cliente + assinatura no Asaas e devolve o link de pagamento, gravando PENDING_PAYMENT", async () => {
    const userId = await seedUser();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "cus_000001" })) // POST /customers
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_000001", status: "PENDING" })) // POST /subscriptions
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "pay_1", status: "PENDING", invoiceUrl: "https://www.asaas.com/i/pay_1", value: 19, dueDate: "2026-09-01" }] })); // GET /subscriptions/:id/payments

    const result = await service.startAutomationCheckout(
      userId,
      { name: "Fulano da Silva", cpfCnpj: "123.456.789-00", email: "fulano@example.com" },
      new Date("2026-09-01T12:00:00.000Z"),
    );

    expect(result.checkoutUrl).toBe("https://www.asaas.com/i/pay_1");
    expect(result.subscription.status).toBe("PENDING_PAYMENT");
    expect(result.subscription.cpfCnpj).toBe("12345678900");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [row] = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("PENDING_PAYMENT");
    expect(row.asaas_customer_id).toBe("cus_000001");
    expect(row.asaas_subscription_id).toBe("sub_000001");
    expect(row.cpf_cnpj).toBe("12345678900");
  });

  it("rejeita CPF/CNPJ com tamanho inválido sem chamar o Asaas", async () => {
    const userId = await seedUser();
    await expect(
      service.startAutomationCheckout(userId, { name: "Fulano", cpfCnpj: "123" }),
    ).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nunca duplica o cliente Asaas: reaproveita asaas_customer_id de uma assinatura anterior (ex.: CANCELED)", async () => {
    const userId = await seedUser();
    await db.sql`
      insert into automation_subscriptions (user_id, status, asaas_customer_id, asaas_subscription_id, canceled_at)
      values (${userId}, 'CANCELED', 'cus_existente', 'sub_antiga', now())
    `;

    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "sub_nova", status: "PENDING" })) // POST /subscriptions (sem POST /customers!)
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "pay_2", invoiceUrl: "https://www.asaas.com/i/pay_2" }] }));

    const result = await service.startAutomationCheckout(userId, { name: "Fulano", cpfCnpj: "12345678900" });

    expect(fetchMock).toHaveBeenCalledTimes(2); // nunca chamou POST /customers de novo
    expect(result.subscription.asaasCustomerId).toBe("cus_existente");
    expect(result.subscription.asaasSubscriptionId).toBe("sub_nova");
  });

  it("reaproveita a mesma assinatura do Asaas se já está PENDING_PAYMENT (clique duplicado)", async () => {
    const userId = await seedUser();
    await db.sql`
      insert into automation_subscriptions (user_id, status, asaas_customer_id, asaas_subscription_id)
      values (${userId}, 'PENDING_PAYMENT', 'cus_existente', 'sub_pendente')
    `;

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: [{ id: "pay_3", invoiceUrl: "https://www.asaas.com/i/pay_3" }] }),
    );

    const result = await service.startAutomationCheckout(userId, { name: "Fulano", cpfCnpj: "12345678900" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // só a consulta de payments — nem customer nem subscription novos
    expect(result.subscription.asaasSubscriptionId).toBe("sub_pendente");
  });

  it("recusa novo checkout quando já existe assinatura ACTIVE", async () => {
    const userId = await seedUser();
    await db.sql`insert into automation_subscriptions (user_id, status) values (${userId}, 'ACTIVE')`;

    await expect(
      service.startAutomationCheckout(userId, { name: "Fulano", cpfCnpj: "12345678900" }),
    ).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cancelAutomationSubscription", () => {
  it("cancela no Asaas e só depois marca CANCELED localmente, sem apagar current_period_ends_at", async () => {
    const userId = await seedUser();
    const periodEnd = new Date("2026-10-15T00:00:00.000Z");
    await db.sql`
      insert into automation_subscriptions (user_id, status, asaas_subscription_id, current_period_ends_at)
      values (${userId}, 'ACTIVE', 'sub_ativa', ${periodEnd.toISOString()})
    `;
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const result = await service.cancelAutomationSubscription(userId, new Date("2026-09-20T00:00:00.000Z"));

    expect(result.status).toBe("CANCELED");
    expect(result.currentPeriodEndsAt?.toISOString()).toBe(periodEnd.toISOString());
    const [call] = fetchMock.mock.calls;
    expect(call[0]).toBe("https://api-sandbox.asaas.com/v3/subscriptions/sub_ativa");
    expect(call[1].method).toBe("DELETE");
  });

  it("não marca CANCELED localmente se a chamada ao Asaas falhar", async () => {
    const userId = await seedUser();
    await db.sql`insert into automation_subscriptions (user_id, status, asaas_subscription_id) values (${userId}, 'ACTIVE', 'sub_ativa')`;
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { errors: [{ description: "Falha temporária" }] }));

    await expect(service.cancelAutomationSubscription(userId)).rejects.toThrow("Falha temporária");

    const [row] = await db.sql`select status from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("ACTIVE");
  });

  it("recusa cancelar quando não há assinatura paga (TRIAL/novo usuário)", async () => {
    const userId = await seedUser();
    await expect(service.cancelAutomationSubscription(userId)).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reactivateAutomationSubscription", () => {
  async function seedCanceled(userId: string, periodEndsAt: string) {
    await db.sql`
      insert into automation_subscriptions (user_id, status, cpf_cnpj, asaas_customer_id, asaas_subscription_id, started_at, current_period_ends_at, canceled_at)
      values (${userId}, 'CANCELED', '12345678900', 'cus_000001', 'sub_antiga', '2026-09-01T12:00:00.000Z', ${periodEndsAt}, '2026-09-10T12:00:00.000Z')
    `;
  }

  it("cria assinatura nova com a 1ª cobrança no fim do período pago e volta para ACTIVE sem cobrar agora", async () => {
    const userId = await seedUser();
    await seedCanceled(userId, "2026-10-01T00:00:00.000Z");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "sub_nova", status: "ACTIVE", nextDueDate: "2026-10-01" }));

    const result = await service.reactivateAutomationSubscription(userId, new Date("2026-09-15T12:00:00.000Z"));

    expect(result.status).toBe("ACTIVE");
    expect(result.asaasSubscriptionId).toBe("sub_nova");
    expect(result.canceledAt).toBeNull();
    expect(result.currentPeriodEndsAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1); // só POST /subscriptions — nunca cria cliente novo

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    const body = JSON.parse(init.body as string);
    expect(body.customer).toBe("cus_000001");
    expect(body.nextDueDate).toBe("2026-10-01");
    expect(body.value).toBe(19);
    expect(body.cycle).toBe("MONTHLY");
  });

  it("recusa quando o período pago já acabou (deve usar o checkout normal), sem chamar o Asaas", async () => {
    const userId = await seedUser();
    await seedCanceled(userId, "2026-09-01T00:00:00.000Z");
    await expect(
      service.reactivateAutomationSubscription(userId, new Date("2026-09-15T12:00:00.000Z")),
    ).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa quando não há assinatura cancelada (ex.: ACTIVE ou trial)", async () => {
    const userId = await seedUser();
    await db.sql`insert into automation_subscriptions (user_id, status, asaas_customer_id, asaas_subscription_id) values (${userId}, 'ACTIVE', 'cus_1', 'sub_1')`;
    await expect(service.reactivateAutomationSubscription(userId)).rejects.toBeInstanceOf(SubscriptionBusinessError);

    const otherUser = await seedUser("2");
    await expect(service.reactivateAutomationSubscription(otherUser)).rejects.toBeInstanceOf(SubscriptionBusinessError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("não muda nada localmente se o Asaas recusar a criação da assinatura", async () => {
    const userId = await seedUser();
    await seedCanceled(userId, "2026-10-01T00:00:00.000Z");
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { errors: [{ description: "Cliente inválido." }] }));

    await expect(
      service.reactivateAutomationSubscription(userId, new Date("2026-09-15T12:00:00.000Z")),
    ).rejects.toThrow("Cliente inválido.");

    const [row] = await db.sql`select status, asaas_subscription_id from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("CANCELED");
    expect(row.asaas_subscription_id).toBe("sub_antiga");
  });
});
