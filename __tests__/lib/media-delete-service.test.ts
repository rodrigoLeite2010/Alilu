// Testa deleteMediaForUser contra um Postgres REAL em memória (PGlite,
// mesmas migrações de produção) — as checagens de uso (posts/automações)
// dependem de FKs e JOINs reais entre instagram_media, instagram_post_items,
// content_automations e content_automation_days, então mockar getDb() aqui
// esconderia justamente os bugs mais prováveis (nome de coluna errado,
// JOIN errado). Só @vercel/blob é mockado — não queremos rede de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
}));

const fakeDeleteBlob = vi.fn();
vi.mock("@vercel/blob", () => ({
  del: (...args: unknown[]) => fakeDeleteBlob(...args),
}));

const { deleteMediaForUser, MediaDeletionError } = await import("@/lib/content-automation/backend/media-delete-service");
const { createDraftImagePost } = await import("@/lib/instagram/backend/instagram-post-repository");
const repo = await import("@/lib/content-automation/backend/automation-repository");

beforeEach(async () => {
  db = await createTestDb();
  fakeDeleteBlob.mockReset();
  fakeDeleteBlob.mockResolvedValue(undefined);
});

afterEach(async () => {
  await db.close();
});

describe("deleteMediaForUser", () => {
  it("apaga a linha e o arquivo no Blob quando a mídia não está em uso em nada", async () => {
    const seed = await seedUserWithAccount(db);

    await deleteMediaForUser(seed.mediaId, seed.userId);

    const rows = await db.sql`select id from instagram_media where id = ${seed.mediaId}`;
    expect(rows).toHaveLength(0);
    expect(fakeDeleteBlob).toHaveBeenCalledTimes(1);
    expect(fakeDeleteBlob).toHaveBeenCalledWith("https://blob.example.com/1.jpg");
  });

  it("bloqueia (sem apagar nada) quando a mídia já foi usada em uma publicação", async () => {
    const seed = await seedUserWithAccount(db);
    await createDraftImagePost({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      mediaId: seed.mediaId,
      caption: "Legenda de teste",
    });

    await expect(deleteMediaForUser(seed.mediaId, seed.userId)).rejects.toThrow(MediaDeletionError);
    await expect(deleteMediaForUser(seed.mediaId, seed.userId)).rejects.toThrow(/já foi usada em uma publicação/);

    const rows = await db.sql`select id from instagram_media where id = ${seed.mediaId}`;
    expect(rows).toHaveLength(1);
    expect(fakeDeleteBlob).not.toHaveBeenCalled();
  });

  it("bloqueia quando a mídia é a imagem padrão de uma automação, e nomeia a automação no erro", async () => {
    const seed = await seedUserWithAccount(db);
    await repo.createAutomation({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      name: "Promoções de quarta",
      description: "",
      timezone: "America/Sao_Paulo",
      brandContext: "",
      autoPublish: false,
      requireApproval: true,
      generationLeadMinutes: 120,
      imageMode: "FIXED_IMAGE",
      fixedImageMediaId: seed.mediaId,
      videoSelection: "FIXED",
      fixedVideoMediaId: null,
    });

    await expect(deleteMediaForUser(seed.mediaId, seed.userId)).rejects.toThrow(/Promoções de quarta/);

    const rows = await db.sql`select id from instagram_media where id = ${seed.mediaId}`;
    expect(rows).toHaveLength(1);
    expect(fakeDeleteBlob).not.toHaveBeenCalled();
  });

  it("bloqueia quando a mídia é usada como override de um dia específico de uma automação", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await repo.createAutomation({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      name: "Automação com override por dia",
      description: "",
      timezone: "America/Sao_Paulo",
      brandContext: "",
      autoPublish: false,
      requireApproval: true,
      generationLeadMinutes: 120,
      imageMode: "FIXED_IMAGE",
      fixedImageMediaId: seed.mediaId,
      videoSelection: "FIXED",
      fixedVideoMediaId: null,
    });
    // Segunda mídia (do próprio usuário) usada só como override da quarta-feira.
    const [otherMedia] = await db.sql`
      insert into instagram_media (user_id, storage_url, media_type)
      values (${seed.userId}, 'https://blob.example.com/override.jpg', 'image') returning id
    `;
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, {
      imageMediaId: otherMedia.id as string,
    });

    await expect(deleteMediaForUser(otherMedia.id as string, seed.userId)).rejects.toThrow(
      /Automação com override por dia/,
    );
  });

  it("nunca deixa um usuário apagar mídia de outro usuário", async () => {
    const seedA = await seedUserWithAccount(db, "a");
    const seedB = await seedUserWithAccount(db, "b");

    await expect(deleteMediaForUser(seedA.mediaId, seedB.userId)).rejects.toThrow(/não encontrada/i);

    const rows = await db.sql`select id from instagram_media where id = ${seedA.mediaId}`;
    expect(rows).toHaveLength(1);
  });

  it("apaga a linha do banco mesmo se apagar o arquivo no Blob falhar (não deixa lixo visível pro usuário)", async () => {
    const seed = await seedUserWithAccount(db);
    fakeDeleteBlob.mockRejectedValueOnce(new Error("Falha simulada do Blob"));

    await expect(deleteMediaForUser(seed.mediaId, seed.userId)).resolves.toBeUndefined();

    const rows = await db.sql`select id from instagram_media where id = ${seed.mediaId}`;
    expect(rows).toHaveLength(0);
  });
});
