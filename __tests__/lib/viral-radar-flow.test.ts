// @vitest-environment node
//
// Radar Viral ponta a ponta com Postgres REAL em memória (PGlite, mesmas
// migrações de produção): descoberta (YouTube Data API simulada na rede),
// métricas, Viral Score, direitos, fila de vídeos EXISTENTE, importação,
// agendamento e publicação pelo agendador EXISTENTE. Só a rede é simulada.
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

// IA (mesmo provedor do Piloto Automático) e plano: simulados.
const ai = { rewriteText: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => ({ providerId: "fake", model: "fake-1", rewriteText: (...args: unknown[]) => ai.rewriteText(...args) }),
}));
const access = { allowed: true };
vi.mock("@/lib/billing/backend/automation-access-service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  canUseAiAutomation: async () => (access.allowed ? { allowed: true, code: null, reason: null } : { allowed: false, code: "AI_PLAN_REQUIRED", reason: "Plano sem IA." }),
}));
const reframe = { renderReframe: vi.fn() };
vi.mock("@/lib/video-queue/backend/reframe-runner", () => ({ renderReframe: (...args: unknown[]) => reframe.renderReframe(...args) }));

const radarService = await import("@/lib/viral-radar/backend/radar-service");
const radarCron = await import("@/lib/viral-radar/backend/radar-cron");
const queueService = await import("@/lib/video-queue/backend/queue-service");
const processor = await import("@/lib/video-queue/backend/queue-processor");
const queueCron = await import("@/lib/video-queue/backend/queue-cron");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;
const VERTICAL = { mediaType: "VIDEO", durationSeconds: 30, width: 1080, height: 1920, videoCodec: "h264", hasAudio: true };
const NOW = new Date("2026-11-16T12:00:00Z");

// ───────────── YouTube Data API simulada (rede) ─────────────
interface FakeVideo {
  id: string;
  title: string;
  views: number;
  likes?: number;
  comments?: number;
  channel?: string;
  publishedHoursAgo?: number;
}
const youtube = {
  searchResults: new Map<string, string[]>(),
  videos: new Map<string, FakeVideo>(),
  calls: [] as Array<{ url: string; key: string | null }>,
  failSearch: null as number | null,
};
function fakeFetch(now: Date) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    youtube.calls.push({ url: input, key: headers["X-Goog-Api-Key"] ?? null });
    if (url.hostname === "www.googleapis.com" && url.pathname.endsWith("/search")) {
      if (youtube.failSearch) return new Response(JSON.stringify({ error: { errors: [{ reason: "backendError" }] } }), { status: youtube.failSearch });
      const ids = youtube.searchResults.get(url.searchParams.get("q") ?? "") ?? [];
      return Response.json({ items: ids.map((videoId) => ({ id: { videoId } })) });
    }
    if (url.hostname === "www.googleapis.com" && url.pathname.endsWith("/videos")) {
      const ids = (url.searchParams.get("id") ?? "").split(",");
      return Response.json({
        items: ids
          .map((id) => youtube.videos.get(id))
          .filter((video): video is FakeVideo => Boolean(video))
          .map((video) => ({
            id: video.id,
            snippet: {
              title: video.title,
              description: "",
              channelTitle: video.channel ?? "Canal X",
              channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
              publishedAt: new Date(now.getTime() - (video.publishedHoursAgo ?? 10) * 3_600_000).toISOString(),
              liveBroadcastContent: "none",
              thumbnails: { high: { url: `https://i.ytimg.com/vi/${video.id}/hq.jpg` } },
            },
            contentDetails: { duration: "PT45S" },
            statistics: { viewCount: String(video.views), likeCount: video.likes === undefined ? undefined : String(video.likes), commentCount: video.comments === undefined ? undefined : String(video.comments) },
            status: { uploadStatus: "processed", privacyStatus: "public" },
          })),
      });
    }
    if (url.hostname.startsWith("graph.")) {
      if (url.pathname.endsWith("/insights")) return new Response("{}", { status: 403 });
      return Response.json({ like_count: 42, comments_count: 7, likes: { summary: { total_count: 9 } }, comments: { summary: { total_count: 2 } } });
    }
    return new Response("not found", { status: 404 });
  });
}

// ───────────── Feeds (download seguro simulado) ─────────────
const feeds = new Map<string, string>();
function licensedFeed(count: number, prefix = "clip") {
  const items = Array.from({ length: count }, (_, index) =>
    `<item><title>GTA 6 ${prefix} ${index + 1}</title><link>https://acervo.example.com/${prefix}${index + 1}</link><guid>${prefix}-${index + 1}</guid>
     <pubDate>${new Date(NOW.getTime() - (index + 1) * 3_600_000).toUTCString()}</pubDate>
     <enclosure url="https://cdn.acervo.example.com/${prefix}${index + 1}.mp4" type="video/mp4"/></item>`,
  ).join("");
  return `<rss version="2.0"><channel><title>Acervo licenciado</title>${items}</channel></rss>`;
}

const LICENSE = { edit: true, republish: true, commercial: true };
const items = (queueId: string) => db.sql`select * from video_queue_items where queue_id = ${queueId} order by position`;
const candidates = (radarId: string) => db.sql`select * from viral_candidates where radar_id = ${radarId} order by score desc nulls last`;

async function seedPage(seed: Seed) {
  const [row] = await db.sql`
    insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status, instagram_account_id)
    values (${seed.userId}, 'page-gta', 'GTA 6 BR', 'page-token', 'fb-user', 'connected', ${seed.accountId}) returning id`;
  return row.id as string;
}

async function createRadar(seed: Seed, overrides: Record<string, unknown> = {}) {
  return radarService.createRadar(
    seed.userId,
    {
      category: "games",
      theme: "gta-6",
      keywords: ["GTA 6", "GTA VI"],
      rightsConfirmed: true,
      publication: {
        instagramAccountId: seed.accountId,
        publishToInstagram: true,
        facebookPageIds: [],
        schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: "America/Sao_Paulo", minIntervalMinutes: 60 },
        captionTemplate: "{titulo}\n\n#GTA6",
      },
      sources: [{ type: "YOUTUBE_SEARCH" }],
      ...overrides,
    },
    NOW,
  );
}

async function tick(now: Date = NOW, extra: Record<string, unknown> = {}) {
  return radarCron.runViralRadarTick({ now: () => now, fetchImpl: fakeFetch(now) as unknown as typeof fetch, monitor: false, ...extra });
}

async function importAll() {
  return processor.runQueueImports({ maxItems: 100, maxInFlight: 5, deadline: Date.now() + 60_000 });
}

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
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(igImport), download.safeDownload, probeMock.probeVideoBuffer, blob.put, blob.del, ai.rewriteText, reframe.renderReframe]) {
    fn.mockReset();
  }
  youtube.searchResults.clear();
  youtube.videos.clear();
  youtube.calls = [];
  youtube.failSearch = null;
  feeds.clear();
  access.allowed = true;
  vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  vi.stubEnv("VIRAL_RADAR_YOUTUBE_DAILY_UNITS", "3000");
  vi.stubEnv("VIRAL_RADAR_SEARCH_CACHE_HOURS", "0");
  blob.put.mockImplementation(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}`, pathname }));
  download.safeDownload.mockImplementation(async (url: string) => {
    const feed = feeds.get(url);
    if (feed !== undefined) return { buffer: Buffer.from(feed), contentType: "application/rss+xml", finalUrl: url };
    if (url.endsWith(".mp4")) return { buffer: Buffer.from(`video:${url}`), contentType: "video/mp4", finalUrl: url };
    throw new FakeSafeDownloadError("O servidor respondeu 404.", "HTTP_ERROR", 404);
  });
  probeMock.probeVideoBuffer.mockResolvedValue(VERTICAL);
  reframe.renderReframe.mockResolvedValue(Buffer.from("vertical"));
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function setSearch(query: string, videos: FakeVideo[]) {
  youtube.searchResults.set(query, videos.map((video) => video.id));
  for (const video of videos) youtube.videos.set(video.id, video);
}
const vid = (n: number) => `vid${String(n).padStart(8, "0")}`;
const licensedSource = (url: string, extra: Record<string, unknown> = {}) => ({
  type: "RSS",
  label: "Acervo licenciado",
  config: { url },
  license: "LICENSED",
  licenseScope: LICENSE,
  licenseNote: "Contrato de licença nº 42 com o estúdio X (edição, republicação e uso comercial).",
  rightsConfirmed: true,
  ...extra,
});

describe("criação e configuração", () => {
  it("cria o Radar GTA 6 Brasil reaproveitando a Fila de vídeos (contas, horários) com padrões do spec", async () => {
    const seed = await seedUserWithAccount(db);
    await expect(radarService.createRadar(seed.userId, { category: "games", theme: "gta-6" }, NOW)).rejects.toMatchObject({ code: "AUTHORIZATION_REQUIRED" });
    const { radarId, queueId } = await createRadar(seed, { keywords: undefined });
    const [radar] = await db.sql`select * from viral_radars where id = ${radarId}`;
    expect(radar).toMatchObject({ name: "Radar GTA 6 Brasil", frequency_minutes: 360, queue_min: 5, queue_target: 15, auto_mode: true, supervised_mode: true, status: "ACTIVE" });
    expect(radar.keywords).toContain("GTA 6 Brasil");
    expect((radar.criteria as { minViews: number }).minViews).toBe(100000);
    const [queue] = await db.sql`select * from video_queues where id = ${queueId}`;
    expect(queue).toMatchObject({ status: "DRAFT", block_duplicate_files: true, reframe_mode: "NONE", instagram_account_id: seed.accountId, timezone: "America/Sao_Paulo" });
    expect(queue.publish_times).toEqual(["09:00", "15:00", "20:00"]);
    expect(await db.sql`select type, license from viral_radar_sources where radar_id = ${radarId}`).toEqual([{ type: "YOUTUBE_SEARCH", license: "NONE" }]);
    // Uma fila pertence a um só radar.
    await expect(createRadar(seed, { queueId })).rejects.toThrow(/outro radar/);
  });

  it("edita configurações (frequência, critérios, 9:16) sem mexer em outros radares", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId, queueId } = await createRadar(seed);
    const other = await createRadar(seed, { name: "Radar GTA 5", theme: "gta-5", keywords: ["GTA 5"] });
    await radarService.updateRadar(seed.userId, radarId, { frequencyMinutes: 720, criteria: { minViews: 50000 }, reframeMode: "FIT_9_16", maxDurationSeconds: 90, captionStyle: "CURIOSITY" });
    const [radar] = await db.sql`select * from viral_radars where id = ${radarId}`;
    expect(radar.frequency_minutes).toBe(720);
    expect((radar.criteria as { minViews: number }).minViews).toBe(50000);
    expect(radar.caption_style).toBe("CURIOSITY");
    const [queue] = await db.sql`select reframe_mode, max_duration_seconds from video_queues where id = ${queueId}`;
    expect(queue).toEqual({ reframe_mode: "FIT_9_16", max_duration_seconds: 90 });
    const [untouched] = await db.sql`select frequency_minutes from viral_radars where id = ${other.radarId}`;
    expect(untouched.frequency_minutes).toBe(360);
    await expect(radarService.updateRadar(seed.userId, radarId, { scoreWeights: { velocity: 90 } })).rejects.toThrow(/somar 100/);
  });
});

describe("descoberta, métricas e Viral Score", () => {
  it("pesquisa pela YouTube Data API oficial (chave no cabeçalho), aplica critérios e NUNCA envia terceiros à fila", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId, queueId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", [
      { id: vid(1), title: "GTA 6: detalhes do trailer", views: 500_000, likes: 20_000, comments: 1_000 },
      { id: vid(2), title: "GTA 6 teoria", views: 50_000, likes: 3_000, comments: 100 },
      { id: vid(3), title: "Vice City comparação GTA VI", views: 300_000, likes: 9_000, comments: 300 },
    ]);
    const result = await tick();
    expect(result.runs).toEqual([expect.objectContaining({ radarId, status: "SUCCEEDED", queued: 0 })]);
    expect(youtube.calls.every((call) => call.key === "test-key" && !call.url.includes("test-key"))).toBe(true);
    expect(youtube.calls.some((call) => call.url.includes("/youtube/v3/search") && call.url.includes("order=viewCount") && call.url.includes("regionCode=BR"))).toBe(true);
    const rows = await candidates(radarId);
    expect(rows).toHaveLength(3);
    const byId = Object.fromEntries(rows.map((row) => [row.external_id, row]));
    expect(byId[vid(2)]).toMatchObject({ status: "FILTERED" });
    expect(byId[vid(2)].filter_reason).toMatch(/Visualizações/);
    expect(byId[vid(1)]).toMatchObject({ status: "AWAITING_AUTHORIZATION", route: "C", authorization_status: "NOT_AUTHORIZED", score_version: "v1" });
    expect(Number(byId[vid(1)].score)).toBeGreaterThan(0);
    expect(byId[vid(1)].score_reason).toMatch(/aguardando 2ª observação/);
    expect(await items(queueId)).toHaveLength(0);
    const [usage] = await db.sql`select units from viral_provider_usage where provider = 'youtube_data_api'`;
    expect(usage.units).toBe(101);
    const [execution] = await db.sql`select * from viral_radar_executions where radar_id = ${radarId}`;
    expect(execution).toMatchObject({ status: "SUCCEEDED", quota_units: 101, discovered: 3, new_candidates: 3, queued: 0, awaiting: 2 });
  });

  it("respeita a cota diária: para de pesquisar, falha com espera (backoff) e não insiste", async () => {
    vi.stubEnv("VIRAL_RADAR_YOUTUBE_DAILY_UNITS", "150");
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6", "GTA VI"] });
    setSearch("GTA 6", [{ id: vid(1), title: "GTA 6", views: 500_000, likes: 1, comments: 1 }]);
    setSearch("GTA VI", [{ id: vid(2), title: "GTA VI", views: 500_000, likes: 1, comments: 1 }]);
    await tick();
    expect(youtube.calls.filter((call) => call.url.includes("/search")).length).toBe(1);
    const later = new Date(NOW.getTime() + 7 * 3_600_000);
    const second = await tick(later);
    expect(second.runs[0].status).toBe("FAILED");
    const [radar] = await db.sql`select * from viral_radars where id = ${radarId}`;
    expect(radar.consecutive_failures).toBe(1);
    expect(new Date(radar.backoff_until as string).getTime()).toBeGreaterThan(later.getTime());
    expect((await tick(new Date(later.getTime() + 60_000))).runs).toHaveLength(0);
  });

  it("sem resultados: radar continua ativo, reabastecimento espera cada vez mais (sem pesquisa infinita)", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", []);
    expect((await tick()).runs[0]).toMatchObject({ status: "SUCCEEDED", queued: 0 });
    // Fila vazia (< mínimo) mas a espera de reabastecimento (60 min após 1 tentativa vazia) ainda não passou.
    expect((await tick(new Date(NOW.getTime() + 30 * 60_000))).runs).toHaveLength(0);
    const refill = await tick(new Date(NOW.getTime() + 61 * 60_000));
    expect(refill.runs).toHaveLength(1);
    const [execution] = await db.sql`select trigger from viral_radar_executions where radar_id = ${radarId} order by started_at desc limit 1`;
    expect(execution.trigger).toBe("REFILL");
    const [radar] = await db.sql`select status, empty_refill_streak from viral_radars where id = ${radarId}`;
    expect(radar).toEqual({ status: "ACTIVE", empty_refill_streak: 2 });
    expect((await tick(new Date(NOW.getTime() + 120 * 60_000))).runs).toHaveLength(0);
  });

  it("guarda o histórico de métricas e só então calcula crescimento real", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", [{ id: vid(1), title: "GTA 6 detalhe", views: 500_000, likes: 20_000, comments: 900 }]);
    await tick();
    youtube.videos.set(vid(1), { id: vid(1), title: "GTA 6 detalhe", views: 800_000, likes: 30_000, comments: 1_200 });
    await tick(new Date(NOW.getTime() + 6 * 3_600_000));
    const [candidate] = await candidates(radarId);
    const snapshots = await db.sql`select views from viral_metric_snapshots where candidate_id = ${candidate.id} order by observed_at`;
    expect(snapshots.map((row) => Number(row.views))).toEqual([500000, 800000]);
    const velocity = (candidate.score_components as Array<{ key: string; raw: number | null }>).find((item) => item.key === "velocity")!;
    expect(velocity.raw).toBeCloseTo(50_000, 0);
    expect(Number(candidate.views)).toBe(800000);
  });

  it("elimina duplicados (várias palavras-chave, várias fontes) e mantém a autorização mais forte", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="y" xmlns:media="m"><entry><id>yt:video:${vid(1)}</id><yt:videoId>${vid(1)}</yt:videoId><title>GTA 6 meu vídeo</title><link rel="alternate" href="https://www.youtube.com/watch?v=${vid(1)}"/><published>2026-11-16T06:00:00Z</published></entry></feed>`,
    );
    const { radarId } = await createRadar(seed, {
      keywords: ["GTA 6", "GTA VI"],
      sources: [{ type: "YOUTUBE_SEARCH" }, { type: "YOUTUBE_CHANNEL", config: { channelId: "UC1234567890123456789012" }, license: "OWN", licenseScope: LICENSE, rightsConfirmed: true }],
    });
    const video = { id: vid(1), title: "GTA 6 meu vídeo", views: 900_000, likes: 50_000, comments: 2_000 };
    setSearch("GTA 6", [video]);
    setSearch("GTA VI", [video]);
    await tick();
    const rows = await candidates(radarId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ authorization_status: "AUTHORIZED", authorization_type: "OWN", status: "QUEUED" });
  });

  it("seleciona os melhores por execução (máximo configurado) e deixa os demais classificados", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6"], criteria: { maxSelectedPerRun: 2, minViews: 1000 } });
    setSearch("GTA 6", [1, 2, 3, 4].map((n) => ({ id: vid(n), title: `GTA 6 vídeo ${n}`, views: 100_000, likes: n * 1_000, comments: n * 50 })));
    await tick();
    const rows = await candidates(radarId);
    expect(rows.slice(0, 2).map((row) => row.status)).toEqual(["AWAITING_AUTHORIZATION", "AWAITING_AUTHORIZATION"]);
    expect(rows.slice(0, 2).map((row) => row.external_id).sort()).toEqual([vid(3), vid(4)]);
    expect(rows.slice(2).map((row) => row.status)).toEqual(["CLASSIFIED", "CLASSIFIED"]);
  });
});

describe("direitos, importação, processamento e legendas", () => {
  it("importa automaticamente só material licenciado, pelo importador da fila, com hash e legenda do modelo", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(3));
    const { radarId, queueId } = await createRadar(seed, { sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    const run = await tick();
    expect(run.runs[0]).toMatchObject({ status: "SUCCEEDED", queued: 3 });
    const queued = await items(queueId);
    expect(queued.map((row) => [row.source_kind, row.status])).toEqual([
      ["DIRECT", "PENDING"],
      ["DIRECT", "PENDING"],
      ["DIRECT", "PENDING"],
    ]);
    expect(queued[0].title).toMatch(/GTA 6 clip/);
    const rows = await candidates(radarId);
    expect(rows.every((row) => row.status === "QUEUED" && row.authorization_type === "LICENSED" && row.queue_item_id)).toBe(true);
    expect((rows[0].caption_meta as { used: string }).used).toBe("template");
    await importAll();
    const imported = await items(queueId);
    expect(imported.every((row) => row.status === "READY" && /^[0-9a-f]{64}$/.test(row.content_sha256 as string))).toBe(true);
    expect(download.safeDownload).toHaveBeenCalledWith("https://cdn.acervo.example.com/clip1.mp4", expect.objectContaining({ allowedContentTypes: expect.arrayContaining(["video/mp4"]) }));
  });

  it("falha de importação fica isolada no item (e aparece como Falhou no radar)", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(2));
    const { radarId, queueId } = await createRadar(seed, { sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    await tick();
    download.safeDownload.mockImplementation(async (url: string) => {
      if (url.endsWith("clip1.mp4")) throw new FakeSafeDownloadError("O servidor respondeu 404.", "HTTP_ERROR", 404);
      return { buffer: Buffer.from(`video:${url}`), contentType: "video/mp4", finalUrl: url };
    });
    await importAll();
    const statuses = (await items(queueId)).map((row) => row.status).sort();
    expect(statuses).toEqual(["ERROR", "READY"]);
    const list = await radarService.listCandidates(seed.userId, radarId, {});
    const { serializeCandidate } = await import("@/lib/viral-radar/backend/radar-dto");
    expect(list.rows.map((row) => serializeCandidate(row).stage).sort()).toEqual(["FAILED", "READY"]);
  });

  it("adapta para 9:16 preservando o original e bloqueia arquivo duplicado na mesma conta", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(2));
    const { queueId } = await createRadar(seed, { reframeMode: "FIT_9_16", maxDurationSeconds: 90, sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    await tick();
    download.safeDownload.mockImplementation(async (url: string) => ({ buffer: Buffer.from("mesmo-arquivo"), contentType: "video/mp4", finalUrl: url }));
    probeMock.probeVideoBuffer.mockImplementation(async (buffer: Buffer) =>
      buffer.toString() === "vertical" ? VERTICAL : { ...VERTICAL, width: 1920, height: 1080, durationSeconds: 120 },
    );
    await importAll();
    const [first, second] = await items(queueId);
    expect(first.status).toBe("READY");
    expect(first.original_blob_url).toMatch(/-original\.mp4$/);
    expect(first.blob_url).toMatch(new RegExp(`${first.id}\\.mp4$`));
    expect(first.status_message).toMatch(/Adaptado para Reels/);
    expect(Number(first.width)).toBe(1080);
    expect(reframe.renderReframe).toHaveBeenCalledWith(Buffer.from("mesmo-arquivo"), expect.objectContaining({ reframe: true, trimToSeconds: 90 }));
    expect(second).toMatchObject({ status: "ERROR", error_code: "DUPLICATE_FILE" });
  });

  it("se a adaptação falhar, segue no formato original com aviso", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(1));
    const { queueId } = await createRadar(seed, { reframeMode: "FIT_9_16", sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    await tick();
    probeMock.probeVideoBuffer.mockResolvedValue({ ...VERTICAL, width: 1920, height: 1080 });
    reframe.renderReframe.mockResolvedValue(null);
    await importAll();
    const [item] = await items(queueId);
    expect(item).toMatchObject({ status: "READY", original_blob_url: null });
    expect(item.status_message).toMatch(/formato original/);
  });

  it("gera legenda com IA (estilo do radar, sem afirmações enganosas) e cai no modelo quando a IA não está disponível", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(2));
    const { radarId, queueId } = await createRadar(seed, { captionMode: "AI", captionStyle: "CURIOSITY", sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    ai.rewriteText
      .mockResolvedValueOnce({
        content: { headline: "Você viu isso?", instagramCaption: "Trailer oficial de GTA 6 mostra detalhe", facebookCaption: "Detalhe em GTA 6", hashtags: ["#GTA6"], cta: "Comenta!" },
        usage: { provider: "fake", model: "fake-1", tokensInput: 10, tokensOutput: 20 },
      })
      .mockRejectedValueOnce(new Error("timeout"));
    await tick();
    const [first, second] = await items(queueId);
    expect(first.caption).toMatch(/Comenta!/);
    expect(first.caption).not.toMatch(/oficial/i);
    expect(first.facebook_caption).toMatch(/Detalhe em GTA 6/);
    expect(second.caption).toBeNull();
    const meta = (await candidates(radarId)).map((row) => (row.caption_meta as { used: string }).used).sort();
    expect(meta).toEqual(["ai", "template"]);
    expect(String(ai.rewriteText.mock.calls[0][0].prompt)).toMatch(/Curiosidades/);
    const [usage] = await db.sql`select count(*)::int as n from generation_usage where feature = 'viral_radar'`;
    expect(usage.n).toBe(1);
  });

  it("não republica na mesma conta; outra conta é outro destino", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(1));
    await queueService.createQueue(seed.userId, {
      name: "Manual",
      category: "games",
      theme: "gta-6",
      instagramAccountId: seed.accountId,
      schedule: { publishTimes: ["10:00"], postsPerDay: 1 },
      captionTemplate: "",
      rightsConfirmed: true,
      links: "https://cdn.acervo.example.com/clip1.mp4",
    });
    const { radarId, queueId } = await createRadar(seed, { sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    await tick();
    expect(await items(queueId)).toHaveLength(0);
    const [candidate] = await candidates(radarId);
    expect(candidate).toMatchObject({ status: "FILTERED" });
    expect(candidate.filter_reason).toMatch(/Já usado nesta conta/);

    const [account2] = await db.sql`insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted) values (${seed.userId}, 'ig-2b', 'conta2', 'x') returning id`;
    const other = await createRadar(seed, {
      name: "Radar conta 2",
      publication: { instagramAccountId: account2.id, schedule: { publishTimes: ["10:00"], postsPerDay: 1 } },
      sources: [licensedSource("https://acervo.example.com/feed.xml")],
    });
    await tick();
    expect(await items(other.queueId)).toHaveLength(1);
  });
});

describe("fila, agendamento e publicação pelo fluxo existente", () => {
  it("distribui 9h/15h/20h (São Paulo) e publica no Instagram e no Facebook; falha só no Facebook não republica o Instagram", async () => {
    const seed = await seedUserWithAccount(db);
    const pageId = await seedPage(seed);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(3));
    const { radarId, queueId } = await createRadar(seed, {
      activatePublishing: true,
      publication: {
        instagramAccountId: seed.accountId,
        publishToInstagram: true,
        facebookPageIds: [pageId],
        schedule: { publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: "America/Sao_Paulo", minIntervalMinutes: 60 },
        captionTemplate: "{titulo} #GTA6",
      },
      sources: [licensedSource("https://acervo.example.com/feed.xml")],
    });
    const [queue] = await db.sql`select status from video_queues where id = ${queueId}`;
    expect(queue.status).toBe("ACTIVE");
    // O radar roda DENTRO do disparador existente da fila: descobre, envia, importa e agenda na mesma execução.
    const cronResult = await queueCron.runVideoQueueCron({ now: () => NOW, maxImports: 10, timeBudgetMs: 200_000 });
    expect(cronResult.radar?.runs[0]).toMatchObject({ radarId, queued: 3 });
    expect(cronResult.imports.filter((entry) => entry.status === "READY")).toHaveLength(3);
    const posts = await db.sql`select * from instagram_posts where status <> 'CANCELLED' order by scheduled_at_utc`;
    expect(posts.map((post) => [post.source, new Date(post.scheduled_at_utc as string).toISOString()])).toEqual([
      ["VIDEO_QUEUE", "2026-11-16T18:00:00.000Z"],
      ["VIDEO_QUEUE", "2026-11-16T23:00:00.000Z"],
      ["VIDEO_QUEUE", "2026-11-17T12:00:00.000Z"],
    ]);
    expect(posts.every((post) => post.instagram_account_id === seed.accountId)).toBe(true);
    expect(await db.sql`select count(*)::int as n from social_publication_destinations`).toEqual([{ n: 3 }]);

    fb.finishPageReel.mockImplementationOnce(async () => {
      throw new FakeFacebookGraphApiError("Falha", { error: { code: 100 } });
    });
    await publishDueNow();
    const published = await db.sql`select status from instagram_posts where status <> 'CANCELLED'`;
    expect(published.every((post) => post.status === "PUBLISHED")).toBe(true);
    const dests = await db.sql`select status from social_publication_destinations order by created_at`;
    expect(dests.filter((dest) => dest.status === "PUBLISHED")).toHaveLength(2);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(3);
    await publishDueNow();
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(3);

    // Monitoramento das publicações próprias (curtidas/comentários; views indisponíveis sem permissão de insights).
    const { monitorPublishedPosts } = await import("@/lib/viral-radar/backend/performance");
    await queueCron.runVideoQueueCron({ now: () => NOW, viralRadar: false });
    const monitored = await monitorPublishedPosts({ fetchImpl: fakeFetch(NOW) as unknown as typeof fetch });
    expect(monitored.checked).toBe(3);
    const metrics = await db.sql`select platform, likes, comments, views, unavailable from viral_post_metrics where radar_id = ${radarId} and platform = 'instagram'`;
    expect(metrics).toHaveLength(3);
    expect([Number(metrics[0].likes), Number(metrics[0].comments), metrics[0].views]).toEqual([42, 7, null]);
    expect(metrics[0].unavailable).toContain("views");
    const dashboard = await radarService.getRadarDashboard(seed.userId, radarId, NOW);
    expect(dashboard.performance.totalSamples).toBeGreaterThanOrEqual(3);
  });

  it("reabastece a fila quando cai abaixo do mínimo, até o tamanho ideal", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(20));
    const { radarId, queueId } = await createRadar(seed, { queueMin: 2, queueTarget: 5, criteria: { maxSelectedPerRun: 50 }, sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    await tick();
    expect(await items(queueId)).toHaveLength(5);
    await importAll();
    expect((await tick(new Date(NOW.getTime() + 60 * 60_000))).runs).toHaveLength(0);
    await db.sql`update video_queue_items set status = 'PUBLISHED' where id in (select id from video_queue_items where queue_id = ${queueId} order by position limit 4)`;
    const refill = await tick(new Date(NOW.getTime() + 61 * 60_000));
    expect(refill.runs[0]).toMatchObject({ radarId, queued: 4 });
    const [execution] = await db.sql`select trigger from viral_radar_executions where radar_id = ${radarId} order by started_at desc limit 1`;
    expect(execution.trigger).toBe("REFILL");
    expect(await items(queueId)).toHaveLength(9);
  });

  it("pausa e retoma o radar", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", []);
    await radarService.applyRadarAction(seed.userId, radarId, "pause", NOW);
    expect((await tick()).runs).toHaveLength(0);
    await radarService.applyRadarAction(seed.userId, radarId, "resume", NOW);
    expect((await tick()).runs).toHaveLength(1);
    await expect(radarService.applyRadarAction(seed.userId, radarId, "resume", NOW)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("robustez", () => {
  it("cron simultâneo: só uma execução por radar; segunda rodada é idempotente (sem duplicar itens/candidatos)", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(3));
    const { radarId, queueId } = await createRadar(seed, { sources: [licensedSource("https://acervo.example.com/feed.xml")] });
    const [a, b] = await Promise.all([tick(), tick()]);
    expect(a.runs.length + b.runs.length).toBe(1);
    await tick(new Date(NOW.getTime() + 6 * 3_600_000 + 60_000));
    expect(await items(queueId)).toHaveLength(3);
    expect(await candidates(radarId)).toHaveLength(3);
    expect(await db.sql`select count(*)::int as n from viral_radar_executions where radar_id = ${radarId}`).toEqual([{ n: 2 }]);
  });

  it("recupera após queda do worker (execução abandonada, lock expirado)", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", []);
    await db.sql`insert into viral_radar_executions (radar_id, user_id, trigger, started_at) values (${radarId}, ${seed.userId}, 'SCHEDULE', now() - interval '1 hour')`;
    await db.sql`update viral_radars set run_lock_token = 'morto', run_lock_expires_at = ${new Date(NOW.getTime() - 60_000).toISOString()} where id = ${radarId}`;
    const result = await tick();
    expect(result.abandoned).toBe(1);
    expect(result.runs).toHaveLength(1);
    await db.sql`update viral_radars set run_lock_token = 'vivo', run_lock_expires_at = ${new Date(NOW.getTime() + 600_000).toISOString()}, next_run_at = ${NOW.toISOString()} where id = ${radarId}`;
    expect((await tick()).runs).toHaveLength(0);
  });

  it("token expirado/conector sem permissão não para o radar: as outras fontes seguem", async () => {
    vi.stubEnv("INSTAGRAM_HASHTAG_SEARCH_ENABLED", "true");
    const seed = await seedUserWithAccount(db);
    feeds.set("https://acervo.example.com/feed.xml", licensedFeed(1));
    const { radarId, queueId } = await createRadar(seed, { sources: [{ type: "INSTAGRAM_HASHTAG" }, { type: "TIKTOK" }, licensedSource("https://acervo.example.com/feed.xml")] });
    await db.sql`update instagram_accounts set status = 'expired' where id = ${seed.accountId}`;
    const run = await tick();
    expect(run.runs[0]).toMatchObject({ status: "PARTIAL", queued: 1 });
    const [execution] = await db.sql`select errors from viral_radar_executions where radar_id = ${radarId}`;
    const codes = (execution.errors as Array<{ code: string }>).map((error) => error.code);
    expect(codes).toEqual(expect.arrayContaining(["TOKEN_EXPIRED", "DISABLED"]));
    expect(await items(queueId)).toHaveLength(1);
    const dashboard = await radarService.getRadarDashboard(seed.userId, radarId, NOW);
    expect(dashboard.pending.join(" ")).toMatch(/TikTok/);
  });

  it("bloqueia URL insegura na entrada e no download (SSRF)", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId } = await createRadar(seed, { sources: [] });
    await expect(radarService.addSource(seed.userId, radarId, { type: "RSS", config: { url: "http://10.0.0.5/feed" } })).rejects.toThrow(/interno/);
    await expect(radarService.addSource(seed.userId, radarId, { type: "RSS", config: { url: "http://localhost:8080/feed" } })).rejects.toThrow(/não permitido|interno/);
    await radarService.addSource(seed.userId, radarId, { type: "RSS", config: { url: "https://rebind.example.com/feed" } });
    download.safeDownload.mockImplementation(async () => {
      throw new FakeSafeDownloadError("Endereço bloqueado.", "BLOCKED_URL");
    });
    const run = await tick();
    expect(run.runs[0].status).toBe("FAILED");
    const [source] = await db.sql`select last_error from viral_radar_sources where radar_id = ${radarId}`;
    expect(source.last_error).toMatch(/bloqueado/);
  });

  it("isola dados entre usuários", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const { radarId } = await createRadar(owner, { keywords: ["GTA 6"] });
    setSearch("GTA 6", [{ id: vid(1), title: "GTA 6", views: 500_000, likes: 10_000, comments: 100 }]);
    await tick();
    const [candidate] = await candidates(radarId);
    await expect(radarService.getRadarDashboard(intruder.userId, radarId, NOW)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(radarService.applyCandidateAction(intruder.userId, candidate.id as string, "ignore", {}, NOW)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(radarService.applyRadarAction(intruder.userId, radarId, "run", NOW)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(createRadar(intruder, { publication: { instagramAccountId: owner.accountId, schedule: { publishTimes: ["10:00"], postsPerDay: 1 } } })).rejects.toThrow(/não foi encontrada/);
    expect((await radarService.listRadarsOverview(intruder.userId, NOW)).rows).toHaveLength(0);
  });
});

describe("modo supervisionado e conteúdo original", () => {
  it("aprovação manual exige licença completa; vídeo do YouTube aprovado entra aguardando o arquivo (não é baixado)", async () => {
    const seed = await seedUserWithAccount(db);
    const { radarId, queueId } = await createRadar(seed, { keywords: ["GTA 6"] });
    setSearch("GTA 6", [{ id: vid(1), title: "GTA 6 detalhe", views: 500_000, likes: 10_000, comments: 100 }]);
    await tick();
    const [candidate] = await candidates(radarId);
    const id = candidate.id as string;
    await expect(radarService.applyCandidateAction(seed.userId, id, "approve", { rightsConfirmed: true, licenseScope: { edit: true, republish: true }, licenseNote: "Autorizado" }, NOW)).rejects.toMatchObject({ code: "AUTHORIZATION_SCOPE" });
    await expect(radarService.applyCandidateAction(seed.userId, id, "approve", { licenseScope: LICENSE, licenseNote: "Autorizado" }, NOW)).rejects.toMatchObject({ code: "AUTHORIZATION_REQUIRED" });
    const result = await radarService.applyCandidateAction(seed.userId, id, "approve", { rightsConfirmed: true, licenseScope: LICENSE, licenseNote: "E-mail do canal X em 16/11/2026 autorizando" }, NOW);
    expect(result.queued).toBe(true);
    const [item] = await items(queueId);
    expect(item).toMatchObject({ source_kind: "YOUTUBE", status: "WAITING_FILE" });
    const [updated] = await candidates(radarId);
    expect(updated).toMatchObject({ status: "QUEUED", authorization_type: "MANUAL_APPROVAL" });
    // Próxima execução não desfaz a aprovação.
    await tick(new Date(NOW.getTime() + 6 * 3_600_000 + 60_000));
    expect((await candidates(radarId))[0]).toMatchObject({ status: "QUEUED", authorization_type: "MANUAL_APPROVAL" });
  });

  it("cria roteiro ORIGINAL a partir do assunto: 'confirmado' só com fonte oficial", async () => {
    const seed = await seedUserWithAccount(db);
    feeds.set("https://oficial.example.com/news.xml", `<rss><channel><title>Oficial</title><item><title>GTA 6 ganha novo trailer</title><link>https://oficial.example.com/n1</link><guid>n1</guid></item></channel></rss>`);
    const { radarId } = await createRadar(seed, {
      keywords: ["GTA 6"],
      supervisedMode: false,
      sources: [{ type: "YOUTUBE_SEARCH" }, { type: "RSS", config: { url: "https://oficial.example.com/news.xml" }, trustedForFacts: true }],
    });
    setSearch("GTA 6", [{ id: vid(1), title: "GTA 6 detalhe", views: 500_000, likes: 10_000, comments: 100 }]);
    await tick();
    const ref = (await candidates(radarId)).find((row) => row.external_id === vid(1))!;
    expect(ref).toMatchObject({ status: "REFERENCE", route: "B" });
    ai.rewriteText.mockResolvedValueOnce({
      content: {
        topic: "Detalhe",
        script: ["Cena 1"],
        claims: [
          { text: "Novo trailer", status: "confirmado", sourceLink: "https://oficial.example.com/n1" },
          { text: "Lançamento em março", status: "confirmado", sourceLink: null },
        ],
        title: "Gameplay oficial vazado?",
        caption: "x",
      },
      usage: { provider: "fake", model: "fake-1", tokensInput: 1, tokensOutput: 1 },
    });
    await radarService.applyCandidateAction(seed.userId, ref.id as string, "brief", {}, NOW);
    const [withBrief] = await db.sql`select brief, status, route from viral_candidates where id = ${ref.id}`;
    const brief = withBrief.brief as { claims: Array<{ status: string }>; referenceUrl: string; title: string };
    expect(brief.claims.map((claim) => claim.status)).toEqual(["confirmado", "a_verificar"]);
    expect(brief.referenceUrl).toBe(`https://www.youtube.com/watch?v=${vid(1)}`);
    expect(withBrief).toMatchObject({ status: "REFERENCE", route: "B" });
    expect(String(ai.rewriteText.mock.calls[0][0].prompt)).toMatch(/NÃO reproduza o vídeo/);
    access.allowed = false;
    await expect(radarService.applyCandidateAction(seed.userId, ref.id as string, "brief", {}, NOW)).rejects.toMatchObject({ code: "AI_PLAN_REQUIRED" });
  });
});
