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
  createDraftCarouselPost,
  createDraftImagePost,
  getPostForPublish,
  markPostProcessing,
  markPostPublished,
  markPostFailed,
  recordPublishAttempt,
  listPostsForUser,
  cancelPost,
  reschedulePost,
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

  it("nasce SCHEDULED quando scheduledAtUtc é informado (em vez de DRAFT)", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]).mockResolvedValueOnce([]);

    await createDraftImagePost({
      userId: "user-1",
      instagramAccountId: "acc-1",
      mediaId: "media-1",
      caption: "Legenda",
      scheduledAtUtc: new Date("2026-12-01T10:00:00.000Z"),
    });

    const [insertCall] = dbMock.mock.calls[0];
    expect(insertCall.join("")).toContain("insert into instagram_posts");
    // Os valores interpolados vêm como argumentos posicionais após o array de strings do template.
    const insertArgs = dbMock.mock.calls[0].slice(1);
    expect(insertArgs).toContain("SCHEDULED");
  });
});

describe("createDraftCarouselPost", () => {
  it("insere o post (post_type carousel) e um item por mídia, na ordem recebida, retornando o id do post", async () => {
    dbMock
      .mockResolvedValueOnce([{ id: "post-1" }]) // insert instagram_posts
      .mockResolvedValueOnce([]) // insert item posição 0
      .mockResolvedValueOnce([]) // insert item posição 1
      .mockResolvedValueOnce([]); // insert item posição 2

    const id = await createDraftCarouselPost({
      userId: "user-1",
      instagramAccountId: "acc-1",
      mediaIds: ["media-1", "media-2", "media-3"],
      caption: "Legenda do carrossel",
    });

    expect(id).toBe("post-1");
    expect(dbMock).toHaveBeenCalledTimes(4); // 1 insert de post + 3 inserts de item

    // 'carousel' vai como texto literal na query (igual a 'image' em
    // createDraftImagePost), não como valor interpolado — só os valores de
    // fato variáveis (userId, instagramAccountId, caption, status,
    // scheduledAtIso) aparecem como argumentos posicionais.
    const [postQueryStrings] = dbMock.mock.calls[0];
    expect((postQueryStrings as string[]).join("")).toContain("'carousel'");
    const postInsertArgs = dbMock.mock.calls[0].slice(1);
    expect(postInsertArgs).toContain("DRAFT");

    // O primeiro item (posição 0) é a capa (is_cover=true); os demais não.
    const firstItemArgs = dbMock.mock.calls[1].slice(1);
    expect(firstItemArgs).toContain("media-1");
    expect(firstItemArgs).toContain(0);
    expect(firstItemArgs).toContain(true);

    const secondItemArgs = dbMock.mock.calls[2].slice(1);
    expect(secondItemArgs).toContain("media-2");
    expect(secondItemArgs).toContain(1);
    expect(secondItemArgs).toContain(false);
  });

  it("nasce SCHEDULED quando scheduledAtUtc é informado", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await createDraftCarouselPost({
      userId: "user-1",
      instagramAccountId: "acc-1",
      mediaIds: ["media-1", "media-2"],
      caption: "Legenda",
      scheduledAtUtc: new Date("2026-12-01T10:00:00.000Z"),
    });

    const postInsertArgs = dbMock.mock.calls[0].slice(1);
    expect(postInsertArgs).toContain("SCHEDULED");
  });
});

describe("getPostForPublish", () => {
  it("retorna null quando não encontra nenhuma linha (post ou itens) do usuário", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await getPostForPublish("post-1", "user-1");
    expect(result).toBeNull();
  });

  it("mapeia UM item (imagem única) para o formato camelCase esperado, com items de tamanho 1", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "post-1",
        post_type: "image",
        status: "DRAFT",
        caption: "Legenda",
        meta_container_id: null,
        ig_user_id: "ig-1",
        access_token_encrypted: "enc-token",
        media_id: "media-1",
        position: 0,
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
      items: [
        { mediaId: "media-1", storageUrl: "https://blob.example.com/img.jpg", mediaType: "image", position: 0 },
      ],
    });
  });

  it("mapeia VÁRIOS itens (carrossel) na ordem retornada pela consulta (já ordenada por posição)", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "post-1",
        post_type: "carousel",
        status: "DRAFT",
        caption: "Legenda",
        meta_container_id: null,
        ig_user_id: "ig-1",
        access_token_encrypted: "enc-token",
        media_id: "media-1",
        position: 0,
        media_storage_url: "https://blob.example.com/slide-01.jpg",
        media_type: "image",
      },
      {
        id: "post-1",
        post_type: "carousel",
        status: "DRAFT",
        caption: "Legenda",
        meta_container_id: null,
        ig_user_id: "ig-1",
        access_token_encrypted: "enc-token",
        media_id: "media-2",
        position: 1,
        media_storage_url: "https://blob.example.com/slide-02.jpg",
        media_type: "image",
      },
    ]);

    const result = await getPostForPublish("post-1", "user-1");

    expect(result?.postType).toBe("carousel");
    expect(result?.items).toEqual([
      { mediaId: "media-1", storageUrl: "https://blob.example.com/slide-01.jpg", mediaType: "image", position: 0 },
      { mediaId: "media-2", storageUrl: "https://blob.example.com/slide-02.jpg", mediaType: "image", position: 1 },
    ]);
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

describe("listPostsForUser", () => {
  it("mapeia as linhas (snake_case) para o formato camelCase esperado pela tela, incluindo postType e itemCount", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "post-1",
        post_type: "carousel",
        status: "SCHEDULED",
        caption: "Legenda",
        scheduled_at_utc: "2026-12-01T10:00:00.000Z",
        published_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
        last_error_sanitized: null,
        ig_username: "alilu.tec",
        media_storage_url: "https://blob.example.com/slide-01.jpg",
        item_count: 4,
      },
    ]);

    const result = await listPostsForUser("user-1");

    expect(result).toEqual([
      {
        id: "post-1",
        postType: "carousel",
        status: "SCHEDULED",
        caption: "Legenda",
        scheduledAtUtc: "2026-12-01T10:00:00.000Z",
        publishedAt: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        lastErrorSanitized: null,
        igUsername: "alilu.tec",
        mediaStorageUrl: "https://blob.example.com/slide-01.jpg",
        itemCount: 4,
      },
    ]);
  });

  it("retorna lista vazia quando o usuário não tem posts", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await listPostsForUser("user-1");
    expect(result).toEqual([]);
  });
});

describe("cancelPost", () => {
  it("retorna true quando o post é cancelado (status cancelável)", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]);
    const result = await cancelPost("post-1", "user-1");
    expect(result).toBe(true);
  });

  it("retorna false quando nenhuma linha é afetada (post inexistente, de outro usuário, ou status não cancelável)", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await cancelPost("post-1", "user-1");
    expect(result).toBe(false);
  });
});

describe("reschedulePost", () => {
  it("retorna true e agenda quando uma data é informada", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]);
    const result = await reschedulePost("post-1", "user-1", new Date("2026-12-01T10:00:00.000Z"));
    expect(result).toBe(true);
  });

  it("retorna true e remove o agendamento quando null é informado", async () => {
    dbMock.mockResolvedValueOnce([{ id: "post-1" }]);
    const result = await reschedulePost("post-1", "user-1", null);
    expect(result).toBe(true);
  });

  it("retorna false quando nenhuma linha é afetada", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await reschedulePost("post-1", "user-1", null);
    expect(result).toBe(false);
  });
});
