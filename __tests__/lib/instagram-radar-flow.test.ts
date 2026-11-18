// @vitest-environment node
//
// Radar Instagram ponta a ponta com Postgres REAL em memória (PGlite, mesmas
// migrações de produção): radar → links → importador existente → fila
// persistente → planejador (janela/intervalo/limite por conta) → agendador
// EXISTENTE (instagram_posts) → publicador Instagram existente → histórico.
// Só a rede (download, Blob, ffprobe) e a Meta (Instagram e Facebook) são
// simuladas — nenhuma publicação real.
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
  fetchInstagramProfileDetails: vi.fn(),
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

const radarService = await import("@/lib/instagram-radar/backend/radar-service");
const radarAccounts = await import("@/lib/instagram-radar/backend/radar-accounts");
const queueService = await import("@/lib/video-queue/backend/queue-service");
const planner = await import("@/lib/video-queue/backend/queue-planner");
const processor = await import("@/lib/video-queue/backend/queue-processor");
const cron = await import("@/lib/video-queue/backend/queue-cron");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");
const destinationsService = await import("@/lib/facebook/backend/social-destinations-service");
const { utcToZonedInputs } = await import("@/lib/instagram/schedule-time");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;
const SP = "America/Sao_Paulo";
const VERTICAL = { mediaType: "VIDEO", durationSeconds: 30, width: 1080, height: 1920, videoCodec: "h264", hasAudio: true };

async function seedAccount(seed: Seed, suffix: string, status = "connected") {
  const [account] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted, status)
    values (${seed.userId}, ${`ig-${suffix}`}, ${suffix}, ${`token-${suffix}`}, ${status}) returning id`;
  return account.id as string;
}

async function seedPage(seed: Seed, accountId: string) {
  const [row] = await db.sql`
    insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status, instagram_account_id)
    values (${seed.userId}, 'page-pessoal', 'Página', 'page-token', 'fb-user', 'connected', ${accountId}) returning id`;
  return row.id as string;
}

function links(count: number, prefix = "video") {
  return Array.from({ length: count }, (_, index) => `https://cdn.exemplo.com/${prefix}${index + 1}.mp4`).join("\n");
}

async function createRadar(seed: Seed, overrides: Record<string, unknown> = {}) {
  return radarService.createRadar(seed.userId, {
    name: "Radar GTA 6",
    instagramAccountId: seed.accountId,
    schedule: { timezone: SP, postsPerDay: 5, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    captionTemplate: "{titulo}",
    hashtags: "#gta6",
    links: links(3),
    mode: "AUTHORIZED",
    authorized: true,
    ...overrides,
  });
}

const items = (queueId: string) => db.sql`select * from video_queue_items where queue_id = ${queueId} order by position`;
const livePosts = (accountId?: string) =>
  accountId
    ? db.sql`select * from instagram_posts where status <> 'CANCELLED' and instagram_account_id = ${accountId} order by scheduled_at_utc`
    : db.sql`select * from instagram_posts where status <> 'CANCELLED' order by scheduled_at_utc`;

async function importAll() {
  return processor.runQueueImports({ maxItems: 500, maxInFlight: 2, deadline: Date.now() + 60_000 });
}

/** Ativa e materializa a programação de vários dias de uma vez (horizonte longo só no teste). */
async function activate(seed: Seed, radarId: string, horizonHours = 24 * 30) {
  await db.sql`update video_queues set materialize_ahead_hours = ${horizonHours} where id = ${radarId}`;
  await queueService.applyQueueAction(seed.userId, radarId, "activate");
}

async function publishDueNow() {
  await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where status = 'SCHEDULED'`;
  for (let round = 0; round < 3; round += 1) {
    await igScheduler.runInstagramScheduler({ timeBudgetMs: 10_000, limit: 50 });
    await fbService.runFacebookScheduler({ timeBudgetMs: 10_000, limit: 50 });
    await db.sql`update instagram_posts set next_attempt_at = null where status = 'PROCESSING'`;
  }
}

const localParts = (value: unknown, tz = SP) => utcToZonedInputs(new Date(value as string), tz);

function perLocalDay(rows: Array<Record<string, unknown>>, tz = SP): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = localParts(row.scheduled_at_utc, tz).date;
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}

function minGapMinutes(rows: Array<Record<string, unknown>>): number {
  const times = rows.map((row) => new Date(row.scheduled_at_utc as string).getTime()).sort((a, b) => a - b);
  let min = Infinity;
  for (let index = 1; index < times.length; index += 1) min = Math.min(min, (times[index] - times[index - 1]) / 60_000);
  return min;
}

beforeEach(async () => {
  db = await createTestDb();
  radarAccounts.clearRadarProfileCache();
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(igImport), download.safeDownload, probeMock.probeVideoBuffer, blob.put, blob.del]) {
    fn.mockReset();
  }
  blob.put.mockImplementation(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}`, pathname }));
  let fileCounter = 0;
  // Cada download devolve um arquivo diferente (hash diferente), salvo quando o teste quer o mesmo arquivo.
  download.safeDownload.mockImplementation(async () => ({ buffer: Buffer.alloc(4096, (fileCounter += 1) % 250), contentType: "video/mp4" }));
  probeMock.probeVideoBuffer.mockResolvedValue(VERTICAL);
  ig.createReelMediaContainer.mockImplementation(async () => `container-${Math.random()}`);
  ig.getMediaContainerStatus.mockResolvedValue("FINISHED");
  ig.publishMediaContainer.mockImplementation(async () => `ig-media-${Math.random()}`);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

function expectNoFacebookCalls() {
  for (const fn of Object.values(fb)) expect(fn).not.toHaveBeenCalled();
}

describe("criação do radar e seleção de conta", () => {
  it("1. cria o radar em rascunho com a conta escolhida, sem Facebook, e grava o ID da conta", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAccount(seed, "prestador_seguro");
    const { radarId, links: added } = await createRadar(seed);
    expect(added.added).toBe(3);
    const [row] = await db.sql`select * from video_queues where id = ${radarId}`;
    expect(row).toMatchObject({
      kind: "INSTAGRAM_RADAR",
      status: "DRAFT",
      instagram_account_id: seed.accountId,
      publish_to_instagram: true,
      posts_per_day: 5,
      min_interval_minutes: 120,
      window_start: "09:00",
      window_end: "22:00",
      block_duplicate_files: true,
    });
    expect(row.facebook_page_ids).toEqual([]);
    expect(row.publish_times).toEqual(["09:00", "11:00", "13:00", "15:00", "17:00"]);
  });

  it("2. só aceita conta do próprio usuário, conectada e escolhida explicitamente (sem conta padrão)", async () => {
    const seed = await seedUserWithAccount(db);
    const other = await seedUserWithAccount(db, "2");
    await expect(createRadar(seed, { instagramAccountId: undefined })).rejects.toThrow(/Escolha a conta/);
    await expect(createRadar(seed, { instagramAccountId: other.accountId })).rejects.toThrow(/não foi encontrada/);
    const expired = await seedAccount(seed, "expirada", "expired");
    await expect(createRadar(seed, { instagramAccountId: expired })).rejects.toThrow(/desconectada/);
    expect(await db.sql`select id from video_queues`).toHaveLength(0);
  });

  it("2b. seletor: só contas conectadas do usuário, com foto/nome/tipo da Meta e sem token", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAccount(seed, "world_gta");
    await seedAccount(seed, "antiga", "revoked");
    const other = await seedUserWithAccount(db, "2");
    ig.fetchInstagramProfileDetails.mockImplementation(async (token: string) => ({
      userId: "x",
      username: null,
      name: token.includes("world_gta") ? "World GTA" : "Conta 1",
      accountType: "BUSINESS",
      profilePictureUrl: "https://cdn.example.com/p.jpg",
      mediaCount: 1,
      returnedFields: [],
    }));
    const result = await radarAccounts.listRadarAccountOptions(seed.userId);
    expect(result.needsReconnect).toBe(1);
    expect(result.accounts.map((account) => account.username).sort()).toEqual(["conta1", "world_gta"]);
    expect(result.accounts.find((account) => account.username === "world_gta")).toMatchObject({ name: "World GTA", accountType: "BUSINESS", status: "connected" });
    expect(JSON.stringify(result)).not.toMatch(/token|cifrado/);
    expect(result.accounts.some((account) => account.id === other.accountId)).toBe(false);
    // Meta fora do ar: a conta continua listada, sem dados inventados.
    radarAccounts.clearRadarProfileCache();
    ig.fetchInstagramProfileDetails.mockRejectedValue(new Error("down"));
    const fallback = await radarAccounts.listRadarAccountOptions(seed.userId);
    expect(fallback.accounts.every((account) => account.name === null && account.profilePictureUrl === null)).toBe(true);
  });
});

describe("importação por links", () => {
  it("3–5. 1, 10 e 100 links entram na fila persistente e são importados pelo importador existente", async () => {
    const seed = await seedUserWithAccount(db);
    const one = await createRadar(seed, { name: "1", links: "https://cdn.exemplo.com/um.mp4" });
    const ten = await createRadar(seed, { name: "10", links: links(10, "dez") });
    const hundred = await createRadar(seed, { name: "100", links: links(100, "cem") });
    expect([one.links.added, ten.links.added, hundred.links.added]).toEqual([1, 10, 100]);
    // Lote do cron: no máximo `maxImports`, em sequência.
    expect(await processor.runQueueImports({ maxItems: 3, maxInFlight: 2, deadline: Date.now() + 60_000 })).toHaveLength(3);
    await importAll();
    const [{ n }] = await db.sql`select count(*)::int as n from video_queue_items where status = 'READY'`;
    expect(n).toBe(111);
    const [item] = await items(one.radarId);
    expect(item.blob_url).toContain(`video-queue/${seed.userId}/${one.radarId}/`);
  });

  it("6. conteúdo de arquivo TXT: links separados por linha, vírgula e espaço", async () => {
    const seed = await seedUserWithAccount(db);
    const txt = "https://cdn.exemplo.com/a.mp4, https://cdn.exemplo.com/b.mp4 https://cdn.exemplo.com/c.mp4\r\nhttps://cdn.exemplo.com/d.mp4\n\n";
    const { links: added } = await createRadar(seed, { links: txt });
    expect(added.added).toBe(4);
  });

  it("7–8. duplicados (no texto e já na fila) e inválidos são separados", async () => {
    const seed = await seedUserWithAccount(db);
    const text = "https://cdn.exemplo.com/a.mp4\nhttps://cdn.exemplo.com/a.mp4#x\nhttp://127.0.0.1/x.mp4\nftp://exemplo.com/v.mp4\nnão-é-link";
    const { radarId, links: result } = await createRadar(seed, { links: text });
    expect(result.added).toBe(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.rejected).toHaveLength(3);
    const again = await radarService.addRadarLinks(seed.userId, radarId, { links: "https://cdn.exemplo.com/a.mp4", mode: "AUTHORIZED", authorized: true });
    expect(again.added).toBe(0);
    expect(again.duplicates).toEqual(["https://cdn.exemplo.com/a.mp4"]);
  });

  it("9. sem autorização nada é baixado: links ficam 'aguardando arquivo autorizado'", async () => {
    const seed = await seedUserWithAccount(db);
    await expect(createRadar(seed, { authorized: false })).rejects.toThrow(/autoriza/);
    const { radarId, links: added } = await createRadar(seed, {
      mode: "REFERENCE",
      authorized: false,
      links: "https://www.instagram.com/reel/EXEMPLO1/\nhttps://cdn.exemplo.com/x.mp4\nhttps://www.youtube.com/watch?v=abcdefghijk",
    });
    expect(added).toMatchObject({ added: 3, waitingFile: 3 });
    await importAll();
    expect(download.safeDownload).not.toHaveBeenCalled();
    expect(igImport.resolveInstagramLink).not.toHaveBeenCalled();
    const rows = await items(radarId);
    expect(rows.every((row) => row.status === "WAITING_FILE" && row.error_code === "AUTHORIZED_FILE_REQUIRED")).toBe(true);
    // Ativado, nenhum item sem arquivo autorizado é agendado.
    await activate(seed, radarId);
    expect(await livePosts()).toHaveLength(0);
  });

  it("10/34. fila persistente: o cron (sem navegador) importa, agenda e o agendador publica", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(4) });
    await db.sql`update video_queues set materialize_ahead_hours = 720 where id = ${radarId}`;
    await queueService.applyQueueAction(seed.userId, radarId, "activate");
    // Nenhuma tela aberta daqui em diante: só as execuções periódicas.
    await cron.runVideoQueueCron({ maxImports: 10, viralRadar: false });
    expect((await items(radarId)).every((row) => row.status === "SCHEDULED")).toBe(true);
    await publishDueNow();
    await cron.runVideoQueueCron({ maxImports: 0, viralRadar: false });
    expect((await items(radarId)).every((row) => row.status === "PUBLISHED")).toBe(true);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(4);
    expectNoFacebookCalls();
  });
});

describe("limites por dia, intervalos e janela", () => {
  it("11. 1 por dia: no máximo 1 publicação por dia local, sempre às 09h", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(5), schedule: { timezone: SP, postsPerDay: 1, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await activate(seed, radarId);
    const posts = await livePosts();
    expect(posts).toHaveLength(5);
    expect([...perLocalDay(posts).values()].every((count) => count === 1)).toBe(true);
    expect(posts.every((post) => localParts(post.scheduled_at_utc).time === "09:00")).toBe(true);
  });

  it("12. 10 por dia (intervalo 1 h): nunca mais de 10 por dia", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(25), schedule: { timezone: SP, postsPerDay: 10, intervalMinutes: 60, windowStart: "08:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await activate(seed, radarId);
    const posts = await livePosts();
    expect(posts).toHaveLength(25);
    expect(Math.max(...perLocalDay(posts).values())).toBeLessThanOrEqual(10);
    expect(minGapMinutes(posts)).toBeGreaterThanOrEqual(60);
  });

  it("13. limite acima de 10 é recusado no serviço e no próprio banco", async () => {
    const seed = await seedUserWithAccount(db);
    await expect(createRadar(seed, { schedule: { postsPerDay: 11, intervalMinutes: 60, windowStart: "08:00", windowEnd: "22:00" } })).rejects.toThrow(/1 a 10/);
    await expect(createRadar(seed, { schedule: { postsPerDay: 0, intervalMinutes: 60 } })).rejects.toThrow(/1 a 10/);
    await expect(createRadar(seed, { schedule: { postsPerDay: 2.5, intervalMinutes: 60 } })).rejects.toThrow(/1 a 10/);
    const { radarId } = await createRadar(seed);
    await expect(db.sql`update video_queues set posts_per_day = 11 where id = ${radarId}`).rejects.toThrow();
    await expect(radarService.updateRadarSettings(seed.userId, radarId, { schedule: { postsPerDay: 12 } })).rejects.toThrow(/1 a 10/);
  });

  it.each([
    [30, "08:00", "12:00", 6],
    [60, "08:00", "20:00", 6],
    [120, "09:00", "22:00", 5],
    [720, "08:00", "20:00", 2],
  ])("14–17. intervalo de %i min: nenhuma publicação da conta mais próxima que isso", async (interval, start, end, perDay) => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(12), schedule: { timezone: SP, postsPerDay: perDay, intervalMinutes: interval, windowStart: start, windowEnd: end, weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await activate(seed, radarId);
    const posts = await livePosts();
    expect(posts).toHaveLength(12);
    expect(minGapMinutes(posts)).toBeGreaterThanOrEqual(interval);
    expect(Math.max(...perLocalDay(posts).values())).toBeLessThanOrEqual(perDay);
  });

  it("18. horários incompatíveis: mensagem clara com sugestões e nada é gravado", async () => {
    const seed = await seedUserWithAccount(db);
    let error: unknown = null;
    try {
      await createRadar(seed, { schedule: { timezone: SP, postsPerDay: 10, intervalMinutes: 120, windowStart: "08:00", windowEnd: "22:00", weekdays: [1] } });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(radarService.RadarError);
    expect((error as InstanceType<typeof radarService.RadarError>).message).toMatch(/incompatível/);
    expect((error as InstanceType<typeof radarService.RadarError>).suggestions.length).toBeGreaterThan(0);
    expect(await db.sql`select id from video_queues`).toHaveLength(0);
  });

  it("19. fuso horário: radar em Lisboa publica às 10h/12h de Lisboa", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(4), schedule: { timezone: "Europe/Lisbon", postsPerDay: 2, intervalMinutes: 120, windowStart: "10:00", windowEnd: "18:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await activate(seed, radarId);
    const posts = await livePosts();
    expect(posts.map((post) => localParts(post.scheduled_at_utc, "Europe/Lisbon").time).every((time) => time === "10:00" || time === "12:00")).toBe(true);
  });

  it("prévia: conta, links, prontos, horários e estimativa (considera agendamentos existentes)", async () => {
    const seed = await seedUserWithAccount(db);
    const preview = await radarService.previewNewRadar(seed.userId, {
      instagramAccountId: seed.accountId,
      schedule: { timezone: SP, postsPerDay: 3, intervalMinutes: 240, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
      links: links(30),
    });
    expect(preview).toMatchObject({ linksCount: 30, readyCount: 0, accountDailyCap: 3, dailyTimesLabel: "9h, 13h e 17h" });
    expect(preview.nextSlots.length).toBeGreaterThan(0);
    expect(preview.estimatedDaysForAll).toBeGreaterThanOrEqual(10);
    expect(preview.estimatedDaysForAll).toBeLessThanOrEqual(11);
    expect(await db.sql`select id from video_queues`).toHaveLength(0);
  });

  it("regra de revisão: vídeo sem legenda própria só é agendado depois de revisado", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(2), missingCaptionPolicy: "REVIEW" });
    await importAll();
    await activate(seed, radarId);
    expect(await livePosts()).toHaveLength(0);
    const [first] = await items(radarId);
    await queueService.updateItem(seed.userId, first.id as string, { caption: "Legenda revisada sobre o vídeo" });
    await planner.planQueue(radarId);
    const posts = await livePosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].caption).toBe("Legenda revisada sobre o vídeo\n\n#gta6");
  });
});

describe("conta correta, sempre", () => {
  it("20. publica SOMENTE na conta escolhida (ID consistente: radar → fila → agendamento → Meta)", async () => {
    const seed = await seedUserWithAccount(db);
    const worldGta = await seedAccount(seed, "world_gta");
    await seedAccount(seed, "prestador_seguro");
    await seedPage(seed, worldGta);
    const { radarId } = await createRadar(seed, { instagramAccountId: worldGta, links: links(3) });
    await importAll();
    await activate(seed, radarId);
    const posts = await livePosts();
    expect(posts.every((post) => post.instagram_account_id === worldGta && post.source === "VIDEO_QUEUE")).toBe(true);
    await publishDueNow();
    expect(ig.createReelMediaContainer).toHaveBeenCalledTimes(3);
    for (const [input] of ig.createReelMediaContainer.mock.calls) {
      expect(input).toMatchObject({ igUserId: "ig-world_gta", accessToken: "plain:token-world_gta" });
    }
    expect(await db.sql`select id from social_publication_destinations`).toHaveLength(0);
    expectNoFacebookCalls();
  });

  it("21. publicação adulterada para outra conta é bloqueada antes da Meta", async () => {
    const seed = await seedUserWithAccount(db);
    const alilu = await seedAccount(seed, "alilu");
    const { radarId } = await createRadar(seed, { links: links(1) });
    await importAll();
    await activate(seed, radarId);
    const [post] = await livePosts();
    await db.sql`update instagram_posts set instagram_account_id = ${alilu} where id = ${post.id}`;
    await publishDueNow();
    expect(ig.createReelMediaContainer).not.toHaveBeenCalled();
    const [blocked] = await db.sql`select status, last_error_sanitized from instagram_posts where id = ${post.id}`;
    expect(blocked.status).toBe("FAILED");
    expect(blocked.last_error_sanitized).toMatch(/não é a conta escolhida/);
  });

  it("31. Facebook: o radar nunca grava nem publica destino Facebook", async () => {
    const seed = await seedUserWithAccount(db);
    const page = await seedPage(seed, seed.accountId);
    const { radarId } = await createRadar(seed, { links: links(1) });
    await expect(db.sql`update video_queues set facebook_page_ids = ${[page]}::uuid[] where id = ${radarId}`).rejects.toThrow();
    await importAll();
    await activate(seed, radarId);
    const [post] = await livePosts();
    await expect(destinationsService.assertFacebookDestinationsAllowedForPost(post.id as string, seed.userId, [page])).rejects.toThrow(/somente para o Instagram/);
    // Mesmo um destino gravado à força é bloqueado na hora da publicação, sem chamar a Meta.
    await db.sql`
      insert into social_publication_destinations (post_id, user_id, platform, external_account_id, facebook_page_ref, status, selection_source)
      values (${post.id}, ${seed.userId}, 'facebook', 'page-pessoal', ${page}, 'SCHEDULED', 'manual')`;
    await publishDueNow();
    expectNoFacebookCalls();
    const [dest] = await db.sql`select status, last_error_reason from social_publication_destinations`;
    expect(dest).toMatchObject({ status: "CANCELLED", last_error_reason: "unauthorized_destination" });
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
  });

  it("a conta do radar não pode ser trocada; outro usuário não acessa o radar", async () => {
    const seed = await seedUserWithAccount(db);
    const other = await seedAccount(seed, "outra");
    const intruder = await seedUserWithAccount(db, "2");
    const { radarId } = await createRadar(seed);
    await expect(radarService.updateRadarSettings(seed.userId, radarId, { instagramAccountId: other })).rejects.toThrow(/não pode ser trocada/);
    await expect(radarService.getRadarDashboard(intruder.userId, radarId)).rejects.toThrow(/não encontrado/);
    await expect(radarService.addRadarLinks(intruder.userId, radarId, { links: links(1, "x"), mode: "AUTHORIZED", authorized: true })).rejects.toThrow(/não encontrado/);
    await expect(queueService.applyQueueAction(intruder.userId, radarId, "activate")).rejects.toThrow(/não encontrada/);
  });
});

describe("vários radares", () => {
  it("22. dois radares na MESMA conta respeitam o limite combinado e o intervalo da conta", async () => {
    const seed = await seedUserWithAccount(db);
    const a = await createRadar(seed, { name: "A", links: links(15, "a"), schedule: { timezone: SP, postsPerDay: 5, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const b = await createRadar(seed, { name: "B", links: links(15, "b"), schedule: { timezone: SP, postsPerDay: 3, intervalMinutes: 60, windowStart: "10:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await db.sql`update video_queues set materialize_ahead_hours = 720`;
    // Ativações e crons concorrentes.
    await Promise.all([queueService.applyQueueAction(seed.userId, a.radarId, "activate"), queueService.applyQueueAction(seed.userId, b.radarId, "activate")]);
    await Promise.all([cron.runVideoQueueCron({ maxImports: 0, viralRadar: false }), cron.runVideoQueueCron({ maxImports: 0, viralRadar: false })]);
    const posts = await livePosts(seed.accountId);
    expect(posts.length).toBeGreaterThan(10);
    // Teto combinado da conta = menor limite entre os radares ativos (3).
    expect(Math.max(...perLocalDay(posts).values())).toBeLessThanOrEqual(3);
    // Nunca duas publicações da conta a menos de 1 h (o menor intervalo configurado).
    expect(minGapMinutes(posts)).toBeGreaterThanOrEqual(60);
    // Conteúdos não se misturam: cada publicação aponta para um item do seu radar.
    const mixed = await db.sql`
      select p.id from instagram_posts p join video_queue_items i on i.id = p.video_queue_item_id
      join video_queues q on q.id = i.queue_id where q.instagram_account_id <> p.instagram_account_id`;
    expect(mixed).toHaveLength(0);
  });

  it("23. radares em contas diferentes funcionam de forma independente", async () => {
    const seed = await seedUserWithAccount(db);
    const prestador = await seedAccount(seed, "prestador_seguro");
    const gta = await createRadar(seed, { name: "GTA", links: links(10, "g") });
    const ps = await createRadar(seed, { name: "PS", instagramAccountId: prestador, links: links(4, "p"), schedule: { timezone: SP, postsPerDay: 2, intervalMinutes: 240, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    await importAll();
    await activate(seed, gta.radarId);
    await activate(seed, ps.radarId);
    const gtaPosts = await livePosts(seed.accountId);
    const psPosts = await livePosts(prestador);
    expect(gtaPosts).toHaveLength(10);
    expect(psPosts).toHaveLength(4);
    expect(Math.max(...perLocalDay(gtaPosts).values())).toBeLessThanOrEqual(5);
    expect(Math.max(...perLocalDay(psPosts).values())).toBeLessThanOrEqual(2);
    const gtaItems = new Set((await items(gta.radarId)).map((row) => row.id));
    expect(gtaPosts.every((post) => gtaItems.has(post.video_queue_item_id))).toBe(true);
    expect(psPosts.every((post) => !gtaItems.has(post.video_queue_item_id))).toBe(true);
  });
});

describe("operação contínua e falhas", () => {
  it("24/33. pausar impede novas publicações sem apagar histórico; retomar reagenda sem duplicar", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(5) });
    await importAll();
    await activate(seed, radarId);
    const [first] = await items(radarId);
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${first.post_id}`;
    await igScheduler.runInstagramScheduler({ limit: 20 });
    await queueService.applyQueueAction(seed.userId, radarId, "pause");
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(0);
    await cron.runVideoQueueCron({ maxImports: 0, viralRadar: false });
    expect(await db.sql`select id from instagram_posts where status = 'SCHEDULED'`).toHaveLength(0);
    expect((await items(radarId))[0].status).toBe("PUBLISHED");
    const [published] = await db.sql`select status from instagram_posts where id = ${first.post_id}`;
    expect(published.status).toBe("PUBLISHED");
    await queueService.applyQueueAction(seed.userId, radarId, "resume");
    const perItem = await db.sql`select video_queue_item_id, count(*)::int as n from instagram_posts where status <> 'CANCELLED' group by video_queue_item_id`;
    expect(perItem).toHaveLength(5);
    expect(perItem.every((row) => row.n === 1)).toBe(true);
    // Cancelar o radar (arquivar) mantém o que já foi publicado e o histórico.
    await queueService.applyQueueAction(seed.userId, radarId, "archive");
    expect(await db.sql`select id from instagram_posts where status = 'PUBLISHED'`).toHaveLength(1);
    const events = (await db.sql`select event from video_queue_events where queue_id = ${radarId}`).map((row) => row.event);
    expect(events).toEqual(expect.arrayContaining(["created", "links_added", "activated", "paused", "resumed", "archived", "published"]));
  });

  it("25. token expirado: radar pausa com o motivo; erro 190 da Meta falha sem tentar outra conta", async () => {
    const seed = await seedUserWithAccount(db);
    const other = await seedAccount(seed, "outra");
    const { radarId } = await createRadar(seed, { links: links(3) });
    await importAll();
    await activate(seed, radarId);
    // Token recusado pela Meta na publicação.
    ig.createReelMediaContainer.mockRejectedValue(new FakeInstagramGraphApiError("token", { error: { code: 190, message: "expired" } }));
    const [first] = await items(radarId);
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${first.post_id}`;
    await igScheduler.runInstagramScheduler({ limit: 20 });
    const [failed] = await db.sql`select status, instagram_account_id from instagram_posts where id = ${first.post_id}`;
    expect(failed).toMatchObject({ status: "FAILED", instagram_account_id: seed.accountId });
    // Conta marcada como expirada: o cron pausa o radar e desfaz o futuro.
    await db.sql`update instagram_accounts set status = 'expired' where id = ${seed.accountId}`;
    await cron.runVideoQueueCron({ maxImports: 0, viralRadar: false });
    const [radar] = await db.sql`select status, paused_by_system, pause_reason from video_queues where id = ${radarId}`;
    expect(radar).toMatchObject({ status: "PAUSED", paused_by_system: true });
    expect(radar.pause_reason).toMatch(/desconectada/);
    expect(await db.sql`select id from instagram_posts where instagram_account_id = ${other}`).toHaveLength(0);
  });

  it("26. falha de um vídeo não para a fila: o próximo vídeo pronto segue", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: "https://cdn.exemplo.com/quebrado.mp4\n" + links(2) });
    probeMock.probeVideoBuffer.mockRejectedValueOnce(new FakeInvalidMediaError("arquivo inválido", "INVALID_MEDIA"));
    await importAll();
    await activate(seed, radarId);
    const rows = await items(radarId);
    expect(rows[0].status).toBe("ERROR");
    expect(rows.slice(1).every((row) => row.status === "SCHEDULED")).toBe(true);
    // Falha na Meta para um post: os outros publicam.
    ig.createReelMediaContainer.mockRejectedValueOnce(new FakeInstagramGraphApiError("mídia inválida", { error: { code: 9004 } }));
    await publishDueNow();
    const statuses = (await db.sql`select status from instagram_posts order by scheduled_at_utc`).map((row) => row.status);
    expect(statuses).toContain("PUBLISHED");
  });

  it("27. retentativa segura: container retomado, Reel publicado uma única vez", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(1) });
    await importAll();
    await activate(seed, radarId);
    ig.createReelMediaContainer.mockResolvedValue("container-unico");
    ig.getMediaContainerStatus.mockResolvedValueOnce("IN_PROGRESS").mockResolvedValue("FINISHED");
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where status = 'SCHEDULED'`;
    await igScheduler.runInstagramScheduler({ limit: 20, pollIntervalMs: 0 } as never);
    await db.sql`update instagram_posts set next_attempt_at = null where status = 'PROCESSING'`;
    await igScheduler.runInstagramScheduler({ limit: 20, pollIntervalMs: 0 } as never);
    await db.sql`update instagram_posts set next_attempt_at = null where status = 'PROCESSING'`;
    await igScheduler.runInstagramScheduler({ limit: 20, pollIntervalMs: 0 } as never);
    expect(ig.createReelMediaContainer).toHaveBeenCalledTimes(1);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    const [post] = await livePosts();
    expect(post.status).toBe("PUBLISHED");
  });

  it("28. cron executado simultaneamente: uma publicação por vídeo e cada Reel publicado uma vez", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { links: links(6) });
    await db.sql`update video_queues set materialize_ahead_hours = 720 where id = ${radarId}`;
    await queueService.applyQueueAction(seed.userId, radarId, "activate");
    await Promise.all([
      cron.runVideoQueueCron({ maxImports: 10, viralRadar: false }),
      cron.runVideoQueueCron({ maxImports: 10, viralRadar: false }),
      cron.runVideoQueueCron({ maxImports: 10, viralRadar: false }),
    ]);
    await cron.runVideoQueueCron({ maxImports: 10, viralRadar: false });
    const perItem = await db.sql`select video_queue_item_id, count(*)::int as n from instagram_posts where status <> 'CANCELLED' group by video_queue_item_id`;
    expect(perItem).toHaveLength(6);
    expect(perItem.every((row) => row.n === 1)).toBe(true);
    await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where status = 'SCHEDULED'`;
    await Promise.all([igScheduler.runInstagramScheduler({ limit: 20 }), igScheduler.runInstagramScheduler({ limit: 20 })]);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(6);
  });

  it("29. duplicidade: mesmo link já usado na conta por outro radar e mesmo arquivo (hash) não vão de novo", async () => {
    const seed = await seedUserWithAccount(db);
    const prestador = await seedAccount(seed, "prestador_seguro");
    const first = await createRadar(seed, { name: "A", links: "https://cdn.exemplo.com/igual.mp4" });
    const second = await createRadar(seed, { name: "B", links: "https://cdn.exemplo.com/igual.mp4\nhttps://cdn.exemplo.com/novo.mp4" });
    expect(second.links.alreadyOnAccount).toEqual(["https://cdn.exemplo.com/igual.mp4"]);
    expect(second.links.added).toBe(1);
    // Outra conta pode usar o mesmo link.
    const third = await createRadar(seed, { name: "C", instagramAccountId: prestador, links: "https://cdn.exemplo.com/igual.mp4" });
    expect(third.links.added).toBe(1);
    // Mesmo arquivo com URL diferente, mesma conta: bloqueado pelo hash.
    download.safeDownload.mockResolvedValue({ buffer: Buffer.alloc(4096, 7), contentType: "video/mp4" });
    await importAll();
    const sameAccount = await db.sql`
      select i.status from video_queue_items i where i.queue_id in (${first.radarId}, ${second.radarId}) order by i.created_at`;
    expect(sameAccount.filter((row) => row.status === "READY")).toHaveLength(1);
    expect(sameAccount.filter((row) => row.status === "ERROR")).toHaveLength(1);
  });
});

describe("preservação", () => {
  it("30. filas de Games continuam iguais e não se misturam com radares", async () => {
    const seed = await seedUserWithAccount(db);
    const games = await queueService.createQueue(seed.userId, {
      name: "GTA 6",
      category: "games",
      theme: "gta-6",
      instagramAccountId: seed.accountId,
      publishToInstagram: true,
      facebookPageIds: [],
      schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: SP, minIntervalMinutes: 60 },
      captionTemplate: "{titulo} #GTA6",
      rightsConfirmed: true,
      links: links(2, "games"),
    });
    const radar = await createRadar(seed, { links: links(2, "radar") });
    const overview = await queueService.listQueuesOverview(seed.userId);
    expect(overview.map((entry) => entry.queue.id)).toEqual([games.queueId]);
    expect((await radarService.listRadarsOverview(seed.userId)).map((entry) => entry.queue.id)).toEqual([radar.radarId]);
    const [gamesRow] = await db.sql`select kind, window_start from video_queues where id = ${games.queueId}`;
    expect(gamesRow).toMatchObject({ kind: "VIDEO_QUEUE", window_start: null });
    await importAll();
    await queueService.applyQueueAction(seed.userId, games.queueId, "activate");
    expect((await items(games.queueId)).every((row) => row.status === "SCHEDULED")).toBe(true);
    // A tela/API de Games não altera radares (regras próprias).
    await expect(queueService.updateSettings(seed.userId, radar.radarId, { schedule: { postsPerDay: 20 } })).rejects.toThrow(/Radar Instagram/);
    await expect(queueService.addLinks(seed.userId, radar.radarId, { links: links(1, "z"), authorized: true })).rejects.toThrow(/Radar Instagram/);
  });
});
