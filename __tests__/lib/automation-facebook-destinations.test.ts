// @vitest-environment node
//
// Piloto Automático + agendador → Instagram E Facebook.
//
// Regressão do problema em produção: as publicações criadas pelo Piloto
// Automático iam só para o Instagram porque nenhum destino Facebook era
// gravado (social_publication_destinations vazio) — o agendador do Facebook
// não tinha o que publicar. Postgres REAL em memória (PGlite, mesmas
// migrações de produção). Só a IA, a renderização e a Meta são simuladas.
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

const fakeProvider = { generatePost: vi.fn(), generateReel: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => fakeProvider,
}));
const fakeRenderArt = vi.fn();
vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: (...args: unknown[]) => fakeRenderArt(...args),
  renderAndStoreAutomationCarousel: vi.fn(),
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
  ...Object.fromEntries(Object.keys(ig).map((key) => [key, (...args: unknown[]) => (ig as Record<string, (...a: unknown[]) => unknown>)[key](...args)])),
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

const repo = await import("@/lib/content-automation/backend/automation-repository");
const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const service = await import("@/lib/content-automation/backend/automation-service");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");
const destService = await import("@/lib/facebook/backend/social-destinations-service");
const postRepo = await import("@/lib/instagram/backend/instagram-post-repository");
const { facebookSchedulerBudget, FACEBOOK_SCHEDULER_BUDGET_MS } = await import("@/lib/facebook/facebook-scheduler-budget");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

/** Quarta 17h em São Paulo = janela de pré-geração de um horário 19:00 com 120 min de antecedência. */
const NOW = () => new Date("2026-09-23T20:00:00.000Z");

async function seedPage(seed: Seed, options: { linked?: boolean; pageId?: string; name?: string; status?: string } = {}) {
  const [row] = await db.sql`
    insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status, instagram_account_id)
    values (${seed.userId}, ${options.pageId ?? "page-1"}, ${options.name ?? "Alilu"}, 'page-token', 'fb-user',
      ${options.status ?? "connected"}, ${options.linked === false ? null : seed.accountId})
    returning id`;
  return row.id as string;
}

async function automation(seed: Seed, options: { contentType?: "POST" | "STORY" | "REEL"; requireApproval?: boolean } = {}) {
  const requireApproval = options.requireApproval ?? false;
  const id = await repo.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Automação",
    description: "",
    timezone: "America/Sao_Paulo",
    brandContext: "Marca",
    autoPublish: !requireApproval,
    requireApproval,
    generationLeadMinutes: 120,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    videoSelection: "FIXED",
    fixedVideoMediaId: seed.videoId,
  });
  await repo.updateAutomationDay(id, seed.userId, "WEDNESDAY" as never, {
    enabled: true,
    contentType: options.contentType ?? "POST",
    prompt: "Fale da promoção",
    publishTime: "19:00",
  });
  await repo.setAutomationStatus(id, seed.userId, "ACTIVE");
  return id;
}

const publicationId = async () => (await db.sql`select publication_id from automation_runs`)[0].publication_id as string;
const destinationsOf = (postId: string) => db.sql`select * from social_publication_destinations where post_id = ${postId}`;
const readPost = async (id: string) => (await db.sql`select * from instagram_posts where id = ${id}`)[0];

async function runSchedulers() {
  await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
  return fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
}

beforeEach(async () => {
  db = await createTestDb();
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(media)]) fn.mockReset();
  fakeProvider.generatePost.mockResolvedValue({
    content: { title: "T", caption: "Legenda do Piloto", hashtags: ["#alilu"], cta: "", visualDescription: "", visualText: "Texto" },
    usage: { provider: "anthropic", model: "claude-test", tokensInput: 1, tokensOutput: 1 },
  });
  fakeProvider.generateReel.mockResolvedValue({
    content: { title: "R", hook: "h", script: "s", caption: "Legenda do Reel", hashtags: [], coverText: "c" },
    usage: { provider: "anthropic", model: "claude-test", tokensInput: 1, tokensOutput: 1 },
  });
  ig.createImageMediaContainer.mockResolvedValue("container-1");
  ig.createStoryMediaContainer.mockResolvedValue("container-story");
  ig.getMediaContainerStatus.mockResolvedValue("FINISHED");
  ig.publishMediaContainer.mockResolvedValue("ig-media-1");
  fb.publishPagePhoto.mockResolvedValue({ photoId: "photo-1", postId: "page-1_post-1" });
  fb.getPagePostPermalink.mockResolvedValue("https://www.facebook.com/alilu/posts/1");
  fb.listRecentPagePosts.mockResolvedValue([]);
  media.prepareFacebookImageUrl.mockImplementation(async ({ storageUrl }: { storageUrl: string }) => storageUrl);
  media.assertReelCompatible.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

describe("Piloto Automático agendado → Instagram + Facebook", () => {
  it("causa raiz: a publicação do Piloto ganha o destino da Página vinculada e o agendador publica nas DUAS redes", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    await automation(seed);

    const [result] = await cron.runContentAutomationCron({ now: NOW });
    expect(result.status).toBe("SCHEDULED");
    const postId = await publicationId();
    const [dest] = await destinationsOf(postId);
    expect(dest).toMatchObject({ platform: "facebook", status: "SCHEDULED", facebook_page_ref: pageRef, external_account_id: "page-1" });

    // Horário chegou (19:00 SP de 23/09 já passou): a MESMA rota do cron publica as duas redes.
    const facebook = await runSchedulers();

    const post = await readPost(postId);
    expect(post.status).toBe("PUBLISHED");
    expect(post.meta_media_id).toBe("ig-media-1");
    expect(facebook).toEqual([expect.objectContaining({ status: "PUBLISHED" })]);
    const [after] = await destinationsOf(postId);
    expect(after.status).toBe("PUBLISHED");
    expect(after.external_publication_id).toBe("page-1_post-1");
    // Mesmo conteúdo do Instagram: mesma mídia e mesma legenda, com o token DA PÁGINA.
    expect(fb.publishPagePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "page-1", pageToken: "plain:page-token", message: post.caption }),
    );
    const attempts = await db.sql`select trigger, outcome from social_publication_attempts`;
    expect(attempts).toEqual([{ trigger: "scheduler", outcome: "success" }]);
  });

  it("sem duplicidade: reprocessar (cron de geração e agendadores de novo) nunca cria outro destino nem outro post", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed);
    await cron.runContentAutomationCron({ now: NOW });
    await cron.runContentAutomationCron({ now: NOW });
    const postId = await publicationId();

    // Mesmo que alguém chame o "anexar" de novo para a mesma publicação.
    const again = await destService.attachAutomaticFacebookDestinations({
      postId,
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      facebookPageIds: null,
    });
    expect(again.created).toBe(0);
    expect(await destinationsOf(postId)).toHaveLength(1);

    await runSchedulers();
    await runSchedulers();
    await runSchedulers();
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
  });

  it("falha no Facebook não prejudica o Instagram e fica registrada separadamente", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed);
    fb.publishPagePhoto.mockRejectedValue(new FakeFacebookGraphApiError("x", { error: { code: 100, message: "bad" } }));
    await cron.runContentAutomationCron({ now: NOW });
    const postId = await publicationId();

    await runSchedulers();

    expect((await readPost(postId)).status).toBe("PUBLISHED");
    const [dest] = await destinationsOf(postId);
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_sanitized).toBeTruthy();
    await runSchedulers();
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
  });

  it("falha ao preparar o Facebook nunca impede a criação/publicação no Instagram", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed);
    vi.spyOn(destService, "attachAutomaticFacebookDestinations").mockRejectedValue(new Error("banco fora"));
    const [result] = await cron.runContentAutomationCron({ now: NOW });
    expect(result.status).toBe("SCHEDULED");
  });
});

describe("respeita os destinos configurados", () => {
  it("automático: Página conectada mas vinculada a OUTRA conta do Instagram não recebe a publicação", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed, { linked: false });
    await automation(seed);
    await cron.runContentAutomationCron({ now: NOW });
    expect(await destinationsOf(await publicationId())).toHaveLength(0);
    await runSchedulers();
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("automático: Página que precisa reconectar é ignorada (o Instagram segue)", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed, { status: "needs_reconnect" });
    await automation(seed);
    await cron.runContentAutomationCron({ now: NOW });
    expect(await destinationsOf(await publicationId())).toHaveLength(0);
  });

  it("desligado ([]): nenhuma publicação no Facebook, mesmo com Página vinculada", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    const id = await automation(seed);
    await service.updateAutomationFacebookPages(id, seed.userId, []);
    await cron.runContentAutomationCron({ now: NOW });
    expect(await destinationsOf(await publicationId())).toHaveLength(0);
  });

  it("Páginas escolhidas: publica na Página marcada, mesmo sem vínculo com a conta", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed, { pageId: "page-linked" });
    const chosen = await seedPage(seed, { linked: false, pageId: "page-2", name: "Outra" });
    const id = await automation(seed);
    await service.updateAutomationFacebookPages(id, seed.userId, [chosen]);
    expect((await service.getAutomationDetails(id, seed.userId)).facebookPageIds).toEqual([chosen]);
    await cron.runContentAutomationCron({ now: NOW });
    const dests = await destinationsOf(await publicationId());
    expect(dests.map((row) => row.external_account_id)).toEqual(["page-2"]);
  });

  it("não aceita Página de outro usuário", async () => {
    const seed = await seedUserWithAccount(db, "1");
    const other = await seedUserWithAccount(db, "2");
    const foreign = await seedPage(other);
    const id = await automation(seed);
    await expect(service.updateAutomationFacebookPages(id, seed.userId, [foreign])).rejects.toThrow(/não foi encontrada/);
    await expect(service.updateAutomationFacebookPages(id, seed.userId, "x")).rejects.toThrow();
  });

  it("Story não vai ao Facebook (formato não suportado pela API)", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    fakeRenderArt.mockResolvedValue(seed.mediaId);
    await automation(seed, { contentType: "STORY" });
    await cron.runContentAutomationCron({ now: NOW });
    expect(await destinationsOf(await publicationId())).toHaveLength(0);
  });

  it("Reel: grava o destino Facebook (publicado pelo fluxo de Reels da Página)", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed, { contentType: "REEL" });
    await cron.runContentAutomationCron({ now: NOW });
    const postId = await publicationId();
    expect((await readPost(postId)).post_type).toBe("reels");
    expect(await destinationsOf(postId)).toHaveLength(1);
  });

  it("carrossel de fotos: aceito; carrossel com vídeo: ignorado", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    const base = { userId: seed.userId, instagramAccountId: seed.accountId, caption: "c", scheduledAtUtc: null, timezone: "America/Sao_Paulo" };
    const photos = await postRepo.createDraftCarouselPost({ ...base, mediaIds: [seed.mediaId, seed.mediaId] });
    const mixed = await postRepo.createDraftCarouselPost({ ...base, mediaIds: [seed.mediaId, seed.videoId] });
    const input = { userId: seed.userId, instagramAccountId: seed.accountId, facebookPageIds: null };
    expect((await destService.attachAutomaticFacebookDestinations({ ...input, postId: photos })).created).toBe(1);
    expect(await destService.attachAutomaticFacebookDestinations({ ...input, postId: mixed })).toEqual({ created: 0, skipped: "unsupported" });
  });
});

describe("modo aprovação e agendamentos existentes", () => {
  it("aguardando aprovação: o Facebook não sai antes; depois de aprovado, publica com o Instagram", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed, { requireApproval: true });
    await cron.runContentAutomationCron({ now: NOW });
    const postId = await publicationId();
    expect((await readPost(postId)).status).toBe("DRAFT");
    expect(await destinationsOf(postId)).toHaveLength(1);

    await runSchedulers();
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
    expect(ig.publishMediaContainer).not.toHaveBeenCalled();

    const [run] = await db.sql`select id from automation_runs`;
    await service.approveAutomationRun(run.id as string, seed.userId);
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect((await destinationsOf(postId))[0].status).toBe("PUBLISHED");
  });

  it("nada retroativo: publicações já criadas sem Facebook continuam só no Instagram", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await automation(seed);
    await service.updateAutomationFacebookPages(id, seed.userId, []);
    await cron.runContentAutomationCron({ now: NOW });
    const postId = await publicationId();

    // A Página é conectada e a automação volta para o modo automático DEPOIS.
    await seedPage(seed);
    await service.updateAutomationFacebookPages(id, seed.userId, null);
    await runSchedulers();

    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(await destinationsOf(postId)).toHaveLength(0);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("automações existentes (coluna nula após a migração) usam o modo automático", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await automation(seed);
    const [row] = await db.sql`select facebook_page_ids from content_automations where id = ${id}`;
    expect(row.facebook_page_ids).toBeNull();
    expect((await service.getAutomationDetails(id, seed.userId)).facebookPageIds).toBeNull();
  });
});

describe("orçamento do Facebook dentro da função do cron", () => {
  it("usa o orçamento padrão quando o Instagram foi rápido e adia (0) quando sobra pouco tempo", () => {
    const start = 1_000_000;
    expect(facebookSchedulerBudget(start, 60_000, start + 2_000)).toBe(FACEBOOK_SCHEDULER_BUDGET_MS);
    expect(facebookSchedulerBudget(start, 60_000, start + 30_000)).toBe(5_000);
    expect(facebookSchedulerBudget(start, 60_000, start + 50_000)).toBe(0);
  });

  it("orçamento 0: o agendador do Facebook não pega nenhum destino (fica para o próximo disparo)", async () => {
    const seed = await seedUserWithAccount(db);
    await seedPage(seed);
    await automation(seed);
    await cron.runContentAutomationCron({ now: NOW });
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
    expect(await fbService.runFacebookScheduler({ timeBudgetMs: 0 })).toEqual([]);
    expect((await destinationsOf(await publicationId()))[0].status).toBe("SCHEDULED");
    await fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
    expect((await destinationsOf(await publicationId()))[0].status).toBe("PUBLISHED");
  });
});
