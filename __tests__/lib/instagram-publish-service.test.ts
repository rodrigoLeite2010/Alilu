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
const createCarouselItemContainerMock = vi.fn();
const createCarouselContainerMock = vi.fn();
const getMediaContainerStatusMock = vi.fn();
const publishMediaContainerMock = vi.fn();
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  InstagramGraphApiError: FakeInstagramGraphApiError,
  createImageMediaContainer: (...args: unknown[]) => createImageMediaContainerMock(...args),
  createCarouselItemContainer: (...args: unknown[]) => createCarouselItemContainerMock(...args),
  createCarouselContainer: (...args: unknown[]) => createCarouselContainerMock(...args),
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

const { InstagramPublishError, publishImagePost, publishCarouselPost, publishPost } = await import(
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
    items: [
      { mediaId: "media-1", storageUrl: "https://blob.example.com/img.jpg", mediaType: "image", position: 0 },
    ],
    ...overrides,
  };
}

function baseCarouselPost(overrides: Record<string, unknown> = {}) {
  return basePost({
    postType: "carousel",
    caption: "Legenda do carrossel",
    items: [
      { mediaId: "media-1", storageUrl: "https://blob.example.com/slide-01.jpg", mediaType: "image", position: 0 },
      { mediaId: "media-2", storageUrl: "https://blob.example.com/slide-02.jpg", mediaType: "image", position: 1 },
    ],
    ...overrides,
  });
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

  it("permite publicar um post SCHEDULED manualmente, antes da hora agendada (calendário editorial)", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ status: "SCHEDULED" }));
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishImagePost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createImageMediaContainerMock).toHaveBeenCalled();
  });

  it("lança se o tipo do post não é imagem (carrossel usa publishCarouselPost)", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    await expect(publishImagePost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("lança se a mídia associada não é uma imagem", async () => {
    getPostForPublishMock.mockResolvedValue(
      basePost({
        items: [{ mediaId: "media-1", storageUrl: "https://blob.example.com/video.mp4", mediaType: "video", position: 0 }],
      }),
    );
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

describe("publishCarouselPost", () => {
  it("lança InstagramPublishError se o post não existe", async () => {
    getPostForPublishMock.mockResolvedValue(null);
    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("é idempotente: retorna PUBLISHED sem tentar publicar de novo se já estava publicado", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost({ status: "PUBLISHED" }));

    const result = await publishCarouselPost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });

  it("lança se o tipo do post não é carrossel (imagem única usa publishImagePost)", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("lança se o post tem menos de 2 itens", async () => {
    getPostForPublishMock.mockResolvedValue(
      baseCarouselPost({
        items: [{ mediaId: "media-1", storageUrl: "https://blob/1.jpg", mediaType: "image", position: 0 }],
      }),
    );
    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });

  it("lança se o post tem mais de 10 itens", async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      mediaId: `media-${i + 1}`,
      storageUrl: `https://blob/${i + 1}.jpg`,
      mediaType: "image" as const,
      position: i,
    }));
    getPostForPublishMock.mockResolvedValue(baseCarouselPost({ items }));
    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });

  it("lança se algum item não é imagem (vídeo/Reels em carrossel é etapa futura)", async () => {
    getPostForPublishMock.mockResolvedValue(
      baseCarouselPost({
        items: [
          { mediaId: "media-1", storageUrl: "https://blob/1.jpg", mediaType: "image", position: 0 },
          { mediaId: "media-2", storageUrl: "https://blob/2.mp4", mediaType: "video", position: 1 },
        ],
      }),
    );
    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });

  it("cria um container por item (na ordem), depois o container pai com a legenda, aguarda FINISHED e publica", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    decryptSecretMock.mockReturnValue("token-1");
    createCarouselItemContainerMock
      .mockResolvedValueOnce("item-container-1")
      .mockResolvedValueOnce("item-container-2");
    createCarouselContainerMock.mockResolvedValue("carousel-container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishCarouselPost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createCarouselItemContainerMock).toHaveBeenNthCalledWith(1, {
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/slide-01.jpg",
    });
    expect(createCarouselItemContainerMock).toHaveBeenNthCalledWith(2, {
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/slide-02.jpg",
    });
    expect(createCarouselContainerMock).toHaveBeenCalledWith({
      igUserId: "ig-1",
      accessToken: "token-1",
      childrenContainerIds: ["item-container-1", "item-container-2"],
      caption: "Legenda do carrossel",
    });
    expect(markPostProcessingMock).toHaveBeenCalledWith("post-1", "carousel-container-1");
    expect(markPostPublishedMock).toHaveBeenCalledWith("post-1", "media-1");
  });

  it("retoma de um container pai já existente (PROCESSING de uma tentativa anterior) sem recriar os itens", async () => {
    getPostForPublishMock.mockResolvedValue(
      baseCarouselPost({ status: "PROCESSING", metaContainerId: "carousel-container-1" }),
    );
    decryptSecretMock.mockReturnValue("token-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishCarouselPost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
    expect(createCarouselContainerMock).not.toHaveBeenCalled();
  });

  it("marca FAILED se a criação de um container de item falhar (sem criar o container pai)", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    decryptSecretMock.mockReturnValue("token-1");
    createCarouselItemContainerMock
      .mockResolvedValueOnce("item-container-1")
      .mockRejectedValueOnce(new FakeInstagramGraphApiError("Invalid image_url"));

    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalledWith("post-1", "Invalid image_url");
    expect(createCarouselContainerMock).not.toHaveBeenCalled();
  });

  it("marca FAILED se a criação do container pai falhar", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    decryptSecretMock.mockReturnValue("token-1");
    createCarouselItemContainerMock
      .mockResolvedValueOnce("item-container-1")
      .mockResolvedValueOnce("item-container-2");
    createCarouselContainerMock.mockRejectedValue(new FakeInstagramGraphApiError("Invalid children"));

    await expect(publishCarouselPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(markPostFailedMock).toHaveBeenCalledWith("post-1", "Invalid children");
    expect(markPostProcessingMock).not.toHaveBeenCalled();
  });

  it("retorna PROCESSING (sem lançar) se o polling do container pai esgotar sem terminar", async () => {
    vi.useFakeTimers();
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    decryptSecretMock.mockReturnValue("token-1");
    createCarouselItemContainerMock
      .mockResolvedValueOnce("item-container-1")
      .mockResolvedValueOnce("item-container-2");
    createCarouselContainerMock.mockResolvedValue("carousel-container-1");
    getMediaContainerStatusMock.mockResolvedValue("IN_PROGRESS");

    const resultPromise = publishCarouselPost("post-1", "user-1");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("PROCESSING");
    expect(markPostFailedMock).not.toHaveBeenCalled();
  });
});

describe("publishPost (despacho por tipo)", () => {
  it("lança InstagramPublishError se o post não existe", async () => {
    getPostForPublishMock.mockResolvedValue(null);
    await expect(publishPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
  });

  it("despacha para o fluxo de imagem única quando postType é image", async () => {
    getPostForPublishMock.mockResolvedValue(basePost());
    decryptSecretMock.mockReturnValue("token-1");
    createImageMediaContainerMock.mockResolvedValue("container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishPost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createImageMediaContainerMock).toHaveBeenCalled();
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });

  it("despacha para o fluxo de carrossel quando postType é carousel", async () => {
    getPostForPublishMock.mockResolvedValue(baseCarouselPost());
    decryptSecretMock.mockReturnValue("token-1");
    createCarouselItemContainerMock.mockResolvedValue("item-container-1");
    createCarouselContainerMock.mockResolvedValue("carousel-container-1");
    getMediaContainerStatusMock.mockResolvedValue("FINISHED");
    publishMediaContainerMock.mockResolvedValue("media-1");

    const result = await publishPost("post-1", "user-1");

    expect(result).toBe("PUBLISHED");
    expect(createCarouselItemContainerMock).toHaveBeenCalled();
    expect(createImageMediaContainerMock).not.toHaveBeenCalled();
  });

  it("lança InstagramPublishError para um tipo de post ainda não suportado (ex.: reels)", async () => {
    getPostForPublishMock.mockResolvedValue(basePost({ postType: "reels" }));

    await expect(publishPost("post-1", "user-1")).rejects.toThrow(InstagramPublishError);
    expect(createImageMediaContainerMock).not.toHaveBeenCalled();
    expect(createCarouselItemContainerMock).not.toHaveBeenCalled();
  });
});
