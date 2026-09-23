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
