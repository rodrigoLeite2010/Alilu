// @vitest-environment node
//
// Mocka global.fetch para testar o cliente cru do Asaas sem nenhuma
// chamada de rede real (e sem precisar de uma chave de Sandbox de
// verdade) — mesma técnica de instagram-meta-graph-client.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AsaasApiError,
  AsaasConfigError,
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasSubscription,
  getAsaasSubscription,
} from "@/lib/billing/backend/asaas-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const originalFetch = global.fetch;
const originalApiKey = process.env.ASAAS_API_KEY;
const originalBaseUrl = process.env.ASAAS_BASE_URL;
const fetchMock = vi.fn();

beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  process.env.ASAAS_API_KEY = "sandbox-key-de-teste";
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.ASAAS_API_KEY = originalApiKey;
  process.env.ASAAS_BASE_URL = originalBaseUrl;
});

describe("configuração ausente", () => {
  it("lança AsaasConfigError sem ASAAS_API_KEY", async () => {
    delete process.env.ASAAS_API_KEY;
    await expect(createAsaasCustomer({ name: "Fulano", cpfCnpj: "12345678900" })).rejects.toBeInstanceOf(
      AsaasConfigError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lança AsaasConfigError sem ASAAS_BASE_URL", async () => {
    delete process.env.ASAAS_BASE_URL;
    await expect(createAsaasCustomer({ name: "Fulano", cpfCnpj: "12345678900" })).rejects.toBeInstanceOf(
      AsaasConfigError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createAsaasCustomer", () => {
  it("envia POST /customers com access_token no header e nunca em Authorization", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "cus_000001" }));

    const result = await createAsaasCustomer({ name: "Fulano da Silva", cpfCnpj: "12345678900", email: "fulano@example.com" });

    expect(result).toEqual({ id: "cus_000001" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/customers");
    expect(init.method).toBe("POST");
    expect(init.headers.access_token).toBe("sandbox-key-de-teste");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      name: "Fulano da Silva",
      cpfCnpj: "12345678900",
      email: "fulano@example.com",
    });
  });

  it("propaga a mensagem de erro do Asaas em AsaasApiError, sem vazar a chave", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { errors: [{ code: "invalid_cpfCnpj", description: "CPF/CNPJ inválido" }] }));

    await expect(createAsaasCustomer({ name: "Fulano", cpfCnpj: "000" })).rejects.toMatchObject({
      message: "CPF/CNPJ inválido",
      status: 400,
    });
  });
});

describe("createAsaasSubscription", () => {
  it("cria assinatura recorrente MONTHLY com billingType UNDEFINED (checkout hospedado do Asaas)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "sub_000001", status: "PENDING" }));

    const result = await createAsaasSubscription({
      customerId: "cus_000001",
      value: 19,
      nextDueDate: "2026-10-01",
      description: "Alilu - Postagens Automáticas com IA",
      externalReference: "automation-subscription-abc",
    });

    expect(result).toEqual({ id: "sub_000001", status: "PENDING", nextDueDate: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    const body = JSON.parse(init.body);
    expect(body.billingType).toBe("UNDEFINED");
    expect(body.cycle).toBe("MONTHLY");
    expect(body.value).toBe(19);
    expect(body.customer).toBe("cus_000001");
    expect(body.externalReference).toBe("automation-subscription-abc");
  });
});

describe("getAsaasSubscription / cancelAsaasSubscription", () => {
  it("GET consulta o status direto no Asaas (consulta servidor-servidor)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "sub_000001", status: "ACTIVE", nextDueDate: "2026-10-01" }));
    const result = await getAsaasSubscription("sub_000001");
    expect(result.status).toBe("ACTIVE");
    expect(result.nextDueDate).toBe("2026-10-01");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("DELETE cancela a assinatura no Asaas", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await cancelAsaasSubscription("sub_000001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions/sub_000001");
    expect(init.method).toBe("DELETE");
  });

  it("erro HTTP sem corpo de erro reconhecível ainda vira AsaasApiError legível", async () => {
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));
    await expect(getAsaasSubscription("sub_x")).rejects.toBeInstanceOf(AsaasApiError);
  });
});
