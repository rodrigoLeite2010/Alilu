import "server-only";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { SafeDownloadError, safeDownload } from "@/lib/instagram-import/backend/safe-download";
import { getDb } from "@/lib/db/client";
import { YoutubeApiError } from "@/lib/youtube-import/backend/youtube-api";
import { FeedParseError, parseFeed, youtubeChannelFeedUrl, type FeedEntry } from "@/lib/viral-radar/rss";
import type { CandidatePlatform, RadarSourceType } from "@/lib/viral-radar/types";
import type { RadarRecord, SourceRecord } from "./radar-repository";
import { readCache, reserveProviderUnits, writeCache } from "./radar-repository";
import { fetchVideoStats, searchVideoIds, SEARCH_LIST_COST, VIDEOS_LIST_COST, youtubeWatchUrl, type YoutubeVideoStats } from "./youtube-search";

/**
 * Conectores de descoberta. Cada um usa SOMENTE APIs oficiais/feeds
 * públicos e devolve itens normalizados. Nenhum conector baixa vídeo:
 * quem importa arquivo é a Fila de vídeos, e só para material autorizado.
 *
 *   YOUTUBE_SEARCH     search.list + videos.list (precisa de YOUTUBE_API_KEY), com cota diária própria e cache;
 *   YOUTUBE_CHANNEL    feed oficial do canal (sem cota) — estatísticas do próprio feed;
 *   RSS                feed RSS/Atom pelo download seguro (SSRF, tamanho, tempo, tipo);
 *   INSTAGRAM_HASHTAG  Instagram Graph API (ig_hashtag_search + top_media) — só com o recurso
 *                      "Instagram Public Content Access" aprovado (INSTAGRAM_HASHTAG_SEARCH_ENABLED=true)
 *                      e conta conectada via Login do Facebook; caso contrário fica DESATIVADO;
 *   TIKTOK             sem API autorizada para este uso: sempre DESATIVADO (nada de endpoints privados).
 */

export interface DiscoveredItem {
  platform: CandidatePlatform;
  externalId: string;
  url: string;
  /** Arquivo de vídeo anunciado pela fonte (só feeds). */
  mediaUrl: string | null;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorId: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  observation: { views: number | null; likes: number | null; comments: number | null } | null;
  provider: string;
}

export type ConnectorStatus = "OK" | "DISABLED" | "ERROR" | "QUOTA";

export interface ConnectorResult {
  status: ConnectorStatus;
  items: DiscoveredItem[];
  quotaUnits: number;
  error: { code: string; message: string } | null;
  /** IDs do YouTube que sumiram (removidos/privados). */
  unavailableIds?: string[];
}

export interface ConnectorContext {
  radar: RadarRecord;
  source: SourceRecord;
  now: Date;
  /** Pesquisas pagas (search.list) ainda permitidas nesta execução. */
  budget: { youtubeSearches: number };
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface ConnectorAvailability {
  available: boolean;
  reason: string | null;
}

const env = (name: string) => (process.env[name] ?? "").trim();
const envInt = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};

export const youtubeDailyUnitCap = () => envInt("VIRAL_RADAR_YOUTUBE_DAILY_UNITS", 3000, 0, 1_000_000);
export const youtubeSearchesPerRun = () => envInt("VIRAL_RADAR_YOUTUBE_SEARCHES_PER_RUN", 2, 0, 20);
export const youtubeSearchCacheHours = () => envInt("VIRAL_RADAR_SEARCH_CACHE_HOURS", 3, 0, 72);
export const instagramHashtagEnabled = () => env("INSTAGRAM_HASHTAG_SEARCH_ENABLED").toLowerCase() === "true";
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

export function connectorAvailability(type: RadarSourceType): ConnectorAvailability {
  switch (type) {
    case "YOUTUBE_SEARCH":
      return env("YOUTUBE_API_KEY")
        ? { available: true, reason: null }
        : { available: false, reason: "YOUTUBE_API_KEY não configurada: pesquisa do YouTube desativada." };
    case "YOUTUBE_CHANNEL":
    case "RSS":
      return { available: true, reason: null };
    case "INSTAGRAM_HASHTAG":
      return instagramHashtagEnabled()
        ? { available: true, reason: null }
        : {
            available: false,
            reason:
              "Pendente: a pesquisa por hashtag exige o recurso \"Instagram Public Content Access\" aprovado no App Review da Meta e conta conectada pelo Login do Facebook. Defina INSTAGRAM_HASHTAG_SEARCH_ENABLED=true só depois da aprovação.",
          };
    case "TIKTOK":
    default:
      return {
        available: false,
        reason: "Pendente: não há API do TikTok autorizada para pesquisa com uso comercial configurada. Conector preparado e desativado.",
      };
  }
}

const disabled = (reason: string): ConnectorResult => ({ status: "DISABLED", items: [], quotaUnits: 0, error: { code: "DISABLED", message: reason } });
const failed = (code: string, message: string, quotaUnits = 0): ConnectorResult => ({ status: code === "QUOTA" ? "QUOTA" : "ERROR", items: [], quotaUnits, error: { code, message } });

function youtubeItem(video: YoutubeVideoStats): DiscoveredItem {
  return {
    platform: "YOUTUBE",
    externalId: video.videoId,
    url: youtubeWatchUrl(video.videoId),
    mediaUrl: null,
    title: video.title,
    description: video.description,
    authorName: video.channelTitle,
    authorId: video.channelId,
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    observation: { views: video.views, likes: video.likes, comments: video.comments },
    provider: "youtube_data_api",
  };
}

function youtubeErrorResult(error: unknown, quotaUnits: number): ConnectorResult {
  if (error instanceof YoutubeApiError) {
    if (error.code === "QUOTA_EXCEEDED") return failed("QUOTA", "Cota diária da YouTube Data API esgotada.", quotaUnits);
    if (error.code === "RATE_LIMITED") return failed("RATE_LIMITED", "YouTube limitou as requisições agora.", quotaUnits);
    if (error.code === "API_AUTH_FAILED") return failed("API_AUTH_FAILED", "Chave da YouTube Data API inválida ou sem permissão.", quotaUnits);
    if (error.code === "CONNECTION") return failed("CONNECTION", "YouTube indisponível agora.", quotaUnits);
  }
  return failed("BAD_RESPONSE", "Resposta inesperada do YouTube.", quotaUnits);
}

/** Reserva cota ANTES de chamar (nunca passa do teto diário configurado). */
async function reserveYoutube(now: Date, units: number): Promise<boolean> {
  return reserveProviderUnits("youtube_data_api", utcDay(now), units, youtubeDailyUnitCap());
}

async function runYoutubeSearch(ctx: ConnectorContext): Promise<ConnectorResult> {
  const apiKey = env("YOUTUBE_API_KEY");
  if (!apiKey) return disabled(connectorAvailability("YOUTUBE_SEARCH").reason!);
  const { radar, now } = ctx;
  const publishedAfter = new Date(now.getTime() - radar.criteria.maxAgeHours * 3_600_000);
  const ageBucket = Math.ceil(radar.criteria.maxAgeHours / 24);
  let quotaUnits = 0;
  const ids = new Set<string>();

  // Palavras-chave sem cache válido primeiro, em rodízio diário — cada uma tem a sua vez.
  const rotation = Math.floor(now.getTime() / 86_400_000) % Math.max(1, radar.keywords.length);
  const keywords = [...radar.keywords.slice(rotation), ...radar.keywords.slice(0, rotation)];
  const pending: string[] = [];
  for (const keyword of keywords) {
    const key = `yt:search:${radar.language}:${radar.region}:${ageBucket}:${keyword.toLowerCase()}`;
    const cached = await readCache<{ ids: string[] }>(key, now);
    if (cached) cached.ids.forEach((id) => ids.add(id));
    else pending.push(keyword);
  }

  try {
    for (const keyword of pending) {
      if (ctx.budget.youtubeSearches <= 0) break;
      if (!(await reserveYoutube(now, SEARCH_LIST_COST))) {
        if (ids.size === 0) return failed("QUOTA", "Teto diário de cota do YouTube (VIRAL_RADAR_YOUTUBE_DAILY_UNITS) atingido.", quotaUnits);
        break;
      }
      ctx.budget.youtubeSearches -= 1;
      quotaUnits += SEARCH_LIST_COST;
      const found = await searchVideoIds(
        { apiKey, fetchImpl: ctx.fetchImpl },
        { query: keyword, publishedAfter, regionCode: radar.region, relevanceLanguage: radar.language, maxResults: 25 },
      );
      found.forEach((id) => ids.add(id));
      const cacheHours = youtubeSearchCacheHours();
      if (cacheHours > 0) {
        await writeCache(`yt:search:${radar.language}:${radar.region}:${ageBucket}:${keyword.toLowerCase()}`, { ids: found }, new Date(now.getTime() + cacheHours * 3_600_000));
      }
    }
    if (ids.size === 0) return { status: "OK", items: [], quotaUnits, error: null };
    const batches = Math.ceil(ids.size / 50);
    if (!(await reserveYoutube(now, batches * VIDEOS_LIST_COST))) return failed("QUOTA", "Teto diário de cota do YouTube atingido.", quotaUnits);
    quotaUnits += batches * VIDEOS_LIST_COST;
    const stats = await fetchVideoStats({ apiKey, fetchImpl: ctx.fetchImpl }, [...ids]);
    return {
      status: "OK",
      items: stats.videos.filter((video) => video.available).map(youtubeItem),
      quotaUnits,
      error: null,
      unavailableIds: [...stats.missing, ...stats.videos.filter((video) => !video.available).map((video) => video.videoId)],
    };
  } catch (error) {
    return youtubeErrorResult(error, quotaUnits);
  }
}

/** Nova observação de métricas para candidatos do YouTube já acompanhados (1 unidade por 50 vídeos). */
export async function refreshYoutubeStats(
  ids: string[],
  now: Date,
  fetchImpl?: ConnectorContext["fetchImpl"],
): Promise<ConnectorResult> {
  const apiKey = env("YOUTUBE_API_KEY");
  if (!apiKey || ids.length === 0) return { status: apiKey ? "OK" : "DISABLED", items: [], quotaUnits: 0, error: null };
  const batches = Math.ceil(new Set(ids).size / 50);
  if (!(await reserveYoutube(now, batches * VIDEOS_LIST_COST))) return failed("QUOTA", "Teto diário de cota do YouTube atingido.");
  try {
    const stats = await fetchVideoStats({ apiKey, fetchImpl }, ids);
    return {
      status: "OK",
      items: stats.videos.filter((video) => video.available).map(youtubeItem),
      quotaUnits: batches * VIDEOS_LIST_COST,
      error: null,
      unavailableIds: [...stats.missing, ...stats.videos.filter((video) => !video.available).map((video) => video.videoId)],
    };
  } catch (error) {
    return youtubeErrorResult(error, batches * VIDEOS_LIST_COST);
  }
}

const FEED_CONTENT_TYPES = ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "application/rdf+xml"];
const FEED_MAX_BYTES = 2 * 1024 * 1024;

async function downloadFeed(url: string): Promise<string> {
  const result = await safeDownload(url, { maxBytes: FEED_MAX_BYTES, allowedContentTypes: FEED_CONTENT_TYPES, timeoutMs: 15_000, maxRedirects: 3 });
  return result.buffer.toString("utf-8");
}

function feedItem(entry: FeedEntry, provider: string): DiscoveredItem | null {
  if (entry.youtubeVideoId) {
    return {
      platform: "YOUTUBE",
      externalId: entry.youtubeVideoId,
      url: youtubeWatchUrl(entry.youtubeVideoId),
      mediaUrl: null,
      title: entry.title,
      description: entry.description,
      authorName: entry.author,
      authorId: null,
      publishedAt: entry.publishedAt,
      thumbnailUrl: entry.thumbnailUrl,
      durationSeconds: entry.durationSeconds,
      observation: entry.views !== null || entry.likes !== null ? { views: entry.views, likes: entry.likes, comments: null } : null,
      provider,
    };
  }
  const url = entry.link ?? entry.mediaUrl;
  if (!url) return null;
  return {
    platform: "RSS",
    externalId: entry.id,
    url,
    mediaUrl: entry.mediaUrl,
    title: entry.title,
    description: entry.description,
    authorName: entry.author,
    authorId: null,
    publishedAt: entry.publishedAt,
    thumbnailUrl: entry.thumbnailUrl,
    durationSeconds: entry.durationSeconds,
    observation: entry.views !== null || entry.likes !== null ? { views: entry.views, likes: entry.likes, comments: null } : null,
    provider,
  };
}

async function runFeed(url: string, provider: string): Promise<ConnectorResult> {
  try {
    const xml = await downloadFeed(url);
    const feed = parseFeed(xml);
    const items = feed.entries.map((entry) => feedItem(entry, provider)).filter((item): item is DiscoveredItem => item !== null);
    return { status: "OK", items, quotaUnits: 0, error: null };
  } catch (error) {
    if (error instanceof SafeDownloadError) {
      if (error.code === "BLOCKED_URL") return failed("BLOCKED_URL", "Endereço do feed bloqueado por segurança.");
      if (error.code === "BAD_CONTENT_TYPE") return failed("NOT_A_FEED", "O endereço não devolveu um feed RSS/Atom.");
      if (error.code === "TOO_LARGE") return failed("TOO_LARGE", "Feed grande demais (máx. 2 MB).");
      if (error.code === "HTTP_ERROR") return failed("HTTP_ERROR", `O feed respondeu HTTP ${error.httpStatus ?? "erro"}.`);
      return failed("CONNECTION", "Não foi possível acessar o feed agora.");
    }
    if (error instanceof FeedParseError) return failed("INVALID_FEED", error.message);
    return failed("CONNECTION", "Não foi possível ler o feed agora.");
  }
}

interface InstagramAccountToken {
  igUserId: string;
  token: string;
  authProvider: string;
}

async function loadAccountToken(userId: string, accountId: string): Promise<InstagramAccountToken | null> {
  const db = getDb();
  const rows = await db`
    select ig_user_id, access_token_encrypted, auth_provider, status from instagram_accounts where id = ${accountId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || row.status !== "connected" || !row.access_token_encrypted) return null;
  return { igUserId: row.ig_user_id as string, token: decryptSecret(row.access_token_encrypted as string), authProvider: (row.auth_provider as string) ?? "instagram_login" };
}

/**
 * Hashtags do Instagram (Graph API oficial). Limite da Meta: 30 hashtags
 * ÚNICAS por conta em 7 dias — controlado aqui; IDs de hashtag em cache.
 * Resultados são de terceiros (sem visualizações na API) → nunca importados.
 */
async function runInstagramHashtag(ctx: ConnectorContext, queueAccountId: string | null): Promise<ConnectorResult> {
  const availability = connectorAvailability("INSTAGRAM_HASHTAG");
  if (!availability.available) return disabled(availability.reason!);
  if (!queueAccountId) return disabled("Escolha a conta do Instagram na fila do radar.");
  const account = await loadAccountToken(ctx.radar.userId, queueAccountId);
  if (!account) return failed("TOKEN_EXPIRED", "A conta do Instagram do radar está desconectada. Reconecte para pesquisar hashtags.");
  if (account.authProvider !== "facebook_login") {
    return disabled("A pesquisa por hashtag só existe para contas conectadas pelo Login do Facebook (instagram_basic).");
  }
  const fetchImpl = ctx.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const tags = ctx.radar.hashtags.map((tag) => tag.replace(/^#/, "").toLowerCase()).slice(0, 3);
  const usageKey = `ig:hashtags:${account.igUserId}`;
  const usage = (await readCache<{ tags: Record<string, string> }>(usageKey, ctx.now)) ?? { tags: {} };
  const weekAgo = ctx.now.getTime() - 7 * 86_400_000;
  for (const [tag, at] of Object.entries(usage.tags)) if (new Date(at).getTime() < weekAgo) delete usage.tags[tag];

  const items: DiscoveredItem[] = [];
  const graph = (path: string, params: Record<string, string>) => {
    const url = new URL(`https://graph.facebook.com/v25.0/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("access_token", account.token);
    return url.toString();
  };
  try {
    for (const tag of tags) {
      if (!usage.tags[tag] && Object.keys(usage.tags).length >= 30) break;
      const idKey = `ig:hashtag-id:${tag}`;
      let hashtagId = (await readCache<{ id: string }>(idKey, ctx.now))?.id ?? null;
      if (!hashtagId) {
        const response = await fetchImpl(graph("ig_hashtag_search", { user_id: account.igUserId, q: tag }), { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return failed(response.status === 400 || response.status === 403 ? "PERMISSION" : "CONNECTION", "A Meta recusou a pesquisa por hashtag (permissão ou limite).");
        const body = (await response.json()) as { data?: Array<{ id?: string }> };
        hashtagId = body.data?.[0]?.id ?? null;
        if (!hashtagId) continue;
        await writeCache(idKey, { id: hashtagId }, new Date(ctx.now.getTime() + 30 * 86_400_000));
      }
      usage.tags[tag] = usage.tags[tag] ?? ctx.now.toISOString();
      const response = await fetchImpl(
        graph(`${hashtagId}/top_media`, { user_id: account.igUserId, fields: "id,caption,comments_count,like_count,media_type,permalink,timestamp", limit: "25" }),
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) return failed("PERMISSION", "A Meta recusou a leitura das publicações da hashtag.");
      const body = (await response.json()) as {
        data?: Array<{ id?: string; caption?: string; comments_count?: number; like_count?: number; media_type?: string; permalink?: string; timestamp?: string }>;
      };
      for (const media of body.data ?? []) {
        if (!media.id || !media.permalink || media.media_type !== "VIDEO") continue;
        const published = media.timestamp ? new Date(media.timestamp) : null;
        items.push({
          platform: "INSTAGRAM",
          externalId: media.id,
          url: media.permalink,
          mediaUrl: null,
          title: media.caption ? media.caption.slice(0, 200) : null,
          description: media.caption ? media.caption.slice(0, 2000) : null,
          authorName: null,
          authorId: null,
          publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
          thumbnailUrl: null,
          durationSeconds: null,
          // A API de hashtag não informa visualizações: views = null (nunca estimado).
          observation: { views: null, likes: typeof media.like_count === "number" ? media.like_count : null, comments: typeof media.comments_count === "number" ? media.comments_count : null },
          provider: "instagram_graph_hashtag",
        });
      }
    }
    await writeCache(usageKey, usage, new Date(ctx.now.getTime() + 8 * 86_400_000));
    return { status: "OK", items, quotaUnits: 0, error: null };
  } catch {
    return failed("CONNECTION", "Instagram indisponível agora.");
  }
}

export async function runConnector(ctx: ConnectorContext, queueAccountId: string | null): Promise<ConnectorResult> {
  const { source } = ctx;
  switch (source.type) {
    case "YOUTUBE_SEARCH":
      return runYoutubeSearch(ctx);
    case "YOUTUBE_CHANNEL":
      return source.config.channelId ? runFeed(youtubeChannelFeedUrl(source.config.channelId), "youtube_channel_feed") : failed("INVALID_CONFIG", "Canal não informado.");
    case "RSS":
      return source.config.url ? runFeed(source.config.url, "rss") : failed("INVALID_CONFIG", "Feed não informado.");
    case "INSTAGRAM_HASHTAG":
      return runInstagramHashtag(ctx, queueAccountId);
    case "TIKTOK":
    default:
      return disabled(connectorAvailability("TIKTOK").reason!);
  }
}

/** Manchetes de fontes oficiais/confiáveis (para checar fatos dos roteiros originais). */
export async function fetchTrustedHeadlines(sources: SourceRecord[], limit = 15): Promise<Array<{ title: string; link: string | null; publishedAt: string | null; source: string }>> {
  const headlines: Array<{ title: string; link: string | null; publishedAt: string | null; source: string }> = [];
  for (const source of sources.filter((item) => item.trustedForFacts && item.enabled && item.type === "RSS" && item.config.url)) {
    try {
      const feed = parseFeed(await downloadFeed(source.config.url!));
      for (const entry of feed.entries.slice(0, limit)) {
        if (entry.title) headlines.push({ title: entry.title, link: entry.link, publishedAt: entry.publishedAt?.toISOString() ?? null, source: source.label || feed.title || "Fonte oficial" });
      }
    } catch {
      // fonte confiável indisponível: o roteiro marca as informações como "a verificar"
    }
  }
  return headlines.slice(0, limit * 2);
}
