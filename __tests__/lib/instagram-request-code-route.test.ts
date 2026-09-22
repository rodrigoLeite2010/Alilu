// @vitest-environment node
//
// Testa a rota POST /api/instagram/auth/request-code mockando o
// serviço de OTP e o envio de e-mail (Resend) — sem gerar código de
// verdade nem enviar e-mail nenhum. Confirma também que o código OTP
// nunca aparece em nenhuma chamada de log.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestOtpMock = vi.fn();
const sendOtpEmailMock = vi.fn();

vi.mock("@/lib/instagram/backend/otp-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/backend/otp-service")>(
    "@/lib/instagram/backend/otp-service",
  );
  return {
    ...actual,
    requestOtp: (...args: unknown[]) => requestOtpMock(...args),
  };
});

vi.mock("@/lib/email/resend", () => ({
  sendOtpEmail: (...args: unknown[]) => sendOtpEmailMock(...args),
}));

const { OtpRateLimitError } = await import("@/lib/instagram/backend/otp-service");
const { POST } = await import("@/app/api/instagram/auth/request-code/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/instagram/auth/request-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/instagram/auth/request-code", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestOtpMock.mockReset();
    sendOtpEmailMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("responde 400 quando o corpo não é um JSON válido", async () => {
    const request = new Request("http://localhost/api/instagram/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "não é json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando o e-mail é inválido", async () => {
    const response = await POST(jsonRequest({ email: "nao-e-email" }));
    expect(response.status).toBe(400);
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("responde 429 com a mensagem do erro quando o rate limit é atingido", async () => {
    requestOtpMock.mockRejectedValue(new OtpRateLimitError("Muitos pedidos."));

    const response = await POST(jsonRequest({ email: "usuario@exemplo.com" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(429);
    expect(data.error).toBe("Muitos pedidos.");
    expect(sendOtpEmailMock).not.toHaveBeenCalled();
  });

  it("responde 500 genérico (sem detalhes internos) quando o envio de e-mail falha", async () => {
    requestOtpMock.mockResolvedValue({ code: "123456" });
    sendOtpEmailMock.mockRejectedValue(new Error("falha interna do provedor de e-mail"));

    const response = await POST(jsonRequest({ email: "usuario@exemplo.com" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data.error).not.toContain("falha interna do provedor de e-mail");
  });

  it("responde { ok: true } e envia o e-mail quando tudo funciona", async () => {
    requestOtpMock.mockResolvedValue({ code: "123456" });
    sendOtpEmailMock.mockResolvedValue(undefined);

    // isValidEmail roda sobre o valor bruto recebido (sem normalizar antes),
    // então o e-mail de teste aqui não pode ter espaços nas pontas — só a
    // normalização de maiúsculas/minúsculas é testada, via sendOtpEmail.
    const response = await POST(jsonRequest({ email: "Usuario@Exemplo.com" }));
    const data = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendOtpEmailMock).toHaveBeenCalledWith("usuario@exemplo.com", "123456");
  });

  it("nunca loga o código OTP, mesmo quando o envio de e-mail falha", async () => {
    requestOtpMock.mockResolvedValue({ code: "999999" });
    sendOtpEmailMock.mockRejectedValue(new Error("erro do provedor"));

    await POST(jsonRequest({ email: "usuario@exemplo.com" }));

    for (const call of consoleErrorSpy.mock.calls) {
      const serialized = call
        .map((arg: unknown) => (arg instanceof Error ? arg.message : JSON.stringify(arg)))
        .join(" ");
      expect(serialized).not.toContain("999999");
    }
  });
});
