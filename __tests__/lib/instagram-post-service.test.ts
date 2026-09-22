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
const listPostsForUserInDbMock = vi.fn();
const cancelPostInDbMock = vi.fn();
const reschedulePostInDbMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => ({
  createDraftImagePost: (...args: unknown[]) => createDraftImagePostMock(...args),
  listPostsForUser: (...args: unknown[]) => listPostsForUserInDbMock(...args),
  cancelPost: (...args: unknown[]) => cancelPostInDbMock(...args),
  reschedulePost: (...args: unknown[]) => reschedulePostInDbMock(...args),
}));

const {
  InstagramPostValidationError,
  createImagePost,
  createImagePostFromUpload,
  listPostsForUser,
  cancelPost,
  reschedulePost,
} = await import("@/lib/instagram/backend/instagram-post-service");

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
      scheduledAtUtc: null,
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

describe("createImagePost — validação de agendamento", () => {
  it("lança InstagramPostValidationError para uma data de agendamento inválida", async () => {
    await expect(
      createImagePost({ userId: "user-1", mediaId: "media-1", caption: "Legenda", scheduledAt: "não-é-uma-data" }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  });

  it("lança InstagramPostValidationError para uma data de agendamento no passado", async () => {
    await expect(
      createImagePost({
        userId: "user-1",
        mediaId: "media-1",
        caption: "Legenda",
        scheduledAt: "2020-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(InstagramPostValidationError);
    expect(createDraftImagePostMock).not.toHaveBeenCalled();
  });

  it("cria o post com scheduledAtUtc quando a data é válida e futura", async () => {
    getInstagramAccountForUserMock.mockResolvedValue(account);
    getInstagramMediaByIdMock.mockResolvedValue(imageMedia);
    createDraftImagePostMock.mockResolvedValue("post-1");

    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const id = await createImagePost({
      userId: "user-1",
      mediaId: "media-1",
      caption: "Legenda",
      scheduledAt: futureIso,
    });

    expect(id).toBe("post-1");
    expect(createDraftImagePostMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAtUtc: new Date(futureIso) }),
    );
  });
});

describe("listPostsForUser", () => {
  it("repassa para o repositório", async () => {
    listPostsForUserInDbMock.mockResolvedValue([{ id: "post-1" }]);
    const result = await listPostsForUser("user-1");
    expect(result).toEqual([{ id: "post-1" }]);
    expect(listPostsForUserInDbMock).toHaveBeenCalledWith("user-1");
  });
});

describe("cancelPost", () => {
  it("não lança quando o repositório cancela com sucesso", async () => {
    cancelPostInDbMock.mockResolvedValue(true);
    await expect(cancelPost("post-1", "user-1")).resolves.toBeUndefined();
  });

  it("lança InstagramPostValidationError quando o repositório não cancela nada", async () => {
    cancelPostInDbMock.mockResolvedValue(false);
    await expect(cancelPost("post-1", "user-1")).rejects.toThrow(InstagramPostValidationError);
  });
});

describe("reschedulePost", () => {
  it("lança InstagramPostValidationError para uma nova data inválida", async () => {
    await expect(reschedulePost("post-1", "user-1", "não-é-uma-data")).rejects.toThrow(
      InstagramPostValidationError,
    );
    expect(reschedulePostInDbMock).not.toHaveBeenCalled();
  });

  it("não lança quando o repositório reagenda com sucesso", async () => {
    reschedulePostInDbMock.mockResolvedValue(true);
    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await expect(reschedulePost("post-1", "user-1", futureIso)).resolves.toBeUndefined();
  });

  it("permite remover o agendamento (scheduledAt nulo) sem validar data", async () => {
    reschedulePostInDbMock.mockResolvedValue(true);
    await expect(reschedulePost("post-1", "user-1", null)).resolves.toBeUndefined();
    expect(reschedulePostInDbMock).toHaveBeenCalledWith("post-1", "user-1", null);
  });

  it("lança InstagramPostValidationError quando o repositório não reagenda nada", async () => {
    reschedulePostInDbMock.mockResolvedValue(false);
    await expect(reschedulePost("post-1", "user-1", null)).rejects.toThrow(InstagramPostValidationError);
  });
});
