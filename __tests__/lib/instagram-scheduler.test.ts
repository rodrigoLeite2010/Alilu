// @vitest-environment node
//
// Agendador do Instagram ponta a ponta contra um Postgres REAL em memória
// (PGlite, mesmas migrações de produção). Só a Meta e a descriptografia do
// token são simuladas — o SQL de claim/lock/retry é o de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

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
  createImageMediaContainer: (...args: unknown[]) => meta.createImageMediaContainer(...args),
  createCarouselItemContainer: (...args: unknown[]) => meta.createCarouselItemContainer(...args),
  createCarouselContainer: (...args: unknown[]) => meta.createCarouselContainer(...args),
  createReelMediaContainer: (...args: unknown[]) => meta.createReelMediaContainer(...args),
  getMediaContainerStatus: (...args: unknown[]) => meta.getMediaContainerStatus(...args),
  publishMediaContainer: (...args: unknown[]) => meta.publishMediaContainer(...args),
}));

vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: () => "token-em-memoria",
}));

const repo = await import("@/lib/instagram/backend/instagram-post-repository");
const service = await import("@/lib/instagram/backend/instagram-post-service");
const publisher = await import("@/lib/instagram/backend/instagram-publish-service");
const scheduler = await import("@/lib/instagram/backend/instagram-scheduler");

async function makeDuePost(seed: Awaited<ReturnType<typeof seedUserWithAccount>>, overrides: Record<string, unknown> = {}) {
  const postId = await repo.createDraftImagePost({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    mediaId: seed.mediaId,
    caption: "Legenda",
    scheduledAtUtc: new Date(Date.now() + 60_000),
    timezone: "America/Sao_Paulo",
  });
  // "O horário chegou": move o agendamento para o passado.
  await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
  for (const [column, value] of Object.entries(overrides)) {
    await db.pg.query(`update instagram_posts set ${column} = $1 where id = $2`, [value, postId]);
  }
  return postId;
}

async function readPost(postId: string) {
  const [row] = await db.sql`select * from instagram_posts where id = ${postId}`;
  return row;
}

function happyMeta() {
  meta.createImageMediaContainer.mockResolvedValue("container-1");
  meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
  meta.publishMediaContainer.mockResolvedValue("media-123");
}

beforeEach(async () => {
  db = await createTestDb();
  process.env.CRON_SECRET = "segredo-de-teste-com-mais-de-16";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  for (const fn of Object.values(meta)) fn.mockReset();
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("cenário crítico: duas instâncias do scheduler ao mesmo tempo", () => {
  it("publica UMA única vez na Meta", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    happyMeta();

    const [first, second] = await Promise.all([
      scheduler.runInstagramScheduler(),
      scheduler.runInstagramScheduler(),
    ]);

    expect(meta.createImageMediaContainer).toHaveBeenCalledTimes(1);
    expect(meta.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect([...first, ...second]).toEqual([{ postId, status: "PUBLISHED" }]);

    const row = await readPost(postId);
    expect(row.status).toBe("PUBLISHED");
    expect(row.meta_media_id).toBe("media-123");
    expect(row.published_at).not.toBeNull();
    expect(row.processing_lock_token).toBeNull();
  });

  it("scheduler e 'Publicar agora' simultâneos também publicam uma vez só", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    happyMeta();

    const [manual, run] = await Promise.all([
      publisher.publishPost(postId, seed.userId),
      scheduler.runInstagramScheduler(),
    ]);

    expect(meta.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect(["PUBLISHED", "PROCESSING"]).toContain(manual);
    expect(run.length + (manual === "PUBLISHED" ? 1 : 0)).toBeGreaterThanOrEqual(1);
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("uma execução posterior não republica o que já foi publicado", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    happyMeta();

    await scheduler.runInstagramScheduler();
    await scheduler.runInstagramScheduler();
    await expect(publisher.publishPost(postId, seed.userId)).resolves.toBe("PUBLISHED");

    expect(meta.publishMediaContainer).toHaveBeenCalledTimes(1);
  });
});

describe("claim atômico e busca de vencidos", () => {
  it("só pega agendamentos vencidos, nunca futuros, rascunhos ou cancelados", async () => {
    const seed = await seedUserWithAccount(db);
    const due = await makeDuePost(seed);
    const future = await repo.createDraftImagePost({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      mediaId: seed.mediaId,
      caption: "",
      scheduledAtUtc: new Date(Date.now() + 3_600_000),
    });
    await repo.createDraftImagePost({ userId: seed.userId, instagramAccountId: seed.accountId, mediaId: seed.mediaId, caption: "" });
    const cancelled = await makeDuePost(seed);
    await repo.cancelPost(cancelled, seed.userId);

    const claimed = await repo.claimNextDuePost("lock-a", 300);
    expect(claimed?.id).toBe(due);
    expect(await repo.claimNextDuePost("lock-b", 300)).toBeNull();
    expect((await readPost(future)).status).toBe("SCHEDULED");
  });

  it("claim ativo impede outro claim; claim expirado pode ser retomado", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);

    expect(await repo.claimNextDuePost("lock-a", 300)).not.toBeNull();
    expect(await repo.claimNextDuePost("lock-b", 300)).toBeNull();
    expect(await repo.claimPostForManualPublish(postId, seed.userId, "lock-c", 300)).toBeNull();

    await db.sql`update instagram_posts set processing_lock_expires_at = now() - interval '1 second' where id = ${postId}`;
    expect((await repo.claimNextDuePost("lock-d", 300))?.id).toBe(postId);
  });

  it("escritas com lock de outro worker são ignoradas", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    await repo.claimNextDuePost("lock-dono", 300);

    await repo.markPostPublished(postId, "media-x", "lock-intruso");
    expect((await readPost(postId)).status).toBe("PROCESSING");

    await repo.markPostPublished(postId, "media-x", "lock-dono");
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("respeita o backoff (next_attempt_at no futuro não é pego)", async () => {
    const seed = await seedUserWithAccount(db);
    await makeDuePost(seed, { next_attempt_at: new Date(Date.now() + 600_000).toISOString() });
    expect(await repo.claimNextDuePost("lock", 300)).toBeNull();
  });
});

describe("retentativas", () => {
  it("erro temporário da Meta volta para SCHEDULED com backoff de 5 minutos", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    meta.createImageMediaContainer.mockRejectedValue(
      new FakeInstagramGraphApiError("x", { error: { code: 2, is_transient: true } }),
    );

    const [result] = await scheduler.runInstagramScheduler();
    expect(result.status).toBe("RETRY_SCHEDULED");

    const row = await readPost(postId);
    expect(row.status).toBe("SCHEDULED");
    expect(row.attempts_count).toBe(1);
    const delayMin = (new Date(row.next_attempt_at as string).getTime() - Date.now()) / 60_000;
    expect(delayMin).toBeGreaterThan(4.5);
    expect(delayMin).toBeLessThanOrEqual(5.1);
    // Ainda não é hora: a próxima execução não tenta de novo.
    expect(await scheduler.runInstagramScheduler()).toEqual([]);
  });

  it("depois de 3 retentativas vira FAILED", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed, { attempts_count: 3 });
    meta.createImageMediaContainer.mockRejectedValue(new TypeError("fetch failed"));

    const [result] = await scheduler.runInstagramScheduler();
    expect(result.status).toBe("FAILED");
    const row = await readPost(postId);
    expect(row.status).toBe("FAILED");
    expect(row.last_error_sanitized).toMatch(/comunicação/);
  });

  it("erro permanente (token inválido) não é repetido e pede reconexão", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    meta.createImageMediaContainer.mockRejectedValue(
      new FakeInstagramGraphApiError("x", { error: { code: 190, message: "Invalid OAuth access token" } }),
    );

    const [result] = await scheduler.runInstagramScheduler();
    expect(result).toMatchObject({ status: "FAILED", error: "Sua conexão com o Instagram precisa ser renovada." });
    const row = await readPost(postId);
    expect(row.status).toBe("FAILED");
    expect(row.next_attempt_at).toBeNull();
    expect(JSON.stringify(row)).not.toContain("token-em-memoria");
  });

  it("falha depois do container criado retoma o MESMO container (sem duplicar)", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    meta.createImageMediaContainer.mockResolvedValue("container-1");
    meta.getMediaContainerStatus.mockResolvedValueOnce("FINISHED");
    meta.publishMediaContainer.mockRejectedValueOnce(new TypeError("socket hang up"));

    await scheduler.runInstagramScheduler();
    expect((await readPost(postId)).meta_container_id).toBe("container-1");

    // A Meta tinha publicado mesmo assim: o container agora consta PUBLISHED.
    await db.sql`update instagram_posts set next_attempt_at = null where id = ${postId}`;
    meta.getMediaContainerStatus.mockResolvedValueOnce("PUBLISHED");
    const [result] = await scheduler.runInstagramScheduler();

    expect(result.status).toBe("PUBLISHED");
    expect(meta.createImageMediaContainer).toHaveBeenCalledTimes(1);
    expect(meta.publishMediaContainer).toHaveBeenCalledTimes(1);
  });
});

describe("Reels e carrossel pelo scheduler", () => {
  it("Reel ainda processando fica PROCESSING e é retomado depois, só então PUBLISHED", async () => {
    const seed = await seedUserWithAccount(db);
    const reelId = await repo.createDraftReelPost({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      mediaId: seed.videoId,
      caption: "Reel",
      scheduledAtUtc: new Date(Date.now() + 60_000),
    });
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${reelId}`;
    meta.createReelMediaContainer.mockResolvedValue("reel-container");
    meta.getMediaContainerStatus.mockResolvedValue("IN_PROGRESS");

    const lock = "lock-reel";
    const claimed = await repo.claimNextDuePost(lock, 300);
    const outcome = await publisher.publishInstagramPublication(reelId, seed.userId, {
      trigger: "scheduler",
      claimed: { post: claimed!, lockToken: lock },
      pollIntervalMs: 0,
    });
    expect(outcome).toBe("PROCESSING");
    let row = await readPost(reelId);
    expect(row.status).toBe("PROCESSING");
    expect(row.processing_lock_token).toBeNull();
    expect(meta.publishMediaContainer).not.toHaveBeenCalled();

    await db.sql`update instagram_posts set next_attempt_at = now() - interval '1 second' where id = ${reelId}`;
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("reel-media");
    const [result] = await scheduler.runInstagramScheduler();

    expect(result).toEqual({ postId: reelId, status: "PUBLISHED" });
    expect(meta.createReelMediaContainer).toHaveBeenCalledTimes(1);
    row = await readPost(reelId);
    expect(row.status).toBe("PUBLISHED");
    expect(row.meta_media_id).toBe("reel-media");
  });

  it("carrossel agendado usa a mesma camada: filhos + container pai", async () => {
    const seed = await seedUserWithAccount(db);
    const [second] = await db.sql`
      insert into instagram_media (user_id, storage_url, media_type)
      values (${seed.userId}, 'https://blob.example.com/b.jpg', 'image') returning id
    `;
    const postId = await repo.createDraftCarouselPost({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      mediaIds: [seed.mediaId, second.id as string],
      caption: "Carrossel",
      scheduledAtUtc: new Date(Date.now() + 60_000),
    });
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
    meta.createCarouselItemContainer.mockResolvedValueOnce("c1").mockResolvedValueOnce("c2");
    meta.createCarouselContainer.mockResolvedValue("parent");
    meta.getMediaContainerStatus.mockResolvedValue("FINISHED");
    meta.publishMediaContainer.mockResolvedValue("carousel-media");

    const [result] = await scheduler.runInstagramScheduler();
    expect(result.status).toBe("PUBLISHED");
    expect(meta.createCarouselContainer).toHaveBeenCalledWith(
      expect.objectContaining({ childrenContainerIds: ["c1", "c2"] }),
    );
  });
});

describe("cancelamento e edição concorrentes", () => {
  it("publicação cancelada jamais é publicada depois", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    await service.cancelPost(postId, seed.userId);
    happyMeta();

    expect(await scheduler.runInstagramScheduler()).toEqual([]);
    await expect(publisher.publishPost(postId, seed.userId)).rejects.toThrow(/cancelada/);
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
  });

  it("não cancela nem edita enquanto está PROCESSING", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed);
    await repo.claimNextDuePost("lock", 300);

    await expect(service.cancelPost(postId, seed.userId)).rejects.toThrow();
    await expect(service.updatePost({ postId, userId: seed.userId, caption: "nova" })).rejects.toThrow(
      "Esta publicação já está sendo processada.",
    );
  });

  it("edição de agendamento: o scheduler publica a versão nova", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await repo.createDraftImagePost({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      mediaId: seed.mediaId,
      caption: "antiga",
      scheduledAtUtc: new Date(Date.now() + 3_600_000),
    });
    const newTime = new Date(Date.now() + 7_200_000).toISOString();
    await service.updatePost({ postId, userId: seed.userId, caption: "nova legenda", scheduledAt: newTime, timezone: "America/Manaus" });

    let row = await readPost(postId);
    expect(row.status).toBe("SCHEDULED");
    expect(row.caption).toBe("nova legenda");
    expect(new Date(row.scheduled_at_utc as string).toISOString()).toBe(newTime);
    expect(row.timezone_original).toBe("America/Manaus");

    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
    happyMeta();
    await scheduler.runInstagramScheduler();
    expect(meta.createImageMediaContainer).toHaveBeenCalledWith(expect.objectContaining({ caption: "nova legenda" }));
    row = await readPost(postId);
    expect(row.status).toBe("PUBLISHED");
  });

  it("'Tentar novamente' numa publicação FAILED descarta o container antigo e publica", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makeDuePost(seed, { status: "FAILED", meta_container_id: "velho", attempts_count: 4 });
    happyMeta();

    await expect(publisher.publishPost(postId, seed.userId)).resolves.toBe("PUBLISHED");
    expect(meta.createImageMediaContainer).toHaveBeenCalledTimes(1);
  });
});

describe("permissão entre usuários", () => {
  it("usuário B não publica, edita, cancela, lê nem exclui a publicação de A", async () => {
    const a = await seedUserWithAccount(db, "a");
    const b = await seedUserWithAccount(db, "b");
    const postId = await makeDuePost(a);
    happyMeta();

    await expect(publisher.publishPost(postId, b.userId)).rejects.toThrow("Publicação não encontrada.");
    await expect(service.updatePost({ postId, userId: b.userId, caption: "invasão" })).rejects.toThrow();
    await expect(service.cancelPost(postId, b.userId)).rejects.toThrow();
    await expect(service.getPostDetails(postId, b.userId)).rejects.toThrow();
    await expect(service.deletePost(postId, b.userId)).rejects.toThrow();
    await expect(service.reschedulePost(postId, b.userId, new Date(Date.now() + 9e6).toISOString())).rejects.toThrow();

    const row = await readPost(postId);
    expect(row.status).toBe("SCHEDULED");
    expect(row.caption).toBe("Legenda");
    expect(meta.createImageMediaContainer).not.toHaveBeenCalled();
  });

  it("usuário B não usa a mídia de A ao editar", async () => {
    const a = await seedUserWithAccount(db, "a");
    const b = await seedUserWithAccount(db, "b");
    const postId = await repo.createDraftImagePost({ userId: b.userId, instagramAccountId: b.accountId, mediaId: b.mediaId, caption: "" });
    await expect(
      service.updatePost({ postId, userId: b.userId, mediaUrls: ["https://blob.example.com/a.jpg"] }),
    ).rejects.toThrow();
    void a;
  });
});

describe("cenário Post Viral: criar, agendar, navegador fechado, scheduler publica", () => {
  it("fica PUBLISHED sem nenhuma ação do navegador", async () => {
    const seed = await seedUserWithAccount(db);
    const templateData = {
      version: 1,
      state: { templateId: "promocao", backgroundImage: { storageUrl: "https://blob.example.com/foto.jpg", zoom: 1.4, focusXFrac: 0.3 } },
    };
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    const postId = await service.createImagePost({
      userId: seed.userId,
      mediaId: seed.mediaId,
      caption: "Promoção 🚀",
      scheduledAt,
      timezone: "America/Sao_Paulo",
      source: "VIRAL_POST",
      templateId: "promocao",
      templateData,
    });

    const details = await service.getPostDetails(postId, seed.userId);
    expect(details).toMatchObject({ status: "SCHEDULED", source: "VIRAL_POST", templateId: "promocao", templateData });

    // Navegador fechado: daqui em diante só o servidor age.
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
    happyMeta();
    const [result] = await scheduler.runInstagramScheduler();

    expect(result).toEqual({ postId, status: "PUBLISHED" });
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });
});

describe("autorização do endpoint do scheduler", () => {
  it("exige Bearer com o segredo; nunca aceita segredo curto ou ausente", () => {
    const ok = new Request("https://x/api/cron/instagram-publish", {
      headers: { authorization: "Bearer segredo-de-teste-com-mais-de-16" },
    });
    const wrong = new Request("https://x/api/cron/instagram-publish", { headers: { authorization: "Bearer outro-segredo-qualquer-123" } });
    const none = new Request("https://x/api/cron/instagram-publish?secret=segredo-de-teste-com-mais-de-16");
    expect(scheduler.isSchedulerRequestAuthorized(ok)).toBe(true);
    expect(scheduler.isSchedulerRequestAuthorized(wrong)).toBe(false);
    expect(scheduler.isSchedulerRequestAuthorized(none)).toBe(false);

    delete process.env.CRON_SECRET;
    expect(scheduler.isSchedulerRequestAuthorized(ok)).toBe(false);
  });
});
