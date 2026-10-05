// @vitest-environment node
//
// Orquestração da camada única de publicação com repositório e Meta
// simulados (sem banco, sem rede). O SQL real de claim/lock/retry é
// testado em instagram-scheduler.test.ts (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeInstagramGraphApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}

const meta = {
  createImageMediaContainer: vi.fn(),
  createCarouselItemContainer: vi.fn(),
  createCarouselContainer: vi.fn(),
  createReelMediaContainer: vi.fn(),
  createStoryMediaContainer: vi.fn(),
  getMediaContainerStatus: vi.fn(),
  publishMediaContainer: vi.fn(),
};
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  InstagramGraphApiError: FakeInstagramGraphApiError,
  ...Object.fromEntries(Object.entries(meta).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])),
}));

const repo = {
  claimPostForManualPublish: vi.fn(),
  getPostForPublish: vi.fn(),
  getPostStatusForUser: vi.fn(),
  markPostFailed: vi.fn(),
  markPostProcessing: vi.fn(),
  markPostPublished: vi.fn(),
  recordPublishAttempt: vi.fn(),
  releasePostForResume: vi.fn(),
  saveCarouselChildren: vi.fn(),
  schedulePostRetry: vi.fn(),
};
vi.mock("@/lib/instagram/backend/instagram-post-repository", () =>
  Object.fromEntries(Object.entries(repo).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])),
);

vi.mock("@/lib/instagram/backend/encryption", () => ({ decryptSecret: () => "token-secreto" }));

const { InstagramPublishError, publishPost, publishInstagramPublication } = await import(
  "@/lib/instagram/backend/instagram-publish-service"
);

const claimed = {
  id: "post-1",
  userId: "user-1",
  postType: "image" as const,
  scheduledAtUtc: null,
  processingStartedAt: new Date().toISOString(),
  attemptsCount: 0,
};

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    postType: "image",
    status: "PROCESSING",
    caption: "Legenda",
    metaContainerId: null,
    igUserId: "ig-1",
    accessTokenEncrypted: "enc",
    items: [{ mediaId: "m1", storageUrl: "https://blob/1.jpg", mediaType: "image", position: 0 }],
    ...overrides,
  };
}

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const fn of Object.values(repo)) fn.mockResolvedValue(undefined);
  repo.claimPostForManualPublish.mockResolvedValue(claimed);
  repo.getPostForPublish.mockResolvedValue(post());
  vi.spyOn(console, "info").mockImplementation((line: string) => void logs.push(line));
  vi.spyOn(console, "error").mockImplementation((line: string) => void logs.push(String(line)));
});

afterEach(() => {
  for (const fn of [...Object.values(repo), ...Object.values(meta)]) fn.mockReset();
  vi.restoreAllMocks();
});

describe("publishPost (Publicar agora)", () => {
  it("faz o claim antes de chamar a Meta e publica", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");

    const [, , lockToken] = repo.claimPostForManualPublish.mock.calls[0];
    expect(repo.claimPostForManualPublish.mock.invocationCallOrder[0]).toBeLessThan(
      meta.createImageMediaContainer.mock.invocationCallOrder[0],
    );
    expect(repo.markPostProcessing).toHaveBeenCalledWith("post-1", "c1", lockToken);
    expect(repo.markPostPublished).toHaveBeenCalledWith("post-1", "media-1", lockToken);
  });

  it("sem claim e já PUBLISHED: devolve PUBLISHED sem tocar na Meta (idempotente)", async () => {
    repo.claimPostForManualPublish.mockResolvedValue(null);
    repo.getPostStatusForUser.mockResolvedValue("PUBLISHED");
    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
  });

  it("sem claim e outro processo publicando: devolve PROCESSING sem publicar de novo", async () => {
    repo.claimPostForManualPublish.mockResolvedValue(null);
    repo.getPostStatusForUser.mockResolvedValue("PROCESSING");
    await expect(publishPost("post-1", "user-1")).resolves.toBe("PROCESSING");
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
  });

  it("sem claim e post de outro usuário/inexistente: erro genérico", async () => {
    repo.claimPostForManualPublish.mockResolvedValue(null);
    repo.getPostStatusForUser.mockResolvedValue(null);
    await expect(publishPost("post-1", "user-2")).rejects.toThrow("Publicação não encontrada.");
  });

  it("container com status ERROR vira FAILED com mensagem sanitizada", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("ERROR");
    await expect(publishPost("post-1", "user-1")).rejects.toBeInstanceOf(InstagramPublishError);
    expect(repo.markPostFailed).toHaveBeenCalledWith("post-1", expect.stringMatching(/não conseguiu processar/), expect.any(String));
    expect(meta.publishMediaContainer).not.toHaveBeenCalled();
  });

  it("carrossel com 1 item falha na validação, sem chamar a Meta", async () => {
    repo.getPostForPublish.mockResolvedValue(post({ postType: "carousel" }));
    await expect(publishPost("post-1", "user-1")).rejects.toThrow(/entre 2 e 10/);
    expect(meta.createCarouselItemContainer).not.toHaveBeenCalled();
  });

  it("Reel com mídia de imagem falha na validação", async () => {
    repo.getPostForPublish.mockResolvedValue(post({ postType: "reels" }));
    await expect(publishPost("post-1", "user-1")).rejects.toThrow(/não é um vídeo/);
  });

  it("falha temporária agenda nova tentativa em vez de falhar", async () => {
    meta.createImageMediaContainer.mockRejectedValue(new FakeInstagramGraphApiError("x", { error: { code: 4 } }));
    await expect(publishPost("post-1", "user-1")).resolves.toBe("RETRY_SCHEDULED");
    expect(repo.schedulePostRetry).toHaveBeenCalled();
    expect(repo.markPostFailed).not.toHaveBeenCalled();
  });

  it("nunca coloca o token em logs, mensagens ou banco", async () => {
    meta.createImageMediaContainer.mockRejectedValue(
      new FakeInstagramGraphApiError("x", { error: { code: 190, message: "bad token" } }),
    );
    await expect(publishPost("post-1", "user-1")).rejects.toThrow();
    const everything = JSON.stringify([logs, repo.markPostFailed.mock.calls, repo.recordPublishAttempt.mock.calls]);
    expect(everything).not.toContain("token-secreto");
  });

  it("container que passa de 2h processando vira FAILED", async () => {
    meta.getMediaContainerStatus.mockResolvedValue("IN_PROGRESS");
    repo.getPostForPublish.mockResolvedValue(post({ metaContainerId: "c1" }));
    const old = { ...claimed, processingStartedAt: new Date(Date.now() - 3 * 3600_000).toISOString() };
    await expect(
      publishInstagramPublication("post-1", "user-1", { trigger: "scheduler", claimed: { post: old, lockToken: "l" }, pollIntervalMs: 0 }),
    ).rejects.toThrow(/expirou/);
  });
});

describe("música (resolveRequestedMusic/resolveMusicApplication no publish)", () => {
  it("registra music.resolved quando a conta tem música padrão habilitada e o post herda ACCOUNT_DEFAULT", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");
    repo.getPostForPublish.mockResolvedValue(
      post({
        musicMode: "ACCOUNT_DEFAULT",
        musicSelection: null,
        accountDefaultMusic: {
          enabled: true,
          type: "InstagramCatalog",
          name: "Beautiful Day",
          artist: "U2",
          externalId: null,
          url: null,
          audioFileUrl: null,
          audioFileName: null,
        },
      }),
    );

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");

    const musicLine = logs.map((line) => JSON.parse(line)).find((entry) => entry.event === "music.resolved");
    expect(musicLine).toMatchObject({ musicMode: "ACCOUNT_DEFAULT", musicApplied: false });
    expect(musicLine.musicReason).toMatch(/catálogo do Instagram não pode ser adicionada automaticamente/);
    // Nunca o nome/artista da música (conteúdo do usuário) no log.
    expect(JSON.stringify(logs)).not.toContain("Beautiful Day");
  });

  it("musicMode NONE nunca gera log de música (nada pedido, nada a explicar)", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");
    repo.getPostForPublish.mockResolvedValue(
      post({
        musicMode: "NONE",
        accountDefaultMusic: { enabled: true, type: "InstagramCatalog", name: "X", artist: "Y", externalId: null, url: null, audioFileUrl: null, audioFileName: null },
      }),
    );

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");
    expect(logs.map((line) => JSON.parse(line)).some((entry) => entry.event === "music.resolved")).toBe(false);
  });

  it("conta sem música configurada e musicMode ACCOUNT_DEFAULT: sem log de música, publica normalmente", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");
    repo.getPostForPublish.mockResolvedValue(
      post({
        musicMode: "ACCOUNT_DEFAULT",
        accountDefaultMusic: { enabled: false, type: "None", name: null, artist: null, externalId: null, url: null, audioFileUrl: null, audioFileName: null },
      }),
    );

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");
    expect(logs.map((line) => JSON.parse(line)).some((entry) => entry.event === "music.resolved")).toBe(false);
    expect(repo.markPostPublished).toHaveBeenCalled();
  });

  it("não resolve música de novo ao retomar um container já criado (metaContainerId presente)", async () => {
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");
    repo.getPostForPublish.mockResolvedValue(
      post({
        metaContainerId: "c1",
        musicMode: "ACCOUNT_DEFAULT",
        accountDefaultMusic: { enabled: true, type: "InstagramCatalog", name: "X", artist: "Y", externalId: null, url: null, audioFileUrl: null, audioFileName: null },
      }),
    );

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
    expect(logs.map((line) => JSON.parse(line)).some((entry) => entry.event === "music.resolved")).toBe(false);
  });

  it("trilha própria (CustomAudio) em imagem nunca é aplicada, e o motivo registrado é o de mídia estática", async () => {
    meta.createImageMediaContainer.mockResolvedValue("c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("media-1");
    repo.getPostForPublish.mockResolvedValue(
      post({
        musicMode: "CUSTOM",
        musicSelection: { type: "CustomAudio", name: null, artist: null, externalId: null, url: null, audioFileUrl: "https://blob/audio.mp3", audioFileName: "trilha.mp3" },
      }),
    );

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");
    const musicLine = logs.map((line) => JSON.parse(line)).find((entry) => entry.event === "music.resolved");
    expect(musicLine).toMatchObject({ musicMode: "CUSTOM", musicApplied: false });
    expect(musicLine.musicReason).toMatch(/não reproduz áudio/);
  });
});

describe("Stories (post_type 'story')", () => {
  const storyPost = () =>
    post({ postType: "story", caption: "", items: [{ mediaId: "m1", storageUrl: "https://blob/story.jpg", mediaType: "image", position: 0 }] });

  it("cria o container com createStoryMediaContainer (sem legenda) e publica pelo mesmo media_publish", async () => {
    repo.getPostForPublish.mockResolvedValue(storyPost());
    meta.createStoryMediaContainer.mockResolvedValue("story-c1");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("story-media-1");

    await expect(publishPost("post-1", "user-1")).resolves.toBe("PUBLISHED");

    expect(meta.createStoryMediaContainer).toHaveBeenCalledWith({
      igUserId: "ig-1",
      accessToken: "token-secreto",
      imageUrl: "https://blob/story.jpg",
    });
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
    expect(repo.markPostPublished).toHaveBeenCalledWith("post-1", "story-media-1", expect.any(String));
  });

  it("Story com mídia de vídeo falha na validação sem chamar a Meta", async () => {
    repo.getPostForPublish.mockResolvedValue(
      post({ postType: "story", items: [{ mediaId: "v1", storageUrl: "https://blob/v.mp4", mediaType: "video", position: 0 }] }),
    );
    await expect(publishPost("post-1", "user-1")).rejects.toThrow(/não é uma imagem/);
    expect(meta.createStoryMediaContainer).not.toHaveBeenCalled();
  });

  it("container do Story ainda processando: libera para retomar depois, sem criar outro container", async () => {
    repo.getPostForPublish.mockResolvedValue({ ...storyPost(), metaContainerId: "story-c1" });
    meta.getMediaContainerStatus.mockResolvedValue("IN_PROGRESS");

    const outcome = await publishInstagramPublication("post-1", "user-1", {
      trigger: "scheduler",
      claimed: { post: { ...claimed, postType: "story" as never }, lockToken: "l" },
      pollIntervalMs: 0,
    });

    expect(outcome).toBe("PROCESSING");
    expect(meta.createStoryMediaContainer).not.toHaveBeenCalled();
    expect(repo.releasePostForResume).toHaveBeenCalled();
  });

  it("429/limite da Meta agenda nova tentativa (retry com backoff)", async () => {
    repo.getPostForPublish.mockResolvedValue(storyPost());
    meta.createStoryMediaContainer.mockRejectedValue(new FakeInstagramGraphApiError("x", { error: { code: 4 } }));
    await expect(publishPost("post-1", "user-1")).resolves.toBe("RETRY_SCHEDULED");
    expect(repo.schedulePostRetry).toHaveBeenCalled();
  });

  it("token expirado não fica tentando de novo: falha definitiva pedindo para reconectar a conta", async () => {
    repo.getPostForPublish.mockResolvedValue(storyPost());
    meta.createStoryMediaContainer.mockRejectedValue(
      new FakeInstagramGraphApiError("x", { error: { code: 190, message: "Error validating access token" } }),
    );
    await expect(publishPost("post-1", "user-1")).rejects.toThrow(/precisa ser renovada/);
    expect(repo.schedulePostRetry).not.toHaveBeenCalled();
    expect(repo.markPostFailed).toHaveBeenCalledWith("post-1", expect.stringMatching(/precisa ser renovada/), expect.any(String));
  });
});

describe("carrossel com vídeo (fotos + vídeos)", () => {
  const mixed = () =>
    post({
      postType: "carousel",
      items: [
        { mediaId: "m1", storageUrl: "https://blob/1.jpg", mediaType: "image", position: 0 },
        { mediaId: "m2", storageUrl: "https://blob/2.mp4", mediaType: "video", position: 1 },
      ],
    });
  const run = () =>
    publishInstagramPublication("post-1", "user-1", {
      trigger: "scheduler",
      claimed: { post: { ...claimed, postType: "carousel" }, lockToken: "l" },
      pollIntervalMs: 0,
    });

  it("cria filhos (vídeo com video_url), guarda os ids, espera o vídeo e cria o pai", async () => {
    repo.getPostForPublish.mockResolvedValue(mixed());
    meta.createCarouselItemContainer.mockResolvedValueOnce("child-img").mockResolvedValueOnce("child-vid");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.createCarouselContainer.mockResolvedValue("parent-1");
    meta.publishMediaContainer.mockResolvedValue("media-1");

    await expect(run()).resolves.toBe("PUBLISHED");

    expect(meta.createCarouselItemContainer.mock.calls[0][0]).toMatchObject({ imageUrl: "https://blob/1.jpg" });
    expect(meta.createCarouselItemContainer.mock.calls[1][0]).toMatchObject({ videoUrl: "https://blob/2.mp4" });
    expect(repo.saveCarouselChildren).toHaveBeenCalledWith("post-1", ["child-img", "child-vid"], "l");
    expect(meta.getMediaContainerStatus).toHaveBeenCalledWith(expect.objectContaining({ containerId: "child-vid" }));
    expect(meta.createCarouselContainer).toHaveBeenCalledWith(
      expect.objectContaining({ childrenContainerIds: ["child-img", "child-vid"], caption: "Legenda" }),
    );
    expect(repo.markPostPublished).toHaveBeenCalled();
  });

  it("vídeo ainda processando: não cria o pai e libera o post para retomar", async () => {
    repo.getPostForPublish.mockResolvedValue(mixed());
    meta.createCarouselItemContainer.mockResolvedValueOnce("child-img").mockResolvedValueOnce("child-vid");
    meta.getMediaContainerStatus.mockResolvedValue("IN_PROGRESS");

    await expect(run()).resolves.toBe("PROCESSING");
    expect(meta.createCarouselContainer).not.toHaveBeenCalled();
    expect(meta.publishMediaContainer).not.toHaveBeenCalled();
  });

  it("na retomada reaproveita os filhos guardados, sem recriá-los", async () => {
    repo.getPostForPublish.mockResolvedValue({ ...mixed(), metaChildrenIds: ["child-img", "child-vid"] });
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.createCarouselContainer.mockResolvedValue("parent-1");
    meta.publishMediaContainer.mockResolvedValue("media-1");

    await expect(run()).resolves.toBe("PUBLISHED");
    expect(meta.createCarouselItemContainer).not.toHaveBeenCalled();
    expect(repo.saveCarouselChildren).not.toHaveBeenCalled();
  });

  it("filho de vídeo com ERROR vira FAILED", async () => {
    repo.getPostForPublish.mockResolvedValue({ ...mixed(), metaChildrenIds: ["child-img", "child-vid"] });
    meta.getMediaContainerStatus.mockResolvedValue("ERROR");

    await expect(run()).rejects.toBeInstanceOf(InstagramPublishError);
    expect(repo.markPostFailed).toHaveBeenCalled();
    expect(meta.createCarouselContainer).not.toHaveBeenCalled();
  });
});
