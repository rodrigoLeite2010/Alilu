// @vitest-environment node
//
// Testa as rotas de listagem/criação de post mockando `auth` e o serviço —
// sem nenhuma chamada real de rede ou de banco.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPostValidationError extends Error {}
const createImagePostFromUploadMock = vi.fn();
const listPostsForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  InstagramPostValidationError: FakeInstagramPostValidationError,
  createImagePostFromUpload: (...args: unknown[]) => createImagePostFromUploadMock(...args),
  listPostsForUser: (...args: unknown[]) => listPostsForUserMock(...args),
}));

const { GET, POST } = await import("@/app/api/instagram/posts/route");

function postRequest(body: unknown): Request {
  return new Request("https://alilu.com.br/api/instagram/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/instagram/posts", () => {
  beforeEach(() => {
    authMock.mockReset();
    listPostsForUserMock.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listPostsForUserMock).not.toHaveBeenCalled();
  });

  it("responde 200 com a lista de posts do usuário autenticado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockResolvedValue([{ id: "post-1", status: "DRAFT" }]);

    const response = await GET();
    const body = (await response.json()) as { posts: unknown[] };

    expect(response.status).toBe(200);
    expect(body.posts).toEqual([{ id: "post-1", status: "DRAFT" }]);
    expect(listPostsForUserMock).toHaveBeenCalledWith("user-1");
  });

  it("responde 500 sem vazar detalhes quando a listagem falha", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Não foi possível carregar os posts.");
  });
});

describe("POST /api/instagram/posts", () => {
  beforeEach(() => {
    authMock.mockReset();
    createImagePostFromUploadMock.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));

    expect(response.status).toBe(401);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando mediaUrl está ausente", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(postRequest({ caption: "Legenda" }));

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando a legenda excede o limite do Instagram", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      postRequest({ mediaUrl: "https://blob/img.jpg", caption: "a".repeat(2201) }),
    );

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando scheduledAt não é texto nem nulo", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda", scheduledAt: 123 }),
    );

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("cria o post e responde 201 com o id (sem agendamento, scheduledAt vai como null)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockResolvedValue("post-1");

    const response = await POST(postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { postId: string };

    expect(response.status).toBe(201);
    expect(body.postId).toBe("post-1");
    expect(createImagePostFromUploadMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaUrl: "https://blob/img.jpg",
      caption: "Legenda",
      scheduledAt: null,
    });
  });

  it("cria o post agendado repassando scheduledAt para o serviço", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockResolvedValue("post-1");

    const response = await POST(
      postRequest({
        mediaUrl: "https://blob/img.jpg",
        caption: "Legenda",
        scheduledAt: "2026-12-01T10:00:00.000Z",
      }),
    );

    expect(response.status).toBe(201);
    expect(createImagePostFromUploadMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaUrl: "https://blob/img.jpg",
      caption: "Legenda",
      scheduledAt: "2026-12-01T10:00:00.000Z",
    });
  });

  it("responde 400 com a mensagem do erro de validação quando o serviço rejeita", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockRejectedValue(
      new FakeInstagramPostValidationError("Mídia não encontrada."),
    );

    const response = await POST(postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Mídia não encontrada.");
  });

  it("responde 400 com mensagem genérica para erros inesperados (nunca vaza detalhes internos)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await POST(postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível criar o post.");
  });
});
