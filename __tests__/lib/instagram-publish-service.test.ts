// @vitest-environment node
//
// Testa a orquestração da publicação mockando o cliente da Meta, o
// repositório de posts e a descriptografia — nenhuma chamada de rede ou
// de banco real, e nenhum sleep de verdade (usa fake timers no caso de
// polling que não termina a tempo).
import { afterEach, describe, expect, it, vi } from "vitest";

class FakeInstagramGraphApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}

const createImageMediaContainerMock = vi.fn();
const getMediaContainerStatusMock = vi.fn();
const publishMediaContainerMock = vi.fn();
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  InstagramGraphApiError: FakeInstagramGraphApiError,
  createImageMediaContainer: (...args: unknown[]) => createImageMediaContainerMock(...args),
  getMediaContainerStatus: (...args: unknown[]) => getMediaContainerStatusMock(...args),
  publishMediaContainer: (...args: unknown[]) => publishMediaContainerMock(...args),
}));

const getPostForPublishMock = vi.fn();
const markPostProcessingMock = vi.fn();
const markPostPublishedMock = vi.fn();
const markPostFailedMock = vi.fn();
const recordPublishAttemptMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => ({
  getPostForPublish: (...args: unknown[]) => getPostForPublishMock(...args),
  markPostProcessing: (...args: unknown[]) => markPostProcessingMock(...args),
  markPostPublished: (...args: unknown[]) => markPostPublishedMock(...args),
  markPostFailed: (...args: unknown[]) => markPostFailedMock(...args),
  recordPublishAttempt: (...args: unknown[]) => recordPublishAttemptMock(...args),
}));

const decryptSecretMock = vi.fn();
vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: (...args: unknown[]) => decryptSecretMock(...args),
}));

const { InstagramPublishError, publishImagePost } = await import(
  "@/lib/instagram/backend/instagram-publish-service"
);

function basePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    postType: "image",
    status: "DRAFT",
    caption: "Legenda",
    metaContainerId: null,
    igUserId: "ig-1",
    accessTokenEncrypted: "enc-token",
    mediaStorageUrl: "https://blob.example.com/img.jpg",
    mediaType: "image",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("publishImagePost", () => {
  it("lança InstagramPublishError se o post não existe", async () => {
    getPostForPublishMock.mockResolvedValue(null);
    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("é idempotente: retorna PUBLISHED sem tentar publicar de novo se já estava publicado", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ status: "PUBLISHED" }));

    const result = await publishImagePost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createImageMediaContainerMock).not.toHaveBeenCalled();
  });

  it("lança se o post não está num status publicável (ex.: CANCELLED)", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ status: "CANCELLED" }));
    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("lança se o tipo do post não é imagem (carrossel/reels são etapas futuras)", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ postType: "carousel" }));
    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("lança se a mídia associada não é uma imagem", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ mediaType: "video" }));
    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("cria o container, aguarda FINISHED e publica com sucesso", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishImagePost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createImageMediaContainerMock).toHaveBeenCalledWith({
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/img.jpg",
      caption: "Legenda",
    });
    expect(markPostProcessingMock).toHaveBeenCalledWith("post-1", "container-1");
    expect(markPostPublishedMock).toHaveBeenCalledWith("post-1", "media-1");
    expect(recordPublishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        outcome: "success",
        containerId: "container-1",
        mediaId: "media-1",
      }),
    );
  });

  it("retoma de um container já existente (PROCESSING de uma tentativa anterior) sem criar um novo", async () => {
    getPostForPublishMock.mockResolvedValue(
      basePost({ status: "PROCESSING", metaContainerId: "container-1" }),
    );
    decryptSecretMock.mockReturnValue("token-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishImagePost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createImageMediaContainerMock).not.toHaveBeenCalled();
    expect(markPostProcessingMock).not.toHaveBeenCalled();
  });

  it("marca FAILED e registra a tentativa se a criação do container falhar", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockRejectedValue(new FakeInstagramGraphApiError("boom"));

    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalledWith("post-1", "boom");
    expect(recordPublishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-1", outcome: "failure" }),
    );
  });

  it("marca FAILED se o status vier ERROR", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("ERROR");

    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalled();
    expect(publishMediaContainerMock).not.toHaveBeenCalled();
  });

  it("marca FAILED se o status vier EXPIRED", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("EXPIRED");

    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalled();
  });

  it("marca FAILED se a publicação final falhar mesmo com o container FINISHED", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockRejectedValue(new FakeInstagramGraphApiError("falhou publicar"));

    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalledWith("post-1", "falhou publicar");
  });

  it("lança (sem marcar FAILED) se a consulta de status falhar — pode ser transitório", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockRejectedValue(new FakeInstagramGraphApiError("timeout"));

    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).not.toHaveBeenCalled();
    expect(recordPublishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-1", outcome: "failure" }),
    );
  });

  it("retorna PROCESSING (sem lançar, sem marcar FAILED) se o polling esgotar sem terminar", async () => {
    vi.useFakeTimers();
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("IN_PROGRESS");

    const resultPromise = publishImagePost("post-1", "user-1");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("PROCESSING");
    expect(markPostFailedMock).not.toHaveBeenCalled();
    expect(markPostPublishedMock).not.toHaveBeenCalled();
    expect(recordPublishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-1", outcome: "pending", containerId: "container-1" }),
    );
  });
});
