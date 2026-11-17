// @vitest-environment node
//
// Fila de vídeos (Games / GTA 6) ponta a ponta, com Postgres REAL em
// memória (PGlite, mesmas migrações de produção): links → importação →
// distribuição nos horários livres → publicações no agendador EXISTENTE →
// Instagram + Facebook. Só a rede (download, Blob, ffprobe) e a Meta são
// simuladas.
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

// Blob: grava "na memória".
const blob = {
  put: vi.fn(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}`, pathname })),
  del: vi.fn(async () => undefined),
};
vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => (blob.put as (...a: unknown[]) => unknown)(...args),
  del: (...args: unknown[]) => (blob.del as (...a: unknown[]) => unknown)(...args),
  copy: vi.fn(),
  issueSignedToken: vi.fn(),
}));

// Download seguro (rede) e ffprobe.
class FakeSafeDownloadError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "SafeDownloadError";
  }
}
const download = { safeDownload: vi.fn() };
vi.mock("@/lib/instagram-import/backend/safe-download", () => ({
  SafeDownloadError: FakeSafeDownloadError,
  safeDownload: (...args: unknown[]) => download.safeDownload(...args),
}));
class FakeInvalidMediaError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "InvalidMediaError";
  }
}
const probeMock = { probeVideoBuffer: vi.fn() };
vi.mock("@/lib/instagram-import/backend/media-probe", () => ({
  InvalidMediaError: FakeInvalidMediaError,
  probeVideoBuffer: (...args: unknown[]) => probeMock.probeVideoBuffer(...args),
  probeImageBuffer: vi.fn(),
}));
vi.mock("@/lib/video-queue/backend/thumbnail", () => ({
  extractThumbnailJpeg: async () => Buffer.from("jpeg"),
}));

// Importador do Instagram (provedor autorizado): simulado.
class FakeInstagramImportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "InstagramImportError";
  }
}
const igImport = { resolveInstagramLink: vi.fn(), importResolvedMedia: vi.fn() };
vi.mock("@/lib/instagram-import/backend/import-service", () => ({
  IMPORT_VIDEO_CONTENT_TYPES: ["video/mp4", "video/quicktime"],
  InstagramImportError: FakeInstagramImportError,
  resolveInstagramLink: (...args: unknown[]) => igImport.resolveInstagramLink(...args),
  importResolvedMedia: (...args: unknown[]) => igImport.importResolvedMedia(...args),
}));

// Meta (Instagram e Facebook).
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
vi.mock("@/lib/facebook/backend/facebook-media", () => ({
  prepareFacebookImageUrl: async ({ storageUrl }: { storageUrl: string }) => storageUrl,
  assertReelCompatible: async () => undefined,
}));

const service = await import("@/lib/video-queue/backend/queue-service");
const planner = await import("@/lib/video-queue/backend/queue-planner");
const processor = await import("@/lib/video-queue/backend/queue-processor");
const cron = await import("@/lib/video-queue/backend/queue-cron");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

const VERTICAL = { mediaType: "VIDEO", durationSeconds: 30, width: 1080, height: 1920, videoCodec: "h264", hasAudio: true };

async function seedPage(seed: Seed, options: { pageId?: string; name?: string; status?: string } = {}) {
  const [row] = await db.sql`
    insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status, instagram_account_id)
    values (${seed.userId}, ${options.pageId ?? "page-gta"}, ${options.name ?? "GTA 6 BR"}, 'page-token', 'fb-user', ${options.status ?? "connected"}, ${seed.accountId})
    returning id`;
  return row.id as string;
}

async function seedSecondAccount(seed: Seed, suffix: string) {
  const [account] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
    values (${seed.userId}, ${`ig-${suffix}`}, ${`conta_${suffix}`}, 'cifrado') returning id`;
  return account.id as string;
}

function links(count: number, prefix = "video") {
  return Array.from({ length: count }, (_, index) => `https://cdn.exemplo.com/${prefix}${index + 1}.mp4`).join("\n");
}

async function createQueue(seed: Seed, overrides: Record<string, unknown> = {}) {
  const result = await service.createQueue(seed.userId, {
    name: "GTA 6",
    category: "games",
    theme: "gta-6",
    instagramAccountId: seed.accountId,
    publishToInstagram: true,
    facebookPageIds: [],
    schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: "America/Sao_Paulo", minIntervalMinutes: 60 },
    captionTemplate: "{titulo} ({numero}/{total}) #GTA6",
    rightsConfirmed: true,
    links: links(3),
    ...overrides,
  });
  return result;
}

const items = (queueId: string) => db.sql`select * from video_queue_items where queue_id = ${queueId} order by position`;
const livePosts = () => db.sql`select * from instagram_posts where status <> 'CANCELLED' order by scheduled_at_utc`;
const destinations = () => db.sql`select * from social_publication_destinations order by created_at`;

async function importAll() {
  return processor.runQueueImports({ maxItems: 500, maxInFlight: 2, deadline: Date.now() + 60_000 });
}

/** Simula a chegada dos horários e roda o agendador EXISTENTE (mesma rota do cron de publicação). */
async function publishDueNow() {
  await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where status = 'SCHEDULED'`;
  for (let round = 0; round < 3; round += 1) {
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 10_000, limit: 20 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 10_000, limit: 20 });
    await db.sql`update social_publication_destinations set next_attempt_at = null where status in ('SCHEDULED', 'PROCESSING')`;
    await db.sql`update instagram_posts set next_attempt_at = null where status = 'PROCESSING'`;
  }
}

beforeEach(async () => {
  db = await createTestDb();
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(igImport), download.safeDownload, probeMock.probeVideoBuffer, blob.put, blob.del]) {
    fn.mockReset();
  }
  blob.put.mockImplementation(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}`, pathname }));
  download.safeDownload.mockResolvedValue({ buffer: Buffer.alloc(4096, 1), contentType: "video/mp4" });
  probeMock.probeVideoBuffer.mockResolvedValue(VERTICAL);
  ig.createReelMediaContainer.mockImplementation(async () => `container-${Math.random()}`);
  ig.getMediaContainerStatus.mockResolvedValue("FINISHED");
  ig.publishMediaContainer.mockImplementation(async () => `ig-media-${Math.random()}`);
  const finished = new Set<string>();
  fb.startPageReelUpload.mockImplementation(async () => `fb-video-${Math.random()}`);
  fb.uploadPageReelFromUrl.mockResolvedValue(undefined);
  fb.finishPageReel.mockImplementation(async ({ videoId }: { videoId: string }) => {
    finished.add(videoId);
  });
  fb.getReelStatus.mockImplementation(async (videoId: string) =>
    finished.has(videoId)
      ? { videoStatus: "ready", uploadingStatus: "complete", processingStatus: "complete", publishingStatus: "complete", publishStatus: "published", errorMessage: null }
      : { videoStatus: "upload_complete", uploadingStatus: "complete", processingStatus: "not_started", publishingStatus: "not_started", publishStatus: null, errorMessage: null },
  );
  fb.listRecentPagePosts.mockResolvedValue([]);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

describe("importação em lote", () => {
  it("permite que o admin crie e amplie uma fila acima dos limites, mantendo a ordem", async () => {
    const seed = await seedUserWithAccount(db);
    await db.sql`update users set email = 'games-admin@example.com' where id = ${seed.userId}`;
    vi.stubEnv("ADMIN_EMAILS", "games-admin@example.com");
    try {
      const { queueId, links: created } = await createQueue(seed, { links: links(1001) });
      expect(created).toMatchObject({ added: 1001, overLimit: false });
      const appended = await service.addLinks(seed.userId, queueId, { links: links(201, "extra"), authorized: true });
      expect(appended).toMatchObject({ added: 201, overLimit: false });
      const rows = await items(queueId);
      expect(rows).toHaveLength(1202);
      expect(rows[1000].source_url).toBe("https://cdn.exemplo.com/video1001.mp4");
      expect(rows[1001].source_url).toBe("https://cdn.exemplo.com/extra1.mp4");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("prepara para publicação imediata só o vídeo escolhido e reutiliza a publicação", async () => {
    const seed = await seedUserWithAccount(db);
    const page = await seedPage(seed);
    const { queueId } = await createQueue(seed, { facebookPageIds: [page] });
    const [, selected] = await items(queueId);
    const itemId = selected.id as string;
    const postId = await service.prepareItemForImmediatePublish(seed.userId, itemId);
    expect(await service.prepareItemForImmediatePublish(seed.userId, itemId)).toBe(postId);
    expect(download.safeDownload).toHaveBeenCalledTimes(1);
    expect((await items(queueId)).map((item) => item.status)).toEqual(["PENDING", "SCHEDULED", "PENDING"]);
    expect(await livePosts()).toMatchObject([{ id: postId, video_queue_item_id: itemId }]);
    expect(await destinations()).toMatchObject([{ post_id: postId, facebook_page_ref: page }]);
    await publishDueNow();
    await planner.planQueue(queueId);
    expect((await items(queueId))[1].status).toBe("PUBLISHED");
  });

  it("1 link: importa, gera miniatura e fica pronto", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId, links: added } = await createQueue(seed, { links: "https://cdn.exemplo.com/um.mp4" });
    expect(added.added).toBe(1);
    const [result] = await importAll();
    expect(result.status).toBe("READY");
    const [item] = await items(queueId);
    expect(item.status).toBe("READY");
    expect(item.blob_url).toBe(`https://store.public.blob.vercel-storage.com/video-queue/${seed.userId}/${queueId}/${item.id}.mp4`);
    expect(item.thumbnail_url).toContain("-thumb.jpg");
    expect(Number(item.duration_seconds)).toBe(30);
    expect(item.facebook_incompatible_reason).toBeNull();
  });

  it("10 links e 100 links: todos entram na fila; processamento sequencial respeita o lote", async () => {
    const seed = await seedUserWithAccount(db);
    const ten = await createQueue(seed, { links: links(10) });
    expect(ten.links.added).toBe(10);
    const hundred = await createQueue(seed, { name: "GTA 6 – 100", links: links(100, "lote") });
    expect(hundred.links.added).toBe(100);
    // Um lote do cron processa no máximo `maxImports` vídeos, um por vez.
    const firstBatch = await processor.runQueueImports({ maxItems: 3, maxInFlight: 2, deadline: Date.now() + 60_000 });
    expect(firstBatch).toHaveLength(3);
    expect(download.safeDownload).toHaveBeenCalledTimes(3);
    await importAll();
    const [{ n }] = await db.sql`select count(*)::int as n from video_queue_items where status = 'READY'`;
    expect(n).toBe(110);
  });

  it("links duplicados (no texto e na fila) e inválidos são separados", async () => {
    const seed = await seedUserWithAccount(db);
    const text = "https://cdn.exemplo.com/a.mp4\nhttps://cdn.exemplo.com/a.mp4\nhttp://192.168.0.1/x.mp4\nnão-é-link";
    const { queueId, links: result } = await createQueue(seed, { links: text });
    expect(result.added).toBe(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
    const again = await service.addLinks(seed.userId, queueId, { links: "https://cdn.exemplo.com/a.mp4#x", authorized: true });
    expect(again.added).toBe(0);
    expect(again.duplicates).toEqual(["https://cdn.exemplo.com/a.mp4#x"]);
    // Mesmo link em OUTRA fila: entra, mas é sinalizado.
    const other = await createQueue(seed, { name: "Outra", links: "https://cdn.exemplo.com/a.mp4" });
    expect(other.links.inOtherQueues).toEqual(["https://cdn.exemplo.com/a.mp4"]);
  });

  it("exige a declaração de direitos", async () => {
    const seed = await seedUserWithAccount(db);
    await expect(createQueue(seed, { rightsConfirmed: false })).rejects.toThrow(/direitos/);
    const { queueId } = await createQueue(seed);
    await expect(service.addLinks(seed.userId, queueId, { links: links(1, "z") })).rejects.toThrow(/direitos/);
  });

  it("vídeo indisponível = erro; página em vez de arquivo e YouTube/TikTok = aguardando arquivo autorizado", async () => {
    const seed = await seedUserWithAccount(db);
    const text = [
      "https://cdn.exemplo.com/sumiu.mp4",
      "https://site.exemplo.com/pagina-do-video",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.tiktok.com/@gta/video/123",
    ].join("\n");
    download.safeDownload.mockImplementation(async (url: string) => {
      if (url.includes("sumiu")) throw new FakeSafeDownloadError("404", "HTTP_ERROR", 404);
      throw new FakeSafeDownloadError("html", "BAD_CONTENT_TYPE");
    });
    const { queueId } = await createQueue(seed, { links: text });
    const before = await items(queueId);
    expect(before.map((item) => item.status)).toEqual(["PENDING", "PENDING", "WAITING_FILE", "WAITING_FILE"]);
    expect(before[2].status_message).toMatch(/YouTube não permite baixar/);
    expect(before[3].status_message).toMatch(/TikTok/);
    await importAll();
    const after = await items(queueId);
    expect(after[0]).toMatchObject({ status: "ERROR", error_code: "UNAVAILABLE" });
    expect(after[1]).toMatchObject({ status: "WAITING_FILE", error_code: "NOT_A_VIDEO_FILE" });
    // Nada de YouTube/TikTok é baixado.
    expect(download.safeDownload).toHaveBeenCalledTimes(2);
  });

  it("aguardando arquivo: o upload autorizado do usuário é validado e o vídeo fica pronto", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: "https://youtu.be/dQw4w9WgXcQ" });
    const [item] = await items(queueId);
    const uploadUrl = `https://store.public.blob.vercel-storage.com/video-queue/${seed.userId}/uploads/${item.id}-abc.mp4`;
    await expect(service.registerItemUpload(seed.userId, item.id as string, { blobUrl: uploadUrl })).rejects.toThrow(/direitos/);
    await expect(
      service.registerItemUpload(seed.userId, item.id as string, { blobUrl: "https://store.public.blob.vercel-storage.com/video-queue/outro/uploads/x.mp4", authorized: true }),
    ).rejects.toThrow(/própria tela/);
    await service.registerItemUpload(seed.userId, item.id as string, { blobUrl: uploadUrl, authorized: true });
    await importAll();
    const [ready] = await items(queueId);
    expect(ready).toMatchObject({ status: "READY", source_kind: "UPLOAD", blob_url: uploadUrl });
    expect(download.safeDownload).toHaveBeenCalledWith(uploadUrl, expect.anything());
    // O arquivo enviado já está no Blob: não é gravado de novo (só a miniatura).
    expect(blob.put).toHaveBeenCalledTimes(1);
  });

  it("link do Instagram usa o importador existente; sem plano pago, fica aguardando o arquivo", async () => {
    const seed = await seedUserWithAccount(db);
    igImport.resolveInstagramLink.mockResolvedValueOnce({
      record: { id: "00000000-0000-4000-8000-000000000001", status: "READY", resolvedItems: [{ mediaType: "VIDEO", mediaUrl: "https://cdn.provider/x.mp4" }] },
      duplicate: null,
    });
    igImport.importResolvedMedia.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      status: "COMPLETED",
      mediaType: "VIDEO",
      importedFileUrl: "https://store.public.blob.vercel-storage.com/videos/imports/u/abc.mp4",
    });
    igImport.resolveInstagramLink.mockRejectedValueOnce(new FakeInstagramImportError("plano", "PLAN_REQUIRED", 402));
    const { queueId } = await createQueue(seed, { links: "https://www.instagram.com/reel/ABCDEF12345/\nhttps://www.instagram.com/reel/ZZZZZZ99999/" });
    await importAll();
    const [first, second] = await items(queueId);
    expect(igImport.resolveInstagramLink).toHaveBeenCalledWith(seed.userId, expect.objectContaining({ authorized: true }), expect.any(Date), { isAdmin: false });
    expect(first.status).toBe("READY");
    expect(first.blob_url).toContain(`video-queue/${seed.userId}/`); // cópia própria: não depende da limpeza de importações
    expect(second).toMatchObject({ status: "WAITING_FILE", error_code: "PLAN_REQUIRED" });
  });

  it("falha temporária: nova tentativa com espera; esgotou = erro; reprocessar só os erros", async () => {
    const seed = await seedUserWithAccount(db);
    download.safeDownload.mockRejectedValue(new FakeSafeDownloadError("timeout", "TIMEOUT"));
    const { queueId } = await createQueue(seed, { links: links(2) });
    await importAll();
    let rows = await items(queueId);
    expect(rows.map((row) => row.status)).toEqual(["PENDING", "PENDING"]);
    expect(new Date(rows[0].next_attempt_at as string).getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);
    // Segunda e terceira tentativas (simulando o tempo passar).
    for (let round = 0; round < 2; round += 1) {
      await db.sql`update video_queue_items set next_attempt_at = now() - interval '1 second'`;
      await importAll();
    }
    rows = await items(queueId);
    expect(rows.map((row) => row.status)).toEqual(["ERROR", "ERROR"]);
    expect(rows[0].status_message).toMatch(/tentativas esgotadas/);

    download.safeDownload.mockResolvedValue({ buffer: Buffer.alloc(4096, 1), contentType: "video/mp4" });
    expect(await service.retryErrors(seed.userId, queueId, [rows[0].id])).toBe(1);
    await importAll();
    rows = await items(queueId);
    expect(rows.map((row) => row.status)).toEqual(["READY", "ERROR"]);
  });

  it("reinício do worker: item preso com lock expirado é retomado e concluído", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: links(1) });
    await db.sql`
      update video_queue_items set status = 'IMPORTING', processing_lock_token = 'worker-morto',
        processing_lock_expires_at = now() - interval '1 minute', attempts_count = 1
      where queue_id = ${queueId}`;
    const [result] = await importAll();
    expect(result.status).toBe("READY");
    expect((await items(queueId))[0].attempts_count).toBe(2);
  });

  it("dois workers ao mesmo tempo nunca importam o mesmo vídeo", async () => {
    const seed = await seedUserWithAccount(db);
    await createQueue(seed, { links: links(1) });
    const runs = await Promise.all([
      processor.runQueueImports({ maxItems: 1, maxInFlight: 5, deadline: Date.now() + 60_000 }),
      processor.runQueueImports({ maxItems: 1, maxInFlight: 5, deadline: Date.now() + 60_000 }),
    ]);
    expect(runs.flat()).toHaveLength(1);
    expect(download.safeDownload).toHaveBeenCalledTimes(1);
  });
});

describe("programação e publicação automática", () => {
  it("fluxo completo: 20 vídeos, 2 por dia (12h e 19h), Instagram + Página escolhidos; publica e continua até o fim", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const { queueId } = await createQueue(seed, {
      links: links(20),
      facebookPageIds: [pageRef],
      schedule: { publishTimes: ["12:00", "19:00"], postsPerDay: 2, timezone: "America/Sao_Paulo", materializeAheadHours: 720 },
    });

    // Rascunho: nada é agendado antes de ativar, mas a prévia já mostra a programação.
    await importAll();
    expect(await livePosts()).toHaveLength(0);
    const preview = await service.getQueueDashboard(seed.userId, queueId);
    expect(preview.preview).toHaveLength(20);
    expect(preview.preview.every((entry) => entry.projected)).toBe(true);
    const hours = new Set(preview.preview.map((entry) => new Date(entry.at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })));
    expect([...hours].sort()).toEqual(["12:00", "19:00"]);

    await service.applyQueueAction(seed.userId, queueId, "activate");
    const posts = await livePosts();
    expect(posts).toHaveLength(20);
    expect(posts.every((post) => post.source === "VIDEO_QUEUE" && post.post_type === "reels" && post.instagram_account_id === seed.accountId)).toBe(true);
    expect(posts.every((post) => post.music_mode === "NONE")).toBe(true);
    expect(posts[0].caption).toBe("(1/20) #GTA6");
    // Cada horário uma vez só, todos distintos.
    expect(new Set(posts.map((post) => new Date(post.scheduled_at_utc as string).toISOString())).size).toBe(20);
    const dests = await destinations();
    expect(dests).toHaveLength(20);
    expect(dests.every((dest) => dest.facebook_page_ref === pageRef)).toBe(true);

    // Os horários chegam: o agendador EXISTENTE publica nas duas redes.
    await publishDueNow();
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(20);
    expect(fb.finishPageReel).toHaveBeenCalledTimes(20);
    await cron.runVideoQueueCron({ maxImports: 0 });
    const done = await items(queueId);
    expect(done.every((item) => item.status === "PUBLISHED")).toBe(true);
    const dashboard = await service.getQueueDashboard(seed.userId, queueId);
    expect(dashboard.counts).toMatchObject({ total: 20, published: 20, errors: 0, pending: 0 });
  });

  it("respeita agendamentos já existentes da conta (de outros fluxos) e nunca os substitui", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: links(2), schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await importAll();
    const projected = (await service.getQueueDashboard(seed.userId, queueId)).preview.map((entry) => entry.at);
    // Um post manual ocupa exatamente o primeiro horário previsto.
    const [manual] = await db.sql`
      insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status, scheduled_at_utc)
      values (${seed.userId}, ${seed.accountId}, 'image', 'manual', 'SCHEDULED', ${projected[0]}) returning id`;
    await service.applyQueueAction(seed.userId, queueId, "activate");
    const queuePosts = await db.sql`select scheduled_at_utc from instagram_posts where source = 'VIDEO_QUEUE' order by scheduled_at_utc`;
    expect(queuePosts.map((row) => new Date(row.scheduled_at_utc as string).toISOString())).not.toContain(projected[0]);
    const [still] = await db.sql`select status, scheduled_at_utc from instagram_posts where id = ${manual.id}`;
    expect(still.status).toBe("SCHEDULED");
    expect(new Date(still.scheduled_at_utc as string).toISOString()).toBe(projected[0]);
  });

  it("filas com contas diferentes nunca se misturam; outro usuário não acessa a fila", async () => {
    const seed = await seedUserWithAccount(db);
    const techAccount = await seedSecondAccount(seed, "alilu_tech");
    const gtaPage = await seedPage(seed, { pageId: "page-gta", name: "GTA 6 BR" });
    const techPage = await seedPage(seed, { pageId: "page-tech", name: "Alilu Tecnologia" });
    const gta = await createQueue(seed, { links: links(3, "gta"), facebookPageIds: [gtaPage] });
    const tech = await createQueue(seed, { name: "Tecnologia", theme: "outros-jogos", instagramAccountId: techAccount, facebookPageIds: [techPage], links: links(3, "tech") });
    await importAll();
    await service.applyQueueAction(seed.userId, gta.queueId, "activate");
    await service.applyQueueAction(seed.userId, tech.queueId, "activate");

    const rows = await db.sql`
      select p.instagram_account_id, i.queue_id, d.facebook_page_ref
      from instagram_posts p join video_queue_items i on i.id = p.video_queue_item_id
      join social_publication_destinations d on d.post_id = p.id
      where p.status <> 'CANCELLED'`;
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      if (row.queue_id === gta.queueId) expect(row).toMatchObject({ instagram_account_id: seed.accountId, facebook_page_ref: gtaPage });
      else expect(row).toMatchObject({ instagram_account_id: techAccount, facebook_page_ref: techPage });
    }

    const other = await seedUserWithAccount(db, "2");
    await expect(service.getQueueDashboard(other.userId, gta.queueId)).rejects.toThrow(/não encontrada/);
    // Conta/Página de outro usuário não pode ser usada.
    await expect(createQueue(other, { instagramAccountId: seed.accountId })).rejects.toThrow(/não foi encontrada/);
    await expect(createQueue(other, { facebookPageIds: [gtaPage] })).rejects.toThrow(/Página/);
  });

  it("falha só no Facebook: o Instagram publica uma vez e nunca é repetido; cada destino tem status próprio", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const { queueId } = await createQueue(seed, { links: links(1), facebookPageIds: [pageRef] });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    fb.startPageReelUpload.mockRejectedValue(new FakeFacebookGraphApiError("sem permissão", { code: 10 }));
    await publishDueNow();
    await publishDueNow();
    const [post] = await livePosts();
    const [dest] = await destinations();
    expect(post.status).toBe("PUBLISHED");
    expect(dest.status).toBe("FAILED");
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    await cron.runVideoQueueCron({ maxImports: 0 });
    const dashboard = await service.getQueueDashboard(seed.userId, queueId);
    expect(dashboard.items[0].item.status).toBe("SCHEDULED");
    expect(dashboard.counts.errors).toBe(1);
    expect(dashboard.items[0].destinations[0].status).toBe("FAILED");
  });

  it("falha só no Instagram: o Facebook publica normalmente", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    const { queueId } = await createQueue(seed, { links: links(1), facebookPageIds: [pageRef] });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    ig.createReelMediaContainer.mockRejectedValue(new FakeInstagramGraphApiError("mídia inválida", { code: 9004 }));
    await publishDueNow();
    const [post] = await db.sql`select * from instagram_posts where source = 'VIDEO_QUEUE'`;
    const [dest] = await destinations();
    // Instagram não publicou (falha/nova tentativa pelo agendador existente); o Facebook não espera por ele.
    expect(["FAILED", "SCHEDULED"]).toContain(post.status);
    expect(ig.publishMediaContainer).not.toHaveBeenCalled();
    expect(dest.status).toBe("PUBLISHED");
    expect(fb.finishPageReel).toHaveBeenCalledTimes(1);
  });

  it("cron simultâneo e queda no meio do planejamento: nunca duas publicações para o mesmo vídeo", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: links(4), schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await importAll();
    await db.sql`update video_queues set status = 'ACTIVE' where id = ${queueId}`;

    // Queda entre "criar a publicação" e "marcar o item": a publicação existe, o item ainda está PRONTO.
    const [first] = await items(queueId);
    const [media] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, ${first.blob_url}, 'video') returning id`;
    const [orphan] = await db.sql`
      insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status, scheduled_at_utc, source, video_queue_item_id)
      values (${seed.userId}, ${seed.accountId}, 'reels', 'x', 'SCHEDULED', now() + interval '3 days', 'VIDEO_QUEUE', ${first.id}) returning id`;
    await db.sql`insert into instagram_post_items (post_id, media_id, position) values (${orphan.id}, ${media.id}, 0)`;

    const results = await Promise.all([planner.planQueue(queueId), planner.planQueue(queueId), planner.planQueue(queueId)]);
    expect(results.filter(Boolean).length).toBeGreaterThanOrEqual(1);
    const perItem = await db.sql`
      select video_queue_item_id, count(*)::int as n from instagram_posts
      where status <> 'CANCELLED' and video_queue_item_id is not null group by video_queue_item_id`;
    expect(perItem).toHaveLength(4);
    expect(perItem.every((row) => row.n === 1)).toBe(true);
    expect((await items(queueId))[0].post_id).toBe(orphan.id);

    // O índice único do banco impede uma segunda publicação ativa para o mesmo item.
    await expect(db.sql`
      insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status, source, video_queue_item_id)
      values (${seed.userId}, ${seed.accountId}, 'reels', 'dup', 'SCHEDULED', 'VIDEO_QUEUE', ${first.id})`).rejects.toThrow();

    // Dois agendadores do Instagram ao mesmo tempo: cada Reel é publicado uma única vez.
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where status = 'SCHEDULED'`;
    await Promise.all([igScheduler.runInstagramScheduler({ limit: 20 }), igScheduler.runInstagramScheduler({ limit: 20 })]);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(4);
  });

  it("pausar não interrompe o que já foi publicado; retomar reagenda o resto sem duplicar", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: links(5), schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    // O primeiro já foi publicado.
    const [firstItem] = await items(queueId);
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${firstItem.post_id}`;
    await igScheduler.runInstagramScheduler({ limit: 20 });

    await service.applyQueueAction(seed.userId, queueId, "pause");
    let rows = await items(queueId);
    expect(rows[0].status).toBe("SCHEDULED"); // publicado: intocado (o sync marca PUBLISHED)
    expect(rows.slice(1).every((row) => row.status === "READY" && row.post_id === null)).toBe(true);
    const [published] = await db.sql`select status from instagram_posts where id = ${firstItem.post_id}`;
    expect(published.status).toBe("PUBLISHED");
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(0);
    // Pausada: o cron não agenda nada.
    await cron.runVideoQueueCron({ maxImports: 0 });
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(0);
    expect((await items(queueId))[0].status).toBe("PUBLISHED");

    await service.applyQueueAction(seed.userId, queueId, "resume");
    rows = await items(queueId);
    expect(rows.slice(1).every((row) => row.status === "SCHEDULED")).toBe(true);
    const perItem = await db.sql`
      select video_queue_item_id, count(*)::int as n from instagram_posts
      where status <> 'CANCELLED' and video_queue_item_id is not null group by video_queue_item_id`;
    expect(perItem).toHaveLength(5);
    expect(perItem.every((row) => row.n === 1)).toBe(true);
  });

  it("conta desconectada: a fila pausa com o motivo e NUNCA usa outra conta", async () => {
    const seed = await seedUserWithAccount(db);
    await seedSecondAccount(seed, "outra");
    const { queueId } = await createQueue(seed, { links: links(2) });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(2);

    await db.sql`update instagram_accounts set status = 'expired' where id = ${seed.accountId}`;
    await cron.runVideoQueueCron({ maxImports: 0 });
    const [queue] = await db.sql`select status, pause_reason, paused_by_system from video_queues where id = ${queueId}`;
    expect(queue).toMatchObject({ status: "PAUSED", paused_by_system: true });
    expect(queue.pause_reason).toMatch(/@conta1 está desconectada/);
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(0);
    const accounts = await db.sql`select distinct instagram_account_id from instagram_posts`;
    expect(accounts.map((row) => row.instagram_account_id)).toEqual([seed.accountId]);

    // Retomar com a conta ainda desconectada: continua pausada, com o motivo.
    await expect(service.applyQueueAction(seed.userId, queueId, "resume")).rejects.toThrow(/desconectada/);
  });

  it("vídeo incompatível com Reels do Facebook: vai só ao Instagram, com aviso", async () => {
    const seed = await seedUserWithAccount(db);
    const pageRef = await seedPage(seed);
    probeMock.probeVideoBuffer.mockResolvedValue({ ...VERTICAL, durationSeconds: 140 });
    const { queueId } = await createQueue(seed, { links: links(1), facebookPageIds: [pageRef] });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    const [item] = await items(queueId);
    expect(item.status).toBe("SCHEDULED");
    expect(item.facebook_note).toMatch(/90 segundos/);
    expect(await destinations()).toHaveLength(0);
  });

  it("aguardar vídeo não pronto x usar o próximo pronto", async () => {
    const seed = await seedUserWithAccount(db);
    const wait = await createQueue(seed, { links: links(3, "w"), schedule: { notReadyPolicy: "WAIT", publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    const next = await createQueue(seed, { name: "next", links: links(3, "n"), schedule: { notReadyPolicy: "NEXT_READY", publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await importAll();
    // O 1º vídeo de cada fila volta a "importando".
    await db.sql`update video_queue_items set status = 'IMPORTING', processing_lock_token = 't', processing_lock_expires_at = now() + interval '5 minutes' where position = 1`;
    await service.applyQueueAction(seed.userId, wait.queueId, "activate");
    await service.applyQueueAction(seed.userId, next.queueId, "activate");
    expect((await items(wait.queueId)).map((row) => row.status)).toEqual(["IMPORTING", "READY", "READY"]);
    expect((await items(next.queueId)).map((row) => row.status)).toEqual(["IMPORTING", "SCHEDULED", "SCHEDULED"]);
  });

  it("fila vazia e fila recebendo novos links depois de ativada", async () => {
    const seed = await seedUserWithAccount(db);
    const empty = await cron.runVideoQueueCron();
    expect(empty).toEqual({ planned: [], imports: [] });
    const { queueId } = await createQueue(seed, { links: "", schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await service.applyQueueAction(seed.userId, queueId, "activate");
    const quiet = await cron.runVideoQueueCron();
    expect(quiet.imports).toEqual([]);
    expect(await livePosts()).toHaveLength(0);

    await service.addLinks(seed.userId, queueId, { links: links(2, "novo"), authorized: true });
    const result = await cron.runVideoQueueCron({ maxImports: 5 });
    expect(result.imports).toHaveLength(2);
    expect(await livePosts()).toHaveLength(2);
    expect((await items(queueId)).every((row) => row.status === "SCHEDULED")).toBe(true);
  });

  it("alterar horários e reordenar replanejam só o futuro; cancelar e remover item", async () => {
    const seed = await seedUserWithAccount(db);
    const { queueId } = await createQueue(seed, { links: links(3), schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, materializeAheadHours: 720 } });
    await importAll();
    await service.applyQueueAction(seed.userId, queueId, "activate");
    await service.updateSettings(seed.userId, queueId, { schedule: { publishTimes: ["21:30"], postsPerDay: 1 } });
    const posts = await livePosts();
    expect(posts).toHaveLength(3);
    expect(
      posts.every((post) => new Date(post.scheduled_at_utc as string).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) === "21:30"),
    ).toBe(true);

    const rows = await items(queueId);
    await service.reorderQueue(seed.userId, queueId, [rows[2].id, rows[0].id, rows[1].id]);
    const reordered = await db.sql`
      select i.id from video_queue_items i join instagram_posts p on p.id = i.post_id
      where i.queue_id = ${queueId} and p.status <> 'CANCELLED' order by p.scheduled_at_utc`;
    expect(reordered.map((row) => row.id)).toEqual([rows[2].id, rows[0].id, rows[1].id]);

    await service.cancelItem(seed.userId, rows[1].id as string);
    expect((await db.sql`select status from video_queue_items where id = ${rows[1].id}`)[0].status).toBe("CANCELLED");
    expect(await livePosts()).toHaveLength(2);
    await service.removeItem(seed.userId, rows[1].id as string);
    // Continua no histórico (vinculado à publicação cancelada) ou é apagado — nunca publica.
    expect(await livePosts()).toHaveLength(2);
  });
});
