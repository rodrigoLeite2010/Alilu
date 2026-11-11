// @vitest-environment node
//
// Publicação simultânea Instagram + Facebook ponta a ponta contra um
// Postgres REAL em memória (PGlite, mesmas migrações de produção — inclusive
// a 0053). Só a Meta (Graph API do Instagram e do Facebook) e a cifra dos
// tokens são simuladas: nenhuma publicação real é feita.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));
vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: (value: string) => `plain:${value}`,
  encryptSecret: (value: string) => `enc:${value}`,
}));

class FakeInstagramGraphApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}
const ig = {
  createImageMediaContainer: vi.fn(),
  createCarouselItemContainer: vi.fn(),
  createCarouselContainer: vi.fn(),
  createReelMediaContainer: vi.fn(),
  createStoryMediaContainer: vi.fn(),
  getMediaContainerStatus: vi.fn(),
  publishMediaContainer: vi.fn(),
};
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  GRAPH_API_VERSION: "v25.0",
  InstagramGraphApiError: FakeInstagramGraphApiError,
  createImageMediaContainer: (...args: unknown[]) => ig.createImageMediaContainer(...args),
  createCarouselItemContainer: (...args: unknown[]) => ig.createCarouselItemContainer(...args),
  createCarouselContainer: (...args: unknown[]) => ig.createCarouselContainer(...args),
  createReelMediaContainer: (...args: unknown[]) => ig.createReelMediaContainer(...args),
  createStoryMediaContainer: (...args: unknown[]) => ig.createStoryMediaContainer(...args),
  getMediaContainerStatus: (...args: unknown[]) => ig.getMediaContainerStatus(...args),
  publishMediaContainer: (...args: unknown[]) => ig.publishMediaContainer(...args),
}));

class FakeFacebookGraphApiError extends Error {
  details: unknown;
  unknownOutcome: boolean;
  constructor(message: string, details?: unknown, unknownOutcome = false) {
    super(message);
    this.name = "FacebookGraphApiError";
    this.details = details;
    this.unknownOutcome = unknownOutcome;
  }
}
const fb = {
  publishPagePhoto: vi.fn(),
  uploadUnpublishedPagePhoto: vi.fn(),
  createPageMultiPhotoPost: vi.fn(),
  deletePageObject: vi.fn(),
  listRecentPagePosts: vi.fn(),
  getPagePostPermalink: vi.fn(),
  startPageReelUpload: vi.fn(),
  uploadPageReelFromUrl: vi.fn(),
  finishPageReel: vi.fn(),
  getReelStatus: vi.fn(),
  getReelCopyrightInfo: vi.fn(),
};
vi.mock("@/lib/facebook/backend/facebook-graph-client", () => ({
  FacebookGraphApiError: FakeFacebookGraphApiError,
  ...Object.fromEntries(Object.keys(fb).map((key) => [key, (...args: unknown[]) => (fb as Record<string, (...a: unknown[]) => unknown>)[key](...args)])),
}));
const media = { prepareFacebookImageUrl: vi.fn(), assertReelCompatible: vi.fn() };
vi.mock("@/lib/facebook/backend/facebook-media", () => ({
  prepareFacebookImageUrl: (...args: unknown[]) => media.prepareFacebookImageUrl(...args),
  assertReelCompatible: (...args: unknown[]) => media.assertReelCompatible(...args),
}));

const repo = await import("@/lib/instagram/backend/instagram-post-repository");
const service = await import("@/lib/instagram/backend/instagram-post-service");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");
const destRepo = await import("@/lib/facebook/backend/social-destination-repository");
const destService = await import("@/lib/facebook/backend/social-destinations-service");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

async function seedPage(seed: Seed, overrides: { pageId?: string; name?: string; token?: string | null; status?: string } = {}) {
  const [row] = await db.sql`
    insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status)
    values (${seed.userId}, ${overrides.pageId ?? "page-1"}, ${overrides.name ?? "Alilu"},
      ${overrides.token === undefined ? "page-token" : overrides.token}, 'fb-user', ${overrides.status ?? "connected"})
    returning id`;
  return row.id as string;
}

async function makePost(
  seed: Seed,
  options: { type?: "image" | "carousel" | "reels"; publishToInstagram?: boolean; caption?: string; mediaIds?: string[]; due?: boolean } = {},
) {
  const base = {
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    caption: options.caption ?? "Legenda da campanha",
    scheduledAtUtc: new Date(Date.now() + 60_000),
    timezone: "America/Sao_Paulo",
    publishToInstagram: options.publishToInstagram,
  };
  const type = options.type ?? "image";
  const postId =
    type === "carousel"
      ? await repo.createDraftCarouselPost({ ...base, mediaIds: options.mediaIds ?? [seed.mediaId, seed.mediaId] })
      : type === "reels"
        ? await repo.createDraftReelPost({ ...base, mediaId: seed.videoId })
        : await repo.createDraftImagePost({ ...base, mediaId: seed.mediaId });
  if (options.due !== false) {
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
  }
  return postId;
}

async function addFacebook(postId: string, seed: Seed, pageRef: string, caption: string | null = null) {
  await destService.applyFacebookDestinations(postId, seed.userId, { instagram: true, facebookPageIds: [pageRef], facebookCaption: caption });
  const [dest] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
  return dest.id as string;
}

const readDest = async (id: string) => (await db.sql`select * from social_publication_destinations where id = ${id}`)[0];
const readPost = async (id: string) => (await db.sql`select * from instagram_posts where id = ${id}`)[0];

function happyInstagram() {
  ig.createImageMediaContainer.mockResolvedValue("container-1");
  ig.getMediaContainerStatus.mockResolvedValue("FINISHED");
  ig.publishMediaContainer.mockResolvedValue("ig-media-1");
}

beforeEach(async () => {
  db = await createTestDb();
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(media)]) fn.mockReset();
  media.prepareFacebookImageUrl.mockImplementation(async ({ storageUrl }: { storageUrl: string }) => storageUrl);
  media.assertReelCompatible.mockResolvedValue(undefined);
  fb.getPagePostPermalink.mockResolvedValue("https://www.facebook.com/alilu/posts/1");
  fb.listRecentPagePosts.mockResolvedValue([]);
  fb.deletePageObject.mockResolvedValue(undefined);
});

afterEach(async () => {
  await db.close();
});

describe("compatibilidade com agendamentos antigos", () => {
  it("publicações existentes ficam só no Instagram (publish_to_instagram = true, sem destinos)", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makePost(seed);
    const post = await readPost(postId);
    expect(post.publish_to_instagram).toBe(true);
    const dests = await db.sql`select * from social_publication_destinations`;
    expect(dests).toHaveLength(0);
  });

  it("somente Instagram: o agendador do Instagram publica e o do Facebook não faz nada", async () => {
    const seed = await seedUserWithAccount(db);
    happyInstagram();
    const postId = await makePost(seed);
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    const facebook = await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(facebook).toHaveLength(0);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });
});

describe("Instagram + Facebook na mesma publicação", () => {
  it("publica imagem nas duas redes, cada uma com seu status e id externo", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    happyInstagram();
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "page-1_post-1" });
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);

    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });

    const post = await readPost(postId);
    const dest = await readDest(destId);
    expect(post.status).toBe("PUBLISHED");
    expect(post.meta_media_id).toBe("ig-media-1");
    expect(dest.status).toBe("PUBLISHED");
    expect(dest.external_publication_id).toBe("page-1_post-1");
    expect(dest.external_publication_url).toBe("https://www.facebook.com/alilu/posts/1");
    // Sempre na Página escolhida, com o token DA PÁGINA, e a mesma legenda.
    expect(fb.publishPagePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "page-1", pageToken: "plain:page-token", message: "Legenda da campanha" }),
    );
  });

  it("usa a legenda específica do Facebook quando informada", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "p_1" });
    const postId = await makePost(seed, { publishToInstagram: false });
    await destService.applyFacebookDestinations(postId, seed.userId, { instagram: false, facebookPageIds: [pageRef], facebookCaption: "Só no Face" });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.publishPagePhoto).toHaveBeenCalledWith(expect.objectContaining({ message: "Só no Face" }));
  });

  it("falha de permissão no Facebook não afeta o Instagram publicado e pede reconexão da Página", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    happyInstagram();
    fb.publishPagePhoto.mockRejectedValue(new FakeFacebookGraphApiError("x", { error: { code: 200, message: "perm" } }));
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);

    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });

    expect((await readPost(postId)).status).toBe("PUBLISHED");
    const dest = await readDest(destId);
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_reason).toBe("permission");
    const [page] = await db.sql`select status from facebook_pages where id = ${pageRef}`;
    expect(page.status).toBe("needs_reconnect");

    // Nova rodada do agendador: o Instagram NÃO é publicado de novo.
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
  });

  it("\"Tentar novamente\" reprocessa SOMENTE o Facebook", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    happyInstagram();
    fb.publishPagePhoto.mockRejectedValueOnce(new FakeFacebookGraphApiError("x", { error: { code: 100 } }));
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readDest(destId)).status).toBe("FAILED");

    fb.publishPagePhoto.mockResolvedValueOnce({ photoId: "photo-2", postId: "page-1_post-2" });
    const outcome = await fbService.publishFacebookDestination(destId, seed.userId, { trigger: "retry" });

    expect(outcome).toBe("PUBLISHED");
    expect(ig.createImageMediaContainer).toHaveBeenCalledTimes(1);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("falha no Instagram não impede o Facebook", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    ig.createImageMediaContainer.mockRejectedValue(new FakeInstagramGraphApiError("x", { error: { code: 190 } }));
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "page-1_post-1" });
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readPost(postId)).status).toBe("FAILED");
    expect((await readDest(destId)).status).toBe("PUBLISHED");
  });

  it("token da Página expirado (190) → FAILED com pedido de reconexão, sem nova tentativa automática", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockRejectedValue(new FakeFacebookGraphApiError("x", { error: { code: 190 } }));
    const postId = await makePost(seed, { publishToInstagram: false });
    await destService.applyFacebookDestinations(postId, seed.userId, { instagram: false, facebookPageIds: [pageRef], facebookCaption: null });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const [dest] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_reason).toBe("token");
    expect(dest.next_attempt_at).toBeNull();
    // Publicação "somente Facebook": o status da publicação espelha a falha.
    expect((await readPost(postId)).status).toBe("FAILED");
  });

  it("Página desconectada: falha clara sem chamar a Meta", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    await db.sql`update facebook_pages set page_access_token_encrypted = null, status = 'revoked' where id = ${pageRef}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const dest = await readDest(destId);
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_reason).toBe("page_disconnected");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });
});

describe("somente Facebook", () => {
  it("o agendador do Instagram ignora a publicação; o do Facebook publica", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    happyInstagram();
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "page-1_post-1" });
    const postId = await makePost(seed, { publishToInstagram: false });
    await destService.applyFacebookDestinations(postId, seed.userId, { instagram: false, facebookPageIds: [pageRef], facebookCaption: null });

    const igResults = await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    expect(igResults).toHaveLength(0);
    expect(ig.createImageMediaContainer).not.toHaveBeenCalled();

    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const post = await readPost(postId);
    expect(post.status).toBe("PUBLISHED");
    expect(post.published_at).not.toBeNull();
  });

  it("\"Publicar agora\" do Instagram recusa publicação somente Facebook (claim manual)", async () => {
    const seed = await seedUserWithAccount(db);
    const postId = await makePost(seed, { publishToInstagram: false, due: false });
    const claimed = await repo.claimPostForManualPublish(postId, seed.userId, "lock", 60);
    expect(claimed).toBeNull();
  });
});

describe("agendamento", () => {
  it("só publica no Facebook quando o horário chega; rascunho e cancelado nunca", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "p_1" });
    const future = await makePost(seed, { due: false });
    await addFacebook(future, seed, pageRef);
    expect(await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 })).toHaveLength(0);

    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${future}`;
    await service.cancelPost(future, seed.userId);
    expect(await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 })).toHaveLength(0);
    const [cancelledDest] = await db.sql`select status from social_publication_destinations where post_id = ${future}`;
    expect(cancelledDest.status).toBe("CANCELLED");

    const due = await makePost(seed);
    await addFacebook(due, seed, pageRef);
    const results = await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(results).toEqual([expect.objectContaining({ status: "PUBLISHED" })]);
  });

  it("processa dois agendamentos simultâneos sem pegar o mesmo destino duas vezes", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockImplementation(async () => ({ photoId: `photo-${Math.random()}`, postId: `p_${Math.random()}` }));
    const a = await makePost(seed);
    const b = await makePost(seed);
    await addFacebook(a, seed, pageRef);
    await addFacebook(b, seed, pageRef);

    const [first, second] = await Promise.all([
      destRepo.claimNextDueDestination("lock-a", 60),
      destRepo.claimNextDueDestination("lock-b", 60),
    ]);
    expect(first && second && first.id !== second.id).toBe(true);
    expect(await destRepo.claimNextDueDestination("lock-c", 60)).toBeNull();
  });

  it("claim concorrente do MESMO destino: só um vence (sem publicação duplicada)", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    const [a, b] = await Promise.all([
      destRepo.claimDestinationForManualPublish(destId, seed.userId, "l1", 60),
      destRepo.claimDestinationForManualPublish(destId, seed.userId, "l2", 60),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("editar a publicação com falha no Facebook volta o destino para aguardar o novo horário", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockRejectedValue(new FakeFacebookGraphApiError("x", { error: { code: 100 } }));
    const postId = await makePost(seed, { publishToInstagram: false });
    await destService.applyFacebookDestinations(postId, seed.userId, { instagram: false, facebookPageIds: [pageRef], facebookCaption: null });
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readPost(postId)).status).toBe("FAILED");

    await service.updatePost({ postId, userId: seed.userId, caption: "Nova", scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    const [dest] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
    expect(dest.status).toBe("SCHEDULED");
    expect(dest.release_at).toBeNull();
    expect((await readPost(postId)).status).toBe("SCHEDULED");
    expect(await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 })).toHaveLength(0);
  });
});

describe("idempotência / resultado desconhecido", () => {
  it("timeout no POST: a próxima tentativa encontra o post na Página e NÃO publica de novo", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockRejectedValueOnce(new FakeFacebookGraphApiError("timeout", null, true));
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);

    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    let dest = await readDest(destId);
    expect(dest.status).toBe("SCHEDULED");
    expect(dest.last_error_reason).toBe("unknown_result");
    expect(dest.request_started_at).not.toBeNull();

    fb.listRecentPagePosts.mockResolvedValue([{ id: "page-1_post-9", message: "Legenda da campanha", createdTime: new Date(), permalinkUrl: "https://fb/p9" }]);
    await db.sql`update social_publication_destinations set next_attempt_at = now() - interval '1 second' where id = ${destId}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });

    dest = await readDest(destId);
    expect(dest.status).toBe("PUBLISHED");
    expect(dest.external_publication_id).toBe("page-1_post-9");
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
  });

  it("timeout no POST e post ausente na Página após a carência: envia uma única vez de novo", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockRejectedValueOnce(new FakeFacebookGraphApiError("timeout", null, true));
    fb.publishPagePhoto.mockResolvedValueOnce({ photoId: "photo-2", postId: "page-1_post-2" });
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });

    // Dentro da carência: só consulta, não reenvia.
    await db.sql`update social_publication_destinations set next_attempt_at = now() - interval '1 second' where id = ${destId}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
    expect((await readDest(destId)).status).toBe("PROCESSING");

    await db.sql`update social_publication_destinations set request_started_at = now() - interval '10 minutes', next_attempt_at = now() - interval '1 second' where id = ${destId}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.listRecentPagePosts).toHaveBeenCalled();
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(2);
    expect((await readDest(destId)).status).toBe("PUBLISHED");
  });

  it("destino já publicado nunca é enviado de novo (reexecução do cron / clique duplo)", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "p_1" });
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(await fbService.publishFacebookDestination(destId, seed.userId, { trigger: "retry" })).toBe("PUBLISHED");
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
  });

  it("worker que morreu no meio (lock expirado) é retomado e reconcilia antes de reenviar", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const postId = await makePost(seed);
    const destId = await addFacebook(postId, seed, pageRef);
    // Simula: claim + POST enviado e a função morreu antes de gravar o resultado.
    await db.sql`update social_publication_destinations set status = 'PROCESSING', processing_lock_token = 'morto',
      processing_lock_expires_at = now() - interval '1 second', request_started_at = now() - interval '5 minutes' where id = ${destId}`;
    fb.listRecentPagePosts.mockResolvedValue([{ id: "page-1_post-7", message: "Legenda da campanha", createdTime: new Date(), permalinkUrl: null }]);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readDest(destId)).status).toBe("PUBLISHED");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });
});

describe("carrossel → post com várias fotos", () => {
  it("envia fotos não publicadas na ordem e cria UM post com attached_media", async () => {
    const seed = await seedUserWithAccount(db);
    const [second] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://blob.example.com/2.jpg', 'image') returning id`;
    const pageRef = await seedPage(seed);
    fb.uploadUnpublishedPagePhoto.mockResolvedValueOnce("ph-a").mockResolvedValueOnce("ph-b");
    fb.createPageMultiPhotoPost.mockResolvedValue("page-1_multi");
    const postId = await makePost(seed, { type: "carousel", mediaIds: [seed.mediaId, second.id as string] });
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });

    expect(fb.uploadUnpublishedPagePhoto.mock.calls.map((call) => (call[0] as { imageUrl: string }).imageUrl)).toEqual([
      "https://blob.example.com/1.jpg",
      "https://blob.example.com/2.jpg",
    ]);
    expect(fb.createPageMultiPhotoPost).toHaveBeenCalledWith(expect.objectContaining({ photoIds: ["ph-a", "ph-b"] }));
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
    expect((await readDest(destId)).status).toBe("PUBLISHED");
  });

  it("falha parcial no upload: retoma sem reenviar as fotos já enviadas", async () => {
    const seed = await seedUserWithAccount(db);
    const [second] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://blob.example.com/2.jpg', 'image') returning id`;
    const pageRef = await seedPage(seed);
    fb.uploadUnpublishedPagePhoto.mockResolvedValueOnce("ph-a").mockRejectedValueOnce(new FakeFacebookGraphApiError("x", { error: { code: 2 } }));
    const postId = await makePost(seed, { type: "carousel", mediaIds: [seed.mediaId, second.id as string] });
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readDest(destId)).status).toBe("SCHEDULED");

    fb.uploadUnpublishedPagePhoto.mockResolvedValueOnce("ph-b");
    fb.createPageMultiPhotoPost.mockResolvedValue("page-1_multi");
    await db.sql`update social_publication_destinations set next_attempt_at = now() - interval '1 second' where id = ${destId}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.uploadUnpublishedPagePhoto).toHaveBeenCalledTimes(3);
    expect(fb.createPageMultiPhotoPost).toHaveBeenCalledWith(expect.objectContaining({ photoIds: ["ph-a", "ph-b"] }));
  });

  it("falha definitiva ao criar o post remove as fotos não publicadas (sem órfãs)", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.uploadUnpublishedPagePhoto.mockResolvedValueOnce("ph-a").mockResolvedValueOnce("ph-b");
    fb.createPageMultiPhotoPost.mockRejectedValue(new FakeFacebookGraphApiError("x", { error: { code: 100 } }));
    const postId = await makePost(seed, { type: "carousel" });
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect(fb.deletePageObject).toHaveBeenCalledTimes(2);
    const dest = await readDest(destId);
    expect(dest.status).toBe("FAILED");
    expect(dest.external_children_ids).toBeNull();
    expect(dest.request_started_at).toBeNull();
  });

  it("carrossel com vídeo não pode ir para o Facebook (mensagem clara)", () => {
    expect(() => destService.assertFacebookSupports("carousel", true)).toThrow(/carrossel com vídeo/);
  });
});

describe("Reels", () => {
  it("start → upload → finish, aguarda processamento e só conclui quando a Meta confirma", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.startPageReelUpload.mockResolvedValue("video-1");
    fb.uploadPageReelFromUrl.mockResolvedValue(undefined);
    fb.finishPageReel.mockResolvedValue(undefined);
    fb.getReelStatus
      .mockResolvedValueOnce({ videoStatus: "upload_complete", uploadingStatus: "complete", processingStatus: "not_started", publishingStatus: "not_started", publishStatus: null, errorMessage: null })
      .mockResolvedValueOnce({ videoStatus: "processing", uploadingStatus: "complete", processingStatus: "in_progress", publishingStatus: "not_started", publishStatus: null, errorMessage: null })
      .mockResolvedValueOnce({ videoStatus: "ready", uploadingStatus: "complete", processingStatus: "complete", publishingStatus: "complete", publishStatus: "published", errorMessage: null });
    const postId = await makePost(seed, { type: "reels", publishToInstagram: false });
    await destService.applyFacebookDestinations(postId, seed.userId, { instagram: false, facebookPageIds: [pageRef], facebookCaption: null });

    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const [pending] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
    expect(pending.status).toBe("PROCESSING");
    expect(pending.phase).toBe("finished");
    expect(pending.external_upload_id).toBe("video-1");
    expect((await readPost(postId)).status).toBe("PROCESSING");

    await db.sql`update social_publication_destinations set next_attempt_at = now() - interval '1 second' where post_id = ${postId}`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const [done] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
    expect(done.status).toBe("PUBLISHED");
    expect(done.external_publication_url).toBe("https://www.facebook.com/reel/video-1");
    expect(fb.startPageReelUpload).toHaveBeenCalledTimes(1);
    expect(fb.finishPageReel).toHaveBeenCalledTimes(1);
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("Reel bloqueado por direitos autorais → falha com mensagem específica", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    fb.startPageReelUpload.mockResolvedValue("video-2");
    fb.uploadPageReelFromUrl.mockResolvedValue(undefined);
    fb.finishPageReel.mockResolvedValue(undefined);
    fb.getReelStatus
      .mockResolvedValueOnce({ videoStatus: "processing", uploadingStatus: "complete", processingStatus: "not_started", publishingStatus: "not_started", publishStatus: null, errorMessage: null })
      .mockResolvedValueOnce({ videoStatus: "error", uploadingStatus: "complete", processingStatus: "error", publishingStatus: "not_started", publishStatus: null, errorMessage: "x" });
    fb.getReelCopyrightInfo.mockResolvedValue({ checkComplete: true, matchesFound: true, blocked: true });
    const postId = await makePost(seed, { type: "reels" });
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const dest = await readDest(destId);
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_reason).toBe("copyright");
  });

  it("vídeo incompatível (ex.: mais de 90 s) falha antes de iniciar o upload", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const { FacebookPublishValidationError } = await import("@/lib/facebook/backend/facebook-publish-errors");
    media.assertReelCompatible.mockRejectedValue(new FacebookPublishValidationError("O Facebook só aceita Reels de até 90 segundos.", "media"));
    const postId = await makePost(seed, { type: "reels" });
    const destId = await addFacebook(postId, seed, pageRef);
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await readDest(destId)).status).toBe("FAILED");
    expect(fb.startPageReelUpload).not.toHaveBeenCalled();
  });
});

describe("isolamento entre usuários", () => {
  it("não aceita a Página de outro usuário como destino", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const ownerPage = await seedPage(owner);
    const postId = await makePost(intruder);
    await expect(
      destService.applyFacebookDestinations(postId, intruder.userId, { instagram: true, facebookPageIds: [ownerPage], facebookCaption: null }),
    ).rejects.toThrow(/não foi encontrada/);
  });

  it("um destino nunca usa o token de uma Página de outro usuário, mesmo com referência adulterada", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const ownerPage = await seedPage(owner);
    const postId = await makePost(intruder);
    await db.sql`insert into social_publication_destinations (post_id, user_id, platform, facebook_page_ref, external_account_id)
      values (${postId}, ${intruder.userId}, 'facebook', ${ownerPage}, 'page-1')`;
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    const [dest] = await db.sql`select * from social_publication_destinations where post_id = ${postId}`;
    expect(dest.status).toBe("FAILED");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("Página que precisa reconectar não pode ser escolhida para novo agendamento", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed, { status: "needs_reconnect" });
    await expect(destService.resolveFacebookPages(seed.userId, [pageRef])).rejects.toThrow(/reconectada/);
  });
});
