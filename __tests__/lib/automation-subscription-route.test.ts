// @vitest-environment node
//
// Testa a rota POST /api/billing/automation-subscription mockando
// auth() e subscription-service — confere autenticação, validação do
// corpo, o discriminador `action` e o mapeamento de erros para status
// HTTP (nunca fala com o Asaas de verdade aqui).
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const startAutomationCheckoutMock = vi.fn();
const cancelAutomationSubscriptionMock = vi.fn();
vi.mock("@/lib/billing/backend/subscription-service", () => ({
  startAutomationCheckout: (...args: unknown[]) => startAutomationCheckoutMock(...args),
  cancelAutomationSubscription: (...args: unknown[]) => cancelAutomationSubscriptionMock(...args),
}));

const { SubscriptionBusinessError } = await import("@/lib/billing/backend/billing-types");
const { AsaasApiError, AsaasConfigError } = await import("@/lib/billing/backend/asaas-client");
const { POST } = await import("@/app/api/billing/automation-subscription/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/billing/automation-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fakeSubscription = {
  status: "PENDING_PAYMENT",
  trialEndsAt: null,
  monthlyPriceCents: 1900,
  startedAt: null,
  currentPeriodEndsAt: null,
  canceledAt: null,
};

beforeEach(() => {
  authMock.mockReset();
  startAutomationCheckoutMock.mockReset();
  cancelAutomationSubscriptionMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/billing/automation-subscription", () => {
  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(jsonRequest({ action: "cancel" }));
    expect(response.status).toBe(401);
  });

  it("responde 400 para action desconhecida", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await POST(jsonRequest({ action: "algo-invalido" }));
    expect(response.status).toBe(400);
  });

  describe("action: checkout", () => {
    beforeEach(() => authMock.mockResolvedValue({ user: { id: "user-1" } }));

    it("responde 400 quando falta nome ou CPF/CNPJ, sem chamar o serviço", async () => {
      const response = await POST(jsonRequest({ action: "checkout", name: "", cpfCnpj: "" }));
      expect(response.status).toBe(400);
      expect(startAutomationCheckoutMock).not.toHaveBeenCalled();
    });

    it("devolve o checkoutUrl e a assinatura serializada em caso de sucesso", async () => {
      startAutomationCheckoutMock.mockResolvedValue({
        checkoutUrl: "https://www.asaas.com/i/pay_1",
        subscription: fakeSubscription,
      });

      const response = await POST(
        jsonRequest({ action: "checkout", name: "Fulano da Silva", cpfCnpj: "123.456.789-00", email: "f@example.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(startAutomationCheckoutMock).toHaveBeenCalledWith("user-1", {
        name: "Fulano da Silva",
        cpfCnpj: "123.456.789-00",
        email: "f@example.com",
      });
      expect(body.checkoutUrl).toBe("https://www.asaas.com/i/pay_1");
      expect(body.subscription.status).toBe("PENDING_PAYMENT");
    });

    it("mapeia SubscriptionBusinessError para 400 com a mensagem original", async () => {
      startAutomationCheckoutMock.mockRejectedValue(new SubscriptionBusinessError("CPF ou CNPJ inválido."));
      const response = await POST(jsonRequest({ action: "checkout", name: "Fulano", cpfCnpj: "123" }));
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe("CPF ou CNPJ inválido.");
    });

    it("mapeia AsaasConfigError para 503 sem vazar detalhes internos", async () => {
      startAutomationCheckoutMock.mockRejectedValue(new AsaasConfigError("ASAAS_API_KEY não configurada."));
      const response = await POST(jsonRequest({ action: "checkout", name: "Fulano", cpfCnpj: "12345678900" }));
      expect(response.status).toBe(503);
    });

    it("mapeia um erro inesperado para 500", async () => {
      startAutomationCheckoutMock.mockRejectedValue(new Error("Banco fora do ar"));
      const response = await POST(jsonRequest({ action: "checkout", name: "Fulano", cpfCnpj: "12345678900" }));
      expect(response.status).toBe(500);
    });
  });

  describe("action: cancel", () => {
    beforeEach(() => authMock.mockResolvedValue({ user: { id: "user-1" } }));

    it("devolve a assinatura cancelada serializada", async () => {
      cancelAutomationSubscriptionMock.mockResolvedValue({ ...fakeSubscription, status: "CANCELED" });
      const response = await POST(jsonRequest({ action: "cancel" }));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(cancelAutomationSubscriptionMock).toHaveBeenCalledWith("user-1");
      expect(body.subscription.status).toBe("CANCELED");
    });

    it("mapeia AsaasApiError (falha do Asaas ao cancelar) para 400", async () => {
      cancelAutomationSubscriptionMock.mockRejectedValue(new AsaasApiError("Assinatura não encontrada.", 404));
      const response = await POST(jsonRequest({ action: "cancel" }));
      expect(response.status).toBe(400);
    });
  });
});
