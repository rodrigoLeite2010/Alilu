// @vitest-environment node
//
// Testa a fiação da rota (autenticação no momento certo, validação de
// pathname, emissão do token assinado, gravação no banco na conclusão)
// mockando `auth`, o repositório, `issueSignedToken` (de "@vercel/blob") e
// `handleUploadPresigned` (de "@vercel/blob/client") — sem nenhuma chamada
// real ao Blob, ao banco ou à sessão.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const insertInstagramMediaMock = vi.fn();
vi.mock("@/lib/instagram/backend/media-repository", () => ({
  insertInstagramMedia: (...args: unknown[]) => insertInstagramMediaMock(...args),
}));

const issueSignedTokenMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  issueSignedToken: (...args: unknown[]) => issueSignedTokenMock(...args),
}));

const handleUploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  handleUploadPresigned: (...args: unknown[]) => handleUploadPresignedMock(...args),
}));

const { POST } = await import("@/app/api/instagram/media/upload/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/instagram/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const FAKE_SIGNED_TOKEN = { delegationToken: "delegation", clientSigningToken: "signing", validUntil: 999 };

type HandleUploadPresignedOptions = {
  getSignedToken: (
    pathname: string,
    clientPayload: string | null,
    multipart: boolean,
  ) => Promise<{
    token: typeof FAKE_SIGNED_TOKEN;
    urlOptions: { allowedContentTypes: string[]; maximumSizeInBytes: number; addRandomSuffix: boolean; tokenPayload: string };
  }>;
  onUploadCompleted: (payload: { blob: { url: string }; tokenPayload: string | null }) => Promise<void>;
};

describe("POST /api/instagram/media/upload", () => {
  beforeEach(() => {
    authMock.mockReset();
    insertInstagramMediaMock.mockReset();
    issueSignedTokenMock.mockReset();
    issueSignedTokenMock.mockResolvedValue(FAKE_SIGNED_TOKEN);
    handleUploadPresignedMock.mockReset();
  });

  it("responde 400 quando o corpo não é JSON válido, sem chamar o Blob", async () => {
    const request = new Request("http://localhost/api/instagram/media/upload", {
      method: "POST",
      body: "não é json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(handleUploadPresignedMock).not.toHaveBeenCalled();
  });

  it("getSignedToken rejeita quando não há sessão autenticada", async () => {
    authMock.mockResolvedValue(null);
    handleUploadPresignedMock.mockImplementation(async (options: HandleUploadPresignedOptions) => {
      await expect(options.getSignedToken("instagram-media/user-1/foto.png", null, false)).rejects.toThrow(
        /não autenticado/i,
      );
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-presigned-url" }));

    expect(handleUploadPresignedMock).toHaveBeenCalledTimes(1);
    expect(issueSignedTokenMock).not.toHaveBeenCalled();
  });

  it("getSignedToken rejeita um pathname fora da pasta do usuário logado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    handleUploadPresignedMock.mockImplementation(async (options: HandleUploadPresignedOptions) => {
      await expect(
        options.getSignedToken("instagram-media/outro-usuario/foto.png", null, false),
      ).rejects.toThrow(/caminho de upload inválido/i);
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-presigned-url" }));

    expect(issueSignedTokenMock).not.toHaveBeenCalled();
  });

  it("getSignedToken aprova um pathname válido, emite o token assinado e devolve os metadados corretos", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    let tokenConfig: Awaited<ReturnType<HandleUploadPresignedOptions["getSignedToken"]>> | undefined;
    handleUploadPresignedMock.mockImplementation(async (options: HandleUploadPresignedOptions) => {
      tokenConfig = await options.getSignedToken(
        "instagram-media/user-1/foto.png",
        JSON.stringify({ originalFilename: "foto.png", fileSizeBytes: 12345 }),
        false,
      );
      return {};
    });

    await POST(jsonRequest({ type: "blob.generate-presigned-url" }));

    expect(issueSignedTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "instagram-media/user-1/foto.png",
        operations: ["put"],
        allowedContentTypes: ["image/jpeg"],
        maximumSizeInBytes: 15 * 1024 * 1024,
      }),
    );
    expect(tokenConfig?.token).toBe(FAKE_SIGNED_TOKEN);
    expect(tokenConfig?.urlOptions.allowedContentTypes).toEqual(["image/jpeg"]);
    expect(tokenConfig?.urlOptions.maximumSizeInBytes).toBe(15 * 1024 * 1024);
    expect(JSON.parse(tokenConfig!.urlOptions.tokenPayload)).toEqual({
      userId: "user-1",
      originalFilename: "foto.png",
      fileSizeBytes: 12345,
    });
  });

  it("onUploadCompleted grava a mídia no banco quando o tokenPayload é válido", async () => {
    handleUploadPresignedMock.mockImplementation(async (options: HandleUploadPresignedOptions) => {
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
    handleUploadPresignedMock.mockImplementation(async (options: HandleUploadPresignedOptions) => {
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

  it("responde 400 com a mensagem do erro quando handleUploadPresigned lança (ex.: falha de autenticação)", async () => {
    handleUploadPresignedMock.mockRejectedValue(new Error("Não autenticado."));

    const response = await POST(jsonRequest({ type: "blob.generate-presigned-url" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("Não autenticado.");
  });
});
