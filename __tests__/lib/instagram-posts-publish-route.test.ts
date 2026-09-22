// @vitest-environment node
//
// Testa a rota de publicação mockando `auth` e o serviço de publicação —
// sem nenhuma chamada real de rede ou de banco, e portanto sem nenhuma
// publicação real na Meta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPublishError extends Error {}
const publishImagePostMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-publish-service", () => ({
  InstagramPublishError: FakeInstagramPublishError,
  publishImagePost: (...args: unknown[]) => publishImagePostMock(...args),
}));

const { POST } = await import("@/app/api/instagram/posts/[id]/publish/route");

function request(): Request {
  return new Request("https://alilu.com.br/api/instagram/posts/post-1/publish", { method: "POST" });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/instagram/posts/[id]/publish", () => {
  beforeEach(() => {
    authMock.mockReset();
    publishImagePostMock.mockReset();
  });

  it("responde 401 sem sessão, sem chamar o serviço de publicação", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request(), routeParams("post-1"));

    expect(response.status).toBe(401);
    expect(publishImagePostMock).not.toHaveBeenCalled();
  });

  it("publica e responde com o status retornado (PUBLISHED)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishImagePostMock.mockResolvedValue("PUBLISHED");

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PUBLISHED");
    expect(publishImagePostMock).toHaveBeenCalledWith("post-1", "user-1");
  });

  it("responde com o status PROCESSING sem tratar como erro", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishImagePostMock.mockResolvedValue("PROCESSING");

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PROCESSING");
  });

  it("responde 400 com a mensagem do erro de publicação quando o serviço lança", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishImagePostMock.mockRejectedValue(new FakeInstagramPublishError("Post não encontrado."));

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Post não encontrado.");
  });

  it("responde 400 com mensagem genérica para erros inesperados (nunca vaza detalhes internos)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishImagePostMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível publicar no Instagram.");
  });
});
