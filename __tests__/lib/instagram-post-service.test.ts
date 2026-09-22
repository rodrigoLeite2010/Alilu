// @vitest-environment node
//
// Testa a validação de posse (conta/mídia do usuário certo) mockando os
// repositórios — nenhuma chamada de rede ou de banco real.
import { afterEach, describe, expect, it, vi } from "vitest";

const getInstagramAccountForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getInstagramAccountForUserMock(...args),
}));

const getInstagramMediaByIdMock = vi.fn();
const getInstagramMediaByStorageUrlMock = vi.fn();
vi.mock("@/lib/instagram/backend/media-repository", () => ({
  getInstagramMediaById: (...args: unknown[]) => getInstagramMediaByIdMock(...args),
  getInstagramMediaByStorageUrl: (...args: unknown[]) => getInstagramMediaByStorageUrlMock(...args),
}));

const createDraftImagePostMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => ({
  createDraftImagePost: (...args: unknown[]) => createDraftImagePostMock(...args),
}));

const { InstagramPostValidationError, createImagePost, createImagePostFromUpload } = await import(
  "@/lib/instagram/backend/instagram-post-service"
);

afterEach(() => {
  vi.clearAllMocks();
});

const account = { id: "acc-1", userId: "user-1", igUserId: "ig-1", igUsername: "alilu.tec" };
const imageMedia = { id: "media-1", userId: "user-1", storageUrl: "https://blob/img.jpg", mediaType: "image" };

describe("createImagePost", () => {
  it("lança InstagramPostValidationError se o usuário não tem conta conectada", async () => {
    getInstagramAccountForUserMock.mockResolvedValue(null);

    await expect(
      createImagePost({ userId: "user-1", mediaId: "media-1", caption: "Legenda" }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  });

  it("lança InstagramPostValidationError se a mídia não existe (ou não é do usuário)", async () => {
    getInstagramAccountForUserMock.mockResolvedValue(account);
    getInstagramMediaByIdMock.mockResolvedValue(null);

    await expect(
      createImagePost({ userId: "user-1", mediaId: "media-1", caption: "Legenda" }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  });

  it("lança InstagramPostValidationError se a mídia não é imagem", async () => {
    getInstagramAccountForUserMock.mockResolvedValue(account);
    getInstagramMediaByIdMock.mockResolvedValue({ ...imageMedia, mediaType: "video" });

    await expect(
      createImagePost({ userId: "user-1", mediaId: "media-1", caption: "Legenda" }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  });

  it("cria o post quando conta e mídia são válidas, retornando o id gerado", async () => {
    getInstagramAccountForUserMock.mockResolvedValue(account);
    getInstagramMediaByIdMock.mockResolvedValue(imageMedia);
    createDraftImagePostMock.mockResolvedValue("post-1");

    const id = await createImagePost({ userId: "user-1", mediaId: "media-1", caption: "Legenda" });

    expect(id).toBe("post-1");
    expect(getInstagramMediaByIdMock).toHaveBeenCalledWith("media-1", "user-1");
    expect(createDraftImagePostMock).toHaveBeenCalledWith({
      userId: "user-1",
      instagramAccountId: "acc-1",
      mediaId: "media-1",
      caption: "Legenda",
    });
  });
});

describe("createImagePostFromUpload", () => {
  it("resolve a mídia pela URL do blob e cria o post", async () => {
    getInstagramMediaByStorageUrlMock.mockResolvedValue(imageMedia);
    getInstagramAccountForUserMock.mockResolvedValue(account);
    createDraftImagePostMock.mockResolvedValue("post-1");

    const id = await createImagePostFromUpload({
      userId: "user-1",
      mediaUrl: "https://blob/img.jpg",
      caption: "Legenda",
    });

    expect(id).toBe("post-1");
    expect(getInstagramMediaByStorageUrlMock).toHaveBeenCalledWith("https://blob/img.jpg", "user-1");
  });

  it("faz um poll curto se a mídia ainda não apareceu (corrida com o webhook de upload)", async () => {
    getInstagramMediaByStorageUrlMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(imageMedia);
    getInstagramAccountForUserMock.mockResolvedValue(account);
    createDraftImagePostMock.mockResolvedValue("post-1");

    const id = await createImagePostFromUpload({
      userId: "user-1",
      mediaUrl: "https://blob/img.jpg",
      caption: "Legenda",
    });

    expect(id).toBe("post-1");
    expect(getInstagramMediaByStorageUrlMock).toHaveBeenCalledTimes(3);
  }, 10000);

  it("lança InstagramPostValidationError se a mídia nunca aparecer dentro da janela de poll", async () => {
    getInstagramMediaByStorageUrlMock.mockResolvedValue(null);

    await expect(
      createImagePostFromUpload({ userId: "user-1", mediaUrl: "https://blob/img.jpg", caption: "Legenda" }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  }, 10000);
});
