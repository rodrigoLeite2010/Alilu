import "server-only";
import { canonicalYoutubeUrl, isValidYoutubeVideoId } from "../url";
import { parseIsoDuration, type YoutubeAvailability } from "../types";

/**
 * Cliente da API OFICIAL do YouTube — só metadados públicos, nunca mídia.
 *
 *   1. YouTube Data API v3 `videos.list` (part=snippet,contentDetails,status),
 *      custo de 1 unidade de cota por chamada (cota padrão: 10.000/dia por
 *      projeto do Google Cloud). A chave vai no cabeçalho `X-Goog-Api-Key`
 *      (nunca na URL, para não aparecer em logs) e só existe no servidor
 *      (YOUTUBE_API_KEY).
 *   2. oEmbed oficial (`https://www.youtube.com/oembed`), sem chave: usado
 *      quando a chave não está configurada (dados básicos: título, canal,
 *      miniatura — sem duração) e para diferenciar "privado" de "não existe"
 *      quando a Data API devolve a lista vazia (com chave de API, vídeos
 *      privados e removidos aparecem iguais: `items: []`).
 *
 * As URLs chamadas são FIXAS (googleapis.com / youtube.com) e só recebem o ID
 * já validado (11 caracteres [A-Za-z0-9_-]) — a URL colada pelo usuário nunca
 * é acessada pelo servidor.
 */

export interface YoutubeVideoMetadata {
  source: "data_api" | "oembed";
  availability: YoutubeAvailability;
  title: string | null;
  channelTitle: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** O dono permite incorporar o player em outros sites. */
  embeddable: boolean;
  madeForKids: boolean | null;
  /** Bloqueado (ou não liberado) no Brasil. */
  regionRestricted: boolean;
  privacyStatus: string | null;
}

export type YoutubeApiErrorCode = "QUOTA_EXCEEDED" | "RATE_LIMITED" | "API_AUTH_FAILED" | "CONNECTION" | "BAD_RESPONSE";

export class YoutubeApiError extends Error {
  constructor(
    readonly code: YoutubeApiErrorCode,
    readonly httpStatus: number | null = null,
    readonly reason: string | null = null,
  ) {
    super(`youtube-api: ${code}${reason ? ` (${reason})` : ""}`);
    this.name = "YoutubeApiError";
  }
}

export const YOUTUBE_DATA_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
export const YOUTUBE_OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
const ALLOWED_THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "i1.ytimg.com", "i2.ytimg.com", "i3.ytimg.com", "i4.ytimg.com", "i9.ytimg.com", "img.youtube.com"]);
const VIEWER_REGION = "BR";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface YoutubeApiOptions {
  apiKey?: string | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Remove caracteres de controle/bidi, junta espaços e limita o tamanho (texto vindo de terceiros). */
export function sanitizeText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Só miniaturas servidas pelo próprio YouTube, em https. */
export function sanitizeThumbnailUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!ALLOWED_THUMBNAIL_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function request(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new YoutubeApiError("CONNECTION");
  }
}

interface GoogleErrorBody {
  error?: { code?: number; status?: string; message?: string; errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> };
}

async function mapGoogleError(response: Response): Promise<YoutubeApiError> {
  let body: GoogleErrorBody = {};
  try {
    body = (await response.json()) as GoogleErrorBody;
  } catch {
    body = {};
  }
  const reasons = [
    ...(body.error?.errors ?? []).map((item) => item.reason ?? ""),
    ...(body.error?.details ?? []).map((item) => item.reason ?? ""),
    body.error?.status ?? "",
  ].filter(Boolean);
  const has = (...names: string[]) => reasons.some((reason) => names.includes(reason));
  const reason = reasons[0] ?? null;
  if (has("quotaExceeded", "dailyLimitExceeded", "dailyLimitExceededUnreg")) return new YoutubeApiError("QUOTA_EXCEEDED", response.status, reason);
  if (response.status === 429 || has("rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED")) {
    return new YoutubeApiError("RATE_LIMITED", response.status, reason);
  }
  if (
    response.status === 401 ||
    has("keyInvalid", "keyExpired", "API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "accessNotConfigured", "ipRefererBlocked", "forbidden", "SERVICE_DISABLED", "PERMISSION_DENIED")
  ) {
    return new YoutubeApiError("API_AUTH_FAILED", response.status, reason);
  }
  if (response.status === 400 && /api key/i.test(body.error?.message ?? "")) return new YoutubeApiError("API_AUTH_FAILED", response.status, reason);
  if (response.status >= 500) return new YoutubeApiError("CONNECTION", response.status, reason);
  if (response.status === 403) return new YoutubeApiError("API_AUTH_FAILED", response.status, reason);
  return new YoutubeApiError("BAD_RESPONSE", response.status, reason);
}

interface DataApiItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
  };
  contentDetails?: {
    duration?: string;
    regionRestriction?: { allowed?: string[]; blocked?: string[] };
    contentRating?: { ytRating?: string };
  };
  status?: { uploadStatus?: string; privacyStatus?: string; embeddable?: boolean; madeForKids?: boolean };
}

function bestThumbnail(thumbnails: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbnails) return null;
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = sanitizeThumbnailUrl(thumbnails[key]?.url);
    if (url) return url;
  }
  return null;
}

/** Converte um item da Data API v3 no formato da Alilu (exportado para testes). */
export function mapDataApiItem(item: DataApiItem): YoutubeVideoMetadata {
  const uploadStatus = item.status?.uploadStatus ?? null;
  const privacyStatus = item.status?.privacyStatus ?? null;
  const live = item.snippet?.liveBroadcastContent ?? "none";
  const restriction = item.contentDetails?.regionRestriction;
  const regionRestricted = Boolean(
    (restriction?.blocked && restriction.blocked.includes(VIEWER_REGION)) || (restriction?.allowed && !restriction.allowed.includes(VIEWER_REGION)),
  );
  let availability: YoutubeAvailability = "AVAILABLE";
  if (uploadStatus === "deleted") availability = "NOT_FOUND";
  else if (uploadStatus === "rejected" || uploadStatus === "failed") availability = "UNAVAILABLE";
  else if (privacyStatus === "private") availability = "PRIVATE";
  else if (live === "live") availability = "LIVE_NOW";
  else if (live === "upcoming") availability = "UPCOMING";
  else if (item.contentDetails?.contentRating?.ytRating === "ytAgeRestricted") availability = "AGE_RESTRICTED";

  const duration = parseIsoDuration(item.contentDetails?.duration);
  return {
    source: "data_api",
    availability,
    title: sanitizeText(item.snippet?.title),
    channelTitle: sanitizeText(item.snippet?.channelTitle, 120),
    channelId: typeof item.snippet?.channelId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(item.snippet.channelId) ? item.snippet.channelId : null,
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    // Live/agendado vem como "P0D": duração ainda não existe.
    durationSeconds: duration && duration > 0 ? duration : null,
    embeddable: item.status?.embeddable !== false,
    madeForKids: typeof item.status?.madeForKids === "boolean" ? item.status.madeForKids : null,
    regionRestricted,
    privacyStatus: typeof privacyStatus === "string" ? privacyStatus : null,
  };
}

/** oEmbed oficial: dados básicos sem chave. 401/403 = privado ou incorporação desativada; 404 = não existe. */
async function fetchOembed(videoId: string, fetchImpl: FetchLike, timeoutMs: number): Promise<YoutubeVideoMetadata> {
  const target = `${YOUTUBE_OEMBED_ENDPOINT}?format=json&url=${encodeURIComponent(canonicalYoutubeUrl(videoId, "video"))}`;
  const response = await request(fetchImpl, target, { method: "GET", headers: { Accept: "application/json" } }, timeoutMs);
  const empty = (availability: YoutubeAvailability): YoutubeVideoMetadata => ({
    source: "oembed",
    availability,
    title: null,
    channelTitle: null,
    channelId: null,
    thumbnailUrl: null,
    durationSeconds: null,
    embeddable: false,
    madeForKids: null,
    regionRestricted: false,
    privacyStatus: null,
  });
  if (response.status === 401 || response.status === 403) return empty("PRIVATE");
  if (response.status === 404 || response.status === 400) return empty("NOT_FOUND");
  if (response.status === 429) throw new YoutubeApiError("RATE_LIMITED", 429);
  if (!response.ok) throw new YoutubeApiError(response.status >= 500 ? "CONNECTION" : "BAD_RESPONSE", response.status);
  let body: { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new YoutubeApiError("BAD_RESPONSE", response.status);
  }
  return {
    ...empty("AVAILABLE"),
    title: sanitizeText(body.title),
    channelTitle: sanitizeText(body.author_name, 120),
    thumbnailUrl: sanitizeThumbnailUrl(body.thumbnail_url),
    // oEmbed só responde 200 para vídeo público e incorporável.
    embeddable: true,
  };
}

/**
 * Consulta os metadados públicos de um vídeo. Lança YoutubeApiError para
 * falhas da integração (cota, chave, rede); vídeo privado/removido NÃO é
 * erro — volta com `availability` correspondente.
 */
export async function fetchYoutubeMetadata(videoId: string, options: YoutubeApiOptions = {}): Promise<YoutubeVideoMetadata> {
  if (!isValidYoutubeVideoId(videoId)) throw new YoutubeApiError("BAD_RESPONSE", null, "invalid_video_id");
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 8_000;
  const apiKey = options.apiKey === undefined ? (process.env.YOUTUBE_API_KEY ?? "").trim() : (options.apiKey ?? "").trim();

  if (!apiKey) return fetchOembed(videoId, fetchImpl, timeoutMs);

  const params = new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: videoId,
    fields:
      "items(id,snippet(title,channelTitle,channelId,liveBroadcastContent,thumbnails),contentDetails(duration,regionRestriction,contentRating/ytRating),status(uploadStatus,privacyStatus,embeddable,madeForKids))",
  });
  const response = await request(
    fetchImpl,
    `${YOUTUBE_DATA_API_ENDPOINT}?${params.toString()}`,
    { method: "GET", headers: { Accept: "application/json", "X-Goog-Api-Key": apiKey } },
    timeoutMs,
  );
  if (!response.ok) throw await mapGoogleError(response);
  let body: { items?: DataApiItem[] };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new YoutubeApiError("BAD_RESPONSE", response.status);
  }
  const item = Array.isArray(body.items) ? body.items.find((candidate) => candidate?.id === videoId) ?? body.items[0] : undefined;
  if (item) return mapDataApiItem(item);

  // Lista vazia: privado OU inexistente/removido. O oEmbed diferencia (401 x 404).
  try {
    const fallback = await fetchOembed(videoId, fetchImpl, timeoutMs);
    // Data API não achou mas oEmbed achou (raro: propagação) — trata como disponível com dados básicos.
    return { ...fallback, source: fallback.availability === "AVAILABLE" ? "oembed" : "data_api" };
  } catch {
    return {
      source: "data_api",
      availability: "NOT_FOUND",
      title: null,
      channelTitle: null,
      channelId: null,
      thumbnailUrl: null,
      durationSeconds: null,
      embeddable: false,
      madeForKids: null,
      regionRestricted: false,
      privacyStatus: null,
    };
  }
}
