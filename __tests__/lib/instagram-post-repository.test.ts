// @vitest-environment node
//
// Mocka getDb() (retorna uma função de template tag falsa) para testar as
// consultas sem nenhuma conexão de banco real.
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  getDb: () => dbMock,
}));

const {
  createDraftImagePost,
  getPostForPublish,
  markPostProcessing,
  markPostPublished,
  markPostFailed,
  recordPublishAttempt,
} = await import("@/lib/instagram/backend/instagram-post-repository");

afterEach(() => {
  dbMock.mockReset();
});

describe("createDraftImagePost", () => {
  it("insere o post e o item de mídia (posição 0, capa), retornando o id do post", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]).mockResolvedValueOnce([]);

    const id = await createDraftImagePost({
      userId: "user-1",
      instagramAccountId: "acc-1",
      mediaId: "media-1",
      caption: "Legenda",
    });

    expect(id).toBe("post-1");
    expect(dbMock).toHaveBeenCalledTimes(2);
  });
});

describe("getPostForPublish", () => {
  it("retorna null quando não encontra o post do usuário", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await getPostForPublish("post-1", "user-1");
    expect(result).toBeNull();
  });

  it("mapeia a linha retornada (snake_case do banco) para o formato camelCase esperado", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "post-1",
        post_type: "image",
        status: "DRAFT",
        caption: "Legenda",
        meta_container_id: null,
        ig_user_id: "ig-1",
        access_token_encrypted: "enc-token",
        media_storage_url: "https://blob.example.com/img.jpg",
        media_type: "image",
      },
    ]);

    const result = await getPostForPublish("post-1", "user-1");

    expect(result).toEqual({
      id: "post-1",
      postType: "image",
      status: "DRAFT",
      caption: "Legenda",
      metaContainerId: null,
      igUserId: "ig-1",
      accessTokenEncrypted: "enc-token",
      mediaStorageUrl: "https://blob.example.com/img.jpg",
      mediaType: "image",
    });
  });
});

describe("markPostProcessing / markPostPublished / markPostFailed", () => {
  it("executam sem lançar (o SQL do update é responsabilidade do driver, não testado aqui)", async () => {
    dbMock.mockResolvedValue([]);
    await expect(markPostProcessing("post-1", "container-1")).resolves.toBeUndefined();
    await expect(markPostPublished("post-1", "media-1")).resolves.toBeUndefined();
    await expect(markPostFailed("post-1", "erro sanitizado")).resolves.toBeUndefined();
    expect(dbMock).toHaveBeenCalledTimes(3);
  });
});

describe("recordPublishAttempt", () => {
  it("grava a tentativa, com os campos opcionais ausentes viajando como null", async () => {
    dbMock.mockResolvedValue([]);

    await recordPublishAttempt({ postId: "post-1", outcome: "pending" });

    expect(dbMock).toHaveBeenCalledTimes(1);
  });

  it("grava a tentativa com todos os campos opcionais presentes", async () => {
    dbMock.mockResolvedValue([]);

    await recordPublishAttempt({
      postId: "post-1",
      outcome: "success",
      containerId: "container-1",
      mediaId: "media-1",
    });

    expect(dbMock).toHaveBeenCalledTimes(1);
  });
});
