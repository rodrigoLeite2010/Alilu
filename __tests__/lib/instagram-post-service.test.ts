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
vi.mock("@/lib/instagram/backend/media-repository", () => ({
  getInstagramMediaById: (...args: unknown[]) => getInstagramMediaByIdMock(...args),
}));

const createDraftImagePostMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => ({
  createDraftImagePost: (...args: unknown[]) => createDraftImagePostMock(...args),
}));

const { InstagramPostValidationError, createImagePost } = await import(
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
