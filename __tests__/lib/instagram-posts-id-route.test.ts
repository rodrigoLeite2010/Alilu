// @vitest-environment node
//
// Testa a rota de ações do post (cancelar/reagendar) mockando `auth` e o
// serviço — sem nenhuma chamada real de rede ou de banco.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPostValidationError extends Error {}
const cancelPostMock = vi.fn();
const reschedulePostMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  InstagramPostValidationError: FakeInstagramPostValidationError,
  cancelPost: (...args: unknown[]) => cancelPostMock(...args),
  reschedulePost: (...args: unknown[]) => reschedulePostMock(...args),
}));

const { PATCH } = await import("@/app/api/instagram/posts/[id]/route");

function request(body: unknown): Request {
  return new Request("https://alilu.com.br/api/instagram/posts/post-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/instagram/posts/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    cancelPostMock.mockReset();
    reschedulePostMock.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(request({ action: "cancel" }), routeParams("post-1"));

    expect(response.status).toBe(401);
    expect(cancelPostMock).not.toHaveBeenCalled();
  });

  it("responde 400 para uma action desconhecida", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(request({ action: "apagar" }), routeParams("post-1"));

    expect(response.status).toBe(400);
    expect(cancelPostMock).not.toHaveBeenCalled();
    expect(reschedulePostMock).not.toHaveBeenCalled();
  });

  it("cancela o post e responde com o status CANCELLED", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    cancelPostMock.mockResolvedValue(undefined);

    const response = await PATCH(request({ action: "cancel" }), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("CANCELLED");
    expect(cancelPostMock).toHaveBeenCalledWith("post-1", "user-1");
  });

  it("responde 400 com a mensagem do erro de validação quando o cancelamento é rejeitado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    cancelPostMock.mockRejectedValue(new FakeInstagramPostValidationError("Não foi possível cancelar."));

    const response = await PATCH(request({ action: "cancel" }), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível cancelar.");
  });

  it("responde 400 quando reschedule vem sem scheduledAt em texto nem nulo", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(request({ action: "reschedule", scheduledAt: 123 }), routeParams("post-1"));

    expect(response.status).toBe(400);
    expect(reschedulePostMock).not.toHaveBeenCalled();
  });

  it("reagenda o post e responde com o status SCHEDULED", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    reschedulePostMock.mockResolvedValue(undefined);

    const response = await PATCH(
      request({ action: "reschedule", scheduledAt: "2026-12-01T10:00:00.000Z" }),
      routeParams("post-1"),
    );
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("SCHEDULED");
    expect(reschedulePostMock).toHaveBeenCalledWith("post-1", "user-1", "2026-12-01T10:00:00.000Z", null);
  });

  it("remove o agendamento (scheduledAt nulo) e responde com o status DRAFT", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    reschedulePostMock.mockResolvedValue(undefined);

    const response = await PATCH(request({ action: "reschedule", scheduledAt: null }), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("DRAFT");
    expect(reschedulePostMock).toHaveBeenCalledWith("post-1", "user-1", null, null);
  });

  it("responde 400 com mensagem genérica para erros inesperados (nunca vaza detalhes internos)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    cancelPostMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await PATCH(request({ action: "cancel" }), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível atualizar o post.");
  });
});
