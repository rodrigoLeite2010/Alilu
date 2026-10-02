// Compra de Créditos de IA via Asaas: checkout, crédito SÓ pelo Webhook
// confirmado (idempotente), estorno/chargeback e reembolso pedido pelo
// usuário. Postgres real em memória (PGlite); a API do Asaas é falsa
// (global.fetch roteado por método + caminho).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const purchases = await import("@/lib/ai-video/backend/credit-purchase-service");
const webhook = await import("@/lib/billing/backend/asaas-webhook-service");
const wallet = await import("@/lib/ai-video/backend/wallet-repository");

const T0 = new Date("2026-10-01T12:00:00.000Z");
const days = (n: number) => new Date(T0.getTime() + n * 24 * 3600_000);

const originalFetch = global.fetch;
const originalEnv = { key: process.env.ASAAS_API_KEY, base: process.env.ASAAS_BASE_URL, token: process.env.ASAAS_WEBHOOK_TOKEN };

type Handler = (body: Record<string, unknown> | null) => { status: number; body: unknown };
let routes: Record<string, Handler>;
const calls: string[] = [];
const paymentStatus: Record<string, string> = {};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
  const path = new URL(String(url)).pathname.replace(/^\/v3/, "");
  const key = `${init?.method ?? "GET"} ${path}`;
  calls.push(key);
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  const handler = routes[key] ?? (key.startsWith("GET /payments/") ? () => {
    const id = path.split("/")[2];
    return { status: 200, body: { id, status: paymentStatus[id] ?? "PENDING", value: 19.9 } };
  } : null);
  if (!handler) return json(404, { errors: [{ description: `rota falsa inexistente: ${key}` }] });
  const result = handler(body);
  return json(result.status, result.body);
});

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`compra${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function available(userId: string) {
  return (await wallet.getWallet(userId))?.available ?? 0;
}

let paymentCounter = 0;
async function checkout(userId: string, packageCode = "BASICO") {
  return purchases.startCreditCheckout(userId, { packageCode, name: "Maria Teste", cpfCnpj: "529.982.247-25", email: "m@example.com" }, T0);
}

async function deliver(eventId: string, eventType: string, paymentId: string, now = T0) {
  return webhook.processAsaasWebhookEvent({ id: eventId, event: eventType, payment: { object: "payment", id: paymentId } }, now);
}

beforeEach(async () => {
  db = await createTestDb();
  paymentCounter = 0;
  calls.length = 0;
  for (const key of Object.keys(paymentStatus)) delete paymentStatus[key];
  routes = {
    "POST /customers": () => ({ status: 200, body: { id: "cus_novo" } }),
    "POST /payments": (body) => {
      paymentCounter += 1;
      expect(body?.billingType).toBe("UNDEFINED");
      expect(typeof body?.externalReference).toBe("string");
      return { status: 200, body: { id: `pay_${paymentCounter}`, status: "PENDING", invoiceUrl: `https://sandbox.asaas.com/i/${paymentCounter}` } };
    },
  };
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.ASAAS_API_KEY = "sandbox-key-de-teste";
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
  process.env.ASAAS_WEBHOOK_TOKEN = "webhook-token-de-teste";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  global.fetch = originalFetch;
  process.env.ASAAS_API_KEY = originalEnv.key;
  process.env.ASAAS_BASE_URL = originalEnv.base;
  process.env.ASAAS_WEBHOOK_TOKEN = originalEnv.token;
  vi.restoreAllMocks();
  await db.close();
});

describe("checkout", () => {
  it("cria cliente + cobrança com o preço do BANCO e não credita nada antes do Webhook", async () => {
    const userId = await seedUser();
    const result = await checkout(userId);
    expect(result.checkoutUrl).toBe("https://sandbox.asaas.com/i/1");
    expect(calls).toEqual(["POST /customers", "POST /payments"]);
    const [purchase] = await db.sql`select status, price_cents, credits, asaas_payment_id from ai_credit_purchases`;
    expect(purchase).toEqual({ status: "PENDING", price_cents: 1990, credits: 500, asaas_payment_id: "pay_1" });
    expect(await available(userId)).toBe(0);
    expect(await purchases.hasBillingCustomer(userId)).toBe(true);
  });

  it("reaproveita a cobrança pendente e o cliente já criado", async () => {
    const userId = await seedUser();
    const first = await checkout(userId);
    const second = await checkout(userId);
    expect(second.purchaseId).toBe(first.purchaseId);
    await checkout(userId, "PRO");
    expect(calls.filter((c) => c === "POST /customers")).toHaveLength(1);
  });

  it("recusa pacote desconhecido e pacote abaixo da margem mínima", async () => {
    const userId = await seedUser();
    await expect(checkout(userId, "NAO_EXISTE")).rejects.toBeInstanceOf(purchases.CreditPurchaseError);
    await db.sql`update ai_credit_packages set price_cents = 9990 where code = 'PRO'`;
    const error = await checkout(userId, "PRO").catch((e) => e);
    expect(error.httpStatus).toBe(503);
    expect(calls).not.toContain("POST /payments");
  });
});

describe("carteira de geração recuperada", () => {
  it("consome do reservado ou, após reembolso local, debita do disponível sem duplicar", async () => {
    const userId = await seedUser("rec");
    await wallet.applyWalletMovement({
      userId,
      type: "ADMIN_ADJUSTMENT",
      availableDelta: 100,
      reservedDelta: 0,
      referenceType: "seed",
      referenceId: userId,
      description: "seed",
    });
    await wallet.applyWalletMovement({
      userId,
      type: "RESERVE",
      availableDelta: -65,
      reservedDelta: 65,
      referenceType: "ai_video_generation",
      referenceId: "gen-rec",
      description: "Reserva",
    });
    await wallet.applyWalletMovement({
      userId,
      type: "REFUND",
      availableDelta: 65,
      reservedDelta: -65,
      referenceType: "ai_video_generation",
      referenceId: "gen-rec",
      description: "Devolução",
    });

    const consumed = await wallet.consumeDeliveredGeneration({
      userId,
      credits: 65,
      referenceType: "ai_video_generation",
      referenceId: "gen-rec",
      description: "Vídeo recuperado",
    });
    const duplicate = await wallet.consumeDeliveredGeneration({
      userId,
      credits: 65,
      referenceType: "ai_video_generation",
      referenceId: "gen-rec",
      description: "Vídeo recuperado",
    });

    expect(consumed).toMatchObject({ status: "applied", unrecovered: 0 });
    expect(duplicate.status).toBe("duplicate");
    expect(await wallet.getWallet(userId)).toMatchObject({ available: 35, reserved: 0, unrecoveredCredits: 0 });
    const rows = await db.sql`select type, amount, reserved_delta from ai_credit_transactions where user_id = ${userId} order by created_at, id`;
    expect(rows.map((row) => row.type)).toEqual(["ADMIN_ADJUSTMENT", "RESERVE", "REFUND", "CONSUME"]);
    expect(rows.at(-1)).toMatchObject({ amount: -65, reserved_delta: 0 });
  });
});

describe("Webhook", () => {
  it("credita só com pagamento confirmado no Asaas, uma única vez (reentrega e RECEIVED depois de CONFIRMED)", async () => {
    const userId = await seedUser();
    await checkout(userId);

    // Evento dizendo "confirmado", mas o Asaas ainda diz PENDING → nada.
    await deliver("evt_0", "PAYMENT_CONFIRMED", "pay_1");
    expect(await available(userId)).toBe(0);

    paymentStatus.pay_1 = "CONFIRMED";
    await deliver("evt_1", "PAYMENT_CONFIRMED", "pay_1");
    expect((await deliver("evt_1", "PAYMENT_CONFIRMED", "pay_1")).status).toBe("duplicate");
    paymentStatus.pay_1 = "RECEIVED";
    await deliver("evt_2", "PAYMENT_RECEIVED", "pay_1");
    expect(await available(userId)).toBe(500);
    const rows = await db.sql`select type from ai_credit_transactions where user_id = ${userId}`;
    expect(rows.map((r) => r.type)).toEqual(["PURCHASE"]);
    const [purchase] = await db.sql`select status from ai_credit_purchases`;
    expect(purchase.status).toBe("PAID");
  });

  it("cobrança avulsa que não é compra de créditos é ignorada sem erro", async () => {
    await seedUser();
    paymentStatus.pay_estranho = "RECEIVED";
    expect((await deliver("evt_x", "PAYMENT_RECEIVED", "pay_estranho")).status).toBe("processed");
    expect(await db.sql`select id from ai_credit_transactions`).toHaveLength(0);
  });

  it("estorno pelo Asaas retira os créditos; os já usados ficam como não recuperados", async () => {
    const userId = await seedUser();
    await checkout(userId);
    paymentStatus.pay_1 = "RECEIVED";
    await deliver("evt_1", "PAYMENT_RECEIVED", "pay_1");
    // usa 300 dos 500
    await wallet.applyWalletMovement({ userId, type: "CONSUME", availableDelta: -300, reservedDelta: 0, referenceType: "teste", referenceId: "uso", description: "uso" });

    await deliver("evt_2", "PAYMENT_CHARGEBACK_REQUESTED", "pay_1");
    await deliver("evt_3", "PAYMENT_CHARGEBACK_REQUESTED", "pay_1");
    const w = await wallet.getWallet(userId);
    expect(w?.available).toBe(0);
    expect(w?.unrecoveredCredits).toBe(300);
    const [purchase] = await db.sql`select status from ai_credit_purchases`;
    expect(purchase.status).toBe("CHARGEBACK");
    const rows = await db.sql`select type, amount from ai_credit_transactions where type = 'CHARGEBACK'`;
    expect(rows).toEqual([{ type: "CHARGEBACK", amount: -200 }]);
  });

  it("cobrança excluída cancela a compra pendente", async () => {
    const userId = await seedUser();
    await checkout(userId);
    paymentStatus.pay_1 = "DELETED";
    await deliver("evt_1", "PAYMENT_DELETED", "pay_1");
    const [purchase] = await db.sql`select status from ai_credit_purchases`;
    expect(purchase.status).toBe("CANCELED");
    expect(await available(userId)).toBe(0);
  });
});

describe("reembolso pedido pelo usuário", () => {
  async function paidPurchase(userId: string) {
    const { purchaseId } = await checkout(userId);
    paymentStatus.pay_1 = "RECEIVED";
    await deliver("evt_1", "PAYMENT_RECEIVED", "pay_1");
    return purchaseId;
  }

  it("dentro do prazo e sem uso: estorna no Asaas e retira os créditos; o Webhook do estorno não retira de novo", async () => {
    const userId = await seedUser();
    const purchaseId = await paidPurchase(userId);
    routes["POST /payments/pay_1/refund"] = () => ({ status: 200, body: { id: "pay_1", status: "REFUNDED" } });

    const refunded = await purchases.requestPurchaseRefund(userId, purchaseId, days(3));
    expect(refunded.status).toBe("REFUNDED");
    expect(await available(userId)).toBe(0);

    await deliver("evt_2", "PAYMENT_REFUNDED", "pay_1", days(3));
    expect(await available(userId)).toBe(0);
    const rows = await db.sql`select type from ai_credit_transactions where type = 'PURCHASE_REFUND'`;
    expect(rows).toHaveLength(1);
    expect((await wallet.getWallet(userId))?.unrecoveredCredits).toBe(0);
  });

  it("fora do prazo ou com créditos já usados: recusa sem chamar o Asaas", async () => {
    const userId = await seedUser();
    const purchaseId = await paidPurchase(userId);
    await expect(purchases.requestPurchaseRefund(userId, purchaseId, days(8))).rejects.toThrow(/prazo/);
    await wallet.applyWalletMovement({ userId, type: "CONSUME", availableDelta: -1, reservedDelta: 0, referenceType: "teste", referenceId: "uso", description: "uso" });
    await expect(purchases.requestPurchaseRefund(userId, purchaseId, days(1))).rejects.toThrow(/não foram usados/);
    expect(calls.some((c) => c.endsWith("/refund"))).toBe(false);
    expect(await available(userId)).toBe(499);
  });

  it("se o Asaas recusar o estorno, os créditos voltam e um novo pedido não estorna de novo", async () => {
    const userId = await seedUser();
    const purchaseId = await paidPurchase(userId);
    routes["POST /payments/pay_1/refund"] = () => ({ status: 400, body: { errors: [{ description: "não permitido" }] } });

    await expect(purchases.requestPurchaseRefund(userId, purchaseId, days(1))).rejects.toBeInstanceOf(purchases.CreditPurchaseError);
    expect(await available(userId)).toBe(500);
    const again = await purchases.requestPurchaseRefund(userId, purchaseId, days(1)).catch((e) => e);
    expect(again.httpStatus).toBe(409);
    expect(calls.filter((c) => c.endsWith("/refund"))).toHaveLength(1);
    expect(await available(userId)).toBe(500);
  });

  it("não reembolsa compra de outro usuário", async () => {
    const owner = await seedUser("1");
    const other = await seedUser("2");
    const purchaseId = await paidPurchase(owner);
    await expect(purchases.requestPurchaseRefund(other, purchaseId, days(1))).rejects.toBeInstanceOf(purchases.CreditPurchaseError);
  });
});
