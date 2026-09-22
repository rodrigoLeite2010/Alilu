// @vitest-environment node
//
// Testa a rota de criação de post mockando `auth` e o serviço — sem
// nenhuma chamada real de rede ou de banco.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPostValidationError extends Error {}
const createImagePostFromUploadMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  InstagramPostValidationError: FakeInstagramPostValidationError,
  createImagePostFromUpload: (...args: unknown[]) => createImagePostFromUploadMock(...args),
}));

const { POST } = await import("@/app/api/instagram/posts/route");

function request(body: unknown): Request {
  return new Request("https://alilu.com.br/api/instagram/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/instagram/posts", () => {
  beforeEach(() => {
    authMock.mockReset();
    createImagePostFromUploadMock.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));

    expect(response.status).toBe(401);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando mediaUrl está ausente", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(request({ caption: "Legenda" }));

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando a legenda excede o limite do Instagram", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      request({ mediaUrl: "https://blob/img.jpg", caption: "a".repeat(2201) }),
    );

    expect(response.status).toBe(400);
    expect(createImagePostFromUploadMock).not.toHaveBeenCalled();
  });

  it("cria o post e responde 201 com o id", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockResolvedValue("post-1");

    const response = await POST(request({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { postId: string };

    expect(response.status).toBe(201);
    expect(body.postId).toBe("post-1");
    expect(createImagePostFromUploadMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaUrl: "https://blob/img.jpg",
      caption: "Legenda",
    });
  });

  it("responde 400 com a mensagem do erro de validação quando o serviço rejeita", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockRejectedValue(
      new FakeInstagramPostValidationError("Mídia não encontrada."),
    );

    const response = await POST(request({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Mídia não encontrada.");
  });

  it("responde 400 com mensagem genérica para erros inesperados (nunca vaza detalhes internos)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createImagePostFromUploadMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await POST(request({ mediaUrl: "https://blob/img.jpg", caption: "Legenda" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Não foi possível criar o post.");
  });
});
