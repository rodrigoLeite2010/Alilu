// @vitest-environment node
//
// Testa a fiação da rota (autenticação no momento certo, validação de
// pathname, gravação no banco na conclusão) mockando `auth`, o repositório
// e `handleUpload` do @vercel/blob/client — sem nenhuma chamada real ao
// Blob, ao banco ou à sessão.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const insertInstagramMediaMock = vi.fn();
vi.mock("@/lib/instagram/backend/media-repository", () => ({
  insertInstagramMedia: (...args: unknown[]) => insertInstagramMediaMock(...args),
}));

const handleUploadMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  handleUpload: (...args: unknown[]) => handleUploadMock(...args),
}));

const { POST } = await import("@/app/api/instagram/media/upload/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/instagram/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type HandleUploadOptions = {
  onBeforeGenerateToken: (
    pathname: string,
    clientPayload: string | null,
  ) => Promise<{ allowedContentTypes: string[]; maximumSizeInBytes: number; addRandomSuffix: boolean; tokenPayload: string }>;
  onUploadCompleted: (payload: { blob: { url: string }; tokenPayload: string | null }) => Promise<void>;
};

describe("POST /api/instagram/media/upload", () => {
  beforeEach(() => {
    authMock.mockReset();
    insertInstagramMediaMock.mockReset();
    handleUploadMock.mockReset();
  });

  it("responde 400 quando o corpo não é JSON válido, sem chamar o Blob", async () => {
    const request = new Request("http://localhost/api/instagram/media/upload", {
      method: "POST",
      body: "não é json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("onBeforeGenerateToken rejeita quando não há sessão autenticada", async () => {
    authMock.mockResolvedValue(null);
    handleUploadMock.mockImplementation(async (options: HandleUploadOptions) => {
      await expect(options.onBeforeGenerateToken("instagram-media/user-1/foto.png", null)).rejects.toThrow(
        /não autenticado/i,
      );
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-client-token" }));

    expect(handleUploadMock).toHaveBeenCalledTimes(1);
  });

  it("onBeforeGenerateToken rejeita um pathname fora da pasta do usuário logado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    handleUploadMock.mockImplementation(async (options: HandleUploadOptions) => {
      await expect(
        options.onBeforeGenerateToken("instagram-media/outro-usuario/foto.png", null),
      ).rejects.toThrow(/caminho de upload inválido/i);
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-client-token" }));
  });

  it("onBeforeGenerateToken aprova um pathname válido com os metadados corretos", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    let tokenConfig: Awaited<ReturnType<HandleUploadOptions["onBeforeGenerateToken"]>> | undefined;
    handleUploadMock.mockImplementation(async (options: HandleUploadOptions) => {
      tokenConfig = await options.onBeforeGenerateToken(
        "instagram-media/user-1/foto.png",
        JSON.stringify({ originalFilename: "foto.png", fileSizeBytes: 12345 }),
      );
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-client-token" }));

    expect(tokenConfig?.allowedContentTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(tokenConfig?.maximumSizeInBytes).toBe(15 * 1024 * 1024);
    expect(JSON.parse(tokenConfig!.tokenPayload)).toEqual({
      userId: "user-1",
      originalFilename: "foto.png",
      fileSizeBytes: 12345,
    });
  });

  it("onUploadCompleted grava a mídia no banco quando o tokenPayload é válido", async () => {
    handleUploadMock.mockImplementation(async (options: HandleUploadOptions) => {
      await options.onUploadCompleted({
        blob: { url: "https://blob.vercel-storage.com/foto-abc.png" },
        tokenPayload: JSON.stringify({ userId: "user-1", originalFilename: "foto.png", fileSizeBytes: 12345 }),
      });
      return {};
    });

    await POST(jsonRequest({ type: "blob.upload-completed" }));

    expect(insertInstagramMediaMock).toHaveBeenCalledWith({
      userId: "user-1",
      storageUrl: "https://blob.vercel-storage.com/foto-abc.png",
      mediaType: "image",
      fileSizeBytes: 12345,
      originalFilename: "foto.png",
    });
  });

  it("onUploadCompleted não grava nada (e não lança) quando o tokenPayload é inválido", async () => {
    handleUploadMock.mockImplementation(async (options: HandleUploadOptions) => {
      await options.onUploadCompleted({
        blob: { url: "https://blob.vercel-storage.com/foto-abc.png" },
        tokenPayload: "não é json",
      });
      return {};
    });

    const response = await POST(jsonRequest({ type: "blob.upload-completed" }));

    expect(response.status).toBe(200);
    expect(insertInstagramMediaMock).not.toHaveBeenCalled();
  });

  it("responde 400 com a mensagem do erro quando handleUpload lança (ex.: falha de autenticação)", async () => {
    handleUploadMock.mockRejectedValue(new Error("Não autenticado."));

    const response = await POST(jsonRequest({ type: "blob.generate-client-token" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("Não autenticado.");
  });
});
