// @vitest-environment node
//
// Testa a rota POST /api/billing/asaas-webhook mockando o serviço de
// processamento — confere só a parte da rota: header de autenticação,
// parsing do corpo e mapeamento de status HTTP.
import { beforeEach, describe, expect, it, vi } from "vitest";

const assertValidWebhookTokenMock = vi.fn();
const processAsaasWebhookEventMock = vi.fn();

vi.mock("@/lib/billing/backend/asaas-webhook-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/backend/asaas-webhook-service")>(
    "@/lib/billing/backend/asaas-webhook-service",
  );
  return {
    ...actual,
    assertValidWebhookToken: (...args: unknown[]) => assertValidWebhookTokenMock(...args),
    processAsaasWebhookEvent: (...args: unknown[]) => processAsaasWebhookEventMock(...args),
  };
});

const { AsaasWebhookAuthError, AsaasWebhookPayloadError } = await import(
  "@/lib/billing/backend/asaas-webhook-service"
);
const { POST } = await import("@/app/api/billing/asaas-webhook/route");

function webhookRequest(body: unknown, token: string | null = "token-valido"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["asaas-access-token"] = token;
  return new Request("http://localhost/api/billing/asaas-webhook", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  assertValidWebhookTokenMock.mockReset();
  processAsaasWebhookEventMock.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/billing/asaas-webhook", () => {
  it("responde 401 e nunca chega a processar quando o token é inválido", async () => {
    assertValidWebhookTokenMock.mockImplementation(() => {
      throw new AsaasWebhookAuthError("Token inválido.");
    });

    const response = await POST(webhookRequest({ id: "evt_1", event: "PAYMENT_RECEIVED" }, "token-errado"));

    expect(response.status).toBe(401);
    expect(processAsaasWebhookEventMock).not.toHaveBeenCalled();
  });

  it("responde 400 para corpo que não é JSON válido", async () => {
    assertValidWebhookTokenMock.mockImplementation(() => undefined);
    const response = await POST(webhookRequest("não é json"));
    expect(response.status).toBe(400);
    expect(processAsaasWebhookEventMock).not.toHaveBeenCalled();
  });

  it("responde 200 com o status devolvido pelo serviço em caso de sucesso", async () => {
    assertValidWebhookTokenMock.mockImplementation(() => undefined);
    processAsaasWebhookEventMock.mockResolvedValue({ status: "processed", eventType: "PAYMENT_RECEIVED" });

    const response = await POST(webhookRequest({ id: "evt_1", event: "PAYMENT_RECEIVED" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, status: "processed" });
  });

  it("responde 400 quando o serviço rejeita o formato do payload", async () => {
    assertValidWebhookTokenMock.mockImplementation(() => undefined);
    processAsaasWebhookEventMock.mockRejectedValue(new AsaasWebhookPayloadError("Formato inesperado."));

    const response = await POST(webhookRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
  });

  it("responde 500 (para o Asaas reentregar) em qualquer outra falha do processamento", async () => {
    assertValidWebhookTokenMock.mockImplementation(() => undefined);
    processAsaasWebhookEventMock.mockRejectedValue(new Error("Banco fora do ar"));

    const response = await POST(webhookRequest({ id: "evt_1", event: "PAYMENT_RECEIVED" }));
    expect(response.status).toBe(500);
  });
});
