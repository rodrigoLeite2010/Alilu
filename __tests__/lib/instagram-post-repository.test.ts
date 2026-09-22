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

describe("listPostsForUser", () => {
  it("mapeia as linhas (snake_case) para o formato camelCase esperado pela tela", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "post-1",
        status: "SCHEDULED",
        caption: "Legenda",
        scheduled_at_utc: "2026-12-01T10:00:00.000Z",
        published_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
        last_error_sanitized: null,
        ig_username: "alilu.tec",
        media_storage_url: "https://blob.example.com/img.jpg",
      },
    ]);

    const result = await listPostsForUser("user-1");

    expect(result).toEqual([
      {
        id: "post-1",
        status: "SCHEDULED",
        caption: "Legenda",
        scheduledAtUtc: "2026-12-01T10:00:00.000Z",
        publishedAt: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        lastErrorSanitized: null,
        igUsername: "alilu.tec",
        mediaStorageUrl: "https://blob.example.com/img.jpg",
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
