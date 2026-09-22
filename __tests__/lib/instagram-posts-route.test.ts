// @vitest-environment node
//
// Testa as rotas de listagem/criação de post mockando `auth` e o serviço —
// sem nenhuma chamada real de rede ou de banco.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPostValidationError extends Error {}
const createImagePostFromUploadMock = vi.fn();
const createCarouselPostFromUploadMock = vi.fn();
const listPostsForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  InstagramPostValidationError: FakeInstagramPostValidationError,
  createImagePostFromUpload: (...args: unknown[]) => createImagePostFromUploadMock(...args),
  createCarouselPostFromUpload: (...args: unknown[]) => createCarouselPostFromUploadMock(...args),
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

describe("POST /api/instagram/posts — imagem única (mediaUrl)", () => {
  beforeEach(() => {
    authMock.mockReset();
    createImagePostFromUploadMock.mockReset();
    createCarouselPostFromUploadMock.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(postRequest({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));

    expect(response.status).toBe(401);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando nem mediaUrl nem mediaUrls estão presentes", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(postRequest({ caption: "Legenda" }));

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
    expect(createCarouselPostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando mediaUrl e mediaUrls são informados juntos", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      postRequest({ mediaUrl: "https://blob/img.jpg", mediaUrls: ["https://blob/1.jpg"], caption: "Legenda" }),
    );

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
    expect(createCarouselPostFromUploadMock).not.toHaveBeenCalled();
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

describe("POST /api/instagram/posts — carrossel (mediaUrls)", () => {
  beforeEach(() => {
    authMock.mockReset();
    createImagePostFromUploadMock.mockReset();
    createCarouselPostFromUploadMock.mockReset();
  });

  it("responde 400 quando mediaUrls não é uma lista de strings", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(postRequest({ mediaUrls: "não-é-uma-lista", caption: "Legenda" }));

    expect(response.status).toBe(400);
    expect(createCarouselPostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando um item de mediaUrls não é string", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      postRequest({ mediaUrls: ["https://blob/1.jpg", 123], caption: "Legenda" }),
    );

    expect(response.status).toBe(400);
    expect(createCarouselPostFromUploadMock).not.toHaveBeenCalled();
  });

  it("cria o carrossel e responde 201 com o id, repassando as URLs na ordem recebida", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createCarouselPostFromUploadMock.mockResolvedValue("post-1");

    const response = await POST(
      postRequest({
        mediaUrls: ["https://blob/1.jpg", "https://blob/2.jpg", "https://blob/3.jpg"],
        caption: "Legenda do carrossel",
      }),
    );
    const body = (await response.json()) as { postId: string };

    expect(response.status).toBe(201);
    expect(body.postId).toBe("post-1");
    expect(createCarouselPostFromUploadMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaUrls: ["https://blob/1.jpg", "https://blob/2.jpg", "https://blob/3.jpg"],
      caption: "Legenda do carrossel",
      scheduledAt: null,
    });
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("cria o carrossel agendado repassando scheduledAt para o serviço", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createCarouselPostFromUploadMock.mockResolvedValue("post-1");

    const response = await POST(
      postRequest({
        mediaUrls: ["https://blob/1.jpg", "https://blob/2.jpg"],
        caption: "Legenda",
        scheduledAt: "2026-12-01T10:00:00.000Z",
      }),
    );

    expect(response.status).toBe(201);
    expect(createCarouselPostFromUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: "2026-12-01T10:00:00.000Z" }),
    );
  });

  it("responde 400 com a mensagem do erro de validação quando o serviço rejeita (ex.: menos de 2 imagens)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createCarouselPostFromUploadMock.mockRejectedValue(
      new FakeInstagramPostValidationError("Um carrossel precisa ter entre 2 e 10 imagens."),
    );

    const response = await POST(
      postRequest({ mediaUrls: ["https://blob/1.jpg"], caption: "Legenda" }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Um carrossel precisa ter entre 2 e 10 imagens.");
  });
});
