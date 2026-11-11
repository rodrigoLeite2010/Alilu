// @vitest-environment node
//
// Testa a rota de publicação mockando `auth` e `publishPost` (o despachante
// por tipo de post — imagem única ou carrossel — de instagram-publish-
// service.ts) — sem nenhuma chamada real de rede ou de banco, e portanto
// sem nenhuma publicação real na Meta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPublishError extends Error {}
const publishPostMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-publish-service", () => ({
  InstagramPublishError: FakeInstagramPublishError,
  publishPost: (...args: unknown[]) => publishPostMock(...args),
}));

// Destinos (migração 0053): por padrão a publicação é "só Instagram", sem
// Páginas do Facebook — exatamente o comportamento histórico desta rota.
const detailsMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => ({
  getPostDetailsForUser: (...args: unknown[]) => detailsMock(...args),
}));
const facebookMock = vi.fn();
vi.mock("@/lib/facebook/backend/facebook-publish-service", () => ({
  publishFacebookDestinationsForPost: (...args: unknown[]) => facebookMock(...args),
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
    publishPostMock.mockReset();
    detailsMock.mockReset();
    detailsMock.mockResolvedValue({ id: "post-1", publishToInstagram: true, items: [] });
    facebookMock.mockReset();
    facebookMock.mockResolvedValue([]);
  });

  it("responde 401 sem sessão, sem chamar o serviço de publicação", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request(), routeParams("post-1"));

    expect(response.status).toBe(401);
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("publica e responde com o status retornado (PUBLISHED)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockResolvedValue("PUBLISHED");

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PUBLISHED");
    expect(publishPostMock).toHaveBeenCalledWith("post-1", "user-1");
  });

  it("responde com o status PROCESSING sem tratar como erro", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockResolvedValue("PROCESSING");

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PROCESSING");
  });

  it("responde 400 com a mensagem do erro de publicação quando o serviço lança", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockRejectedValue(new FakeInstagramPublishError("Post não encontrado."));

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Post não encontrado.");
  });

  it("responde 400 com mensagem genérica para erros inesperados (nunca vaza detalhes internos)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível publicar no Instagram.");
  });

  it("publicação com Instagram e Facebook: publica as duas e devolve o resultado de cada uma", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockResolvedValue("PUBLISHED");
    facebookMock.mockResolvedValue([{ destinationId: "d1", accountName: "Alilu", status: "PUBLISHED" }]);

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string; facebook: Array<{ status: string }> };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PUBLISHED");
    expect(body.facebook[0].status).toBe("PUBLISHED");
  });

  it("falha só no Facebook: Instagram publicado é informado e a resposta sinaliza o erro do Facebook", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockResolvedValue("PUBLISHED");
    facebookMock.mockResolvedValue([{ destinationId: "d1", accountName: "Alilu", status: "FAILED", error: "Reconecte a Página." }]);

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string; instagram: string; partial: boolean };

    expect(response.status).toBe(400);
    expect(body.instagram).toBe("PUBLISHED");
    expect(body.partial).toBe(true);
    expect(body.error).toContain("Instagram: publicado.");
    expect(body.error).toContain("Facebook (Alilu): Reconecte a Página.");
    expect(publishPostMock).toHaveBeenCalledTimes(1);
  });

  it("falha no Instagram não impede o Facebook", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockRejectedValue(new FakeInstagramPublishError("Token inválido."));
    facebookMock.mockResolvedValue([{ destinationId: "d1", accountName: "Alilu", status: "PUBLISHED" }]);

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { error: string; facebook: Array<{ status: string }> };

    expect(facebookMock).toHaveBeenCalledWith("post-1", "user-1", "manual");
    expect(body.facebook[0].status).toBe("PUBLISHED");
    expect(body.error).toContain("Instagram: Token inválido.");
  });

  it("publicação somente Facebook: nunca chama a publicação do Instagram", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    detailsMock.mockResolvedValue({ id: "post-1", publishToInstagram: false, items: [] });
    facebookMock.mockResolvedValue([{ destinationId: "d1", accountName: "Alilu", status: "PROCESSING" }]);

    const response = await POST(request(), routeParams("post-1"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("PROCESSING");
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("?platform=instagram não toca no Facebook", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    publishPostMock.mockResolvedValue("PUBLISHED");
    const response = await POST(
      new Request("https://alilu.com.br/api/instagram/posts/post-1/publish?platform=instagram", { method: "POST" }),
      routeParams("post-1"),
    );
    expect(response.status).toBe(200);
    expect(facebookMock).not.toHaveBeenCalled();
  });

  it("responde 404 para publicação de outro usuário / inexistente", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    detailsMock.mockResolvedValue(null);
    const response = await POST(request(), routeParams("post-x"));
    expect(response.status).toBe(404);
    expect(publishPostMock).not.toHaveBeenCalled();
  });
});
