import "server-only";
import { mapGoogleError, sanitizeText, sanitizeThumbnailUrl, YoutubeApiError } from "@/lib/youtube-import/backend/youtube-api";
import { parseIsoDuration } from "@/lib/youtube-import/types";

/**
 * Pesquisa pela YouTube Data API v3 OFICIAL — só metadados e estatísticas
 * públicas; nunca baixa mídia. Pesquisar um vídeo NÃO concede licença de
 * republicação: tudo que vem daqui é conteúdo de terceiros.
 *
 * Custos (cota padrão de 10.000 unidades/dia por projeto):
 *   - search.list  = 100 unidades por chamada (até 50 resultados);
 *   - videos.list  =   1 unidade por chamada (até 50 IDs).
 * A chave vai no cabeçalho X-Goog-Api-Key (nunca na URL/logs).
 */

export const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
export const YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
export const SEARCH_LIST_COST = 100;
export const VIDEOS_LIST_COST = 1;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface YoutubeClientOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface YoutubeVideoStats {
  videoId: string;
  title: string | null;
  description: string | null;
  channelTitle: string | null;
  channelId: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** null = o YouTube não informou (ex.: curtidas ocultas, comentários desativados). */
  views: number | null;
  likes: number | null;
  comments: number | null;
  /** false = privado, ao vivo/agendado ou com upload não processado. */
  available: boolean;
}

async function call(options: YoutubeClientOptions, url: string): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", "X-Goog-Api-Key": options.apiKey },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch {
    throw new YoutubeApiError("CONNECTION");
  }
  if (!response.ok) throw await mapGoogleError(response);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new YoutubeApiError("BAD_RESPONSE", response.status);
  }
}

export interface SearchParams {
  query: string;
  publishedAfter: Date;
  regionCode: string;
  relevanceLanguage: string;
  maxResults?: number;
}

/** search.list (100 unidades): IDs dos vídeos mais vistos publicados depois de `publishedAfter`. */
export async function searchVideoIds(options: YoutubeClientOptions, params: SearchParams): Promise<string[]> {
  const query = new URLSearchParams({
    part: "id",
    type: "video",
    q: params.query.slice(0, 100),
    order: "viewCount",
    publishedAfter: params.publishedAfter.toISOString(),
    regionCode: params.regionCode,
    relevanceLanguage: params.relevanceLanguage,
    maxResults: String(Math.min(50, Math.max(1, params.maxResults ?? 25))),
    safeSearch: "moderate",
    fields: "items(id/videoId)",
  });
  const body = (await call(options, `${YOUTUBE_SEARCH_ENDPOINT}?${query.toString()}`)) as { items?: Array<{ id?: { videoId?: string } }> };
  const ids = (body.items ?? []).map((item) => item?.id?.videoId).filter((id): id is string => typeof id === "string" && VIDEO_ID.test(id));
  return [...new Set(ids)];
}

interface VideosItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  status?: { uploadStatus?: string; privacyStatus?: string };
}

const count = (value: string | undefined): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

function bestThumbnail(thumbnails: Record<string, { url?: string }> | undefined): string | null {
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = sanitizeThumbnailUrl(thumbnails?.[key]?.url);
    if (url) return url;
  }
  return null;
}

export function mapVideosItem(item: VideosItem): YoutubeVideoStats | null {
  if (typeof item.id !== "string" || !VIDEO_ID.test(item.id)) return null;
  const live = item.snippet?.liveBroadcastContent ?? "none";
  const privacy = item.status?.privacyStatus ?? "public";
  const upload = item.status?.uploadStatus ?? "processed";
  const published = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null;
  const duration = parseIsoDuration(item.contentDetails?.duration);
  return {
    videoId: item.id,
    title: sanitizeText(item.snippet?.title),
    description: sanitizeText(item.snippet?.description, 2000),
    channelTitle: sanitizeText(item.snippet?.channelTitle, 120),
    channelId: typeof item.snippet?.channelId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(item.snippet.channelId) ? item.snippet.channelId : null,
    publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    durationSeconds: duration && duration > 0 ? duration : null,
    views: count(item.statistics?.viewCount),
    likes: count(item.statistics?.likeCount),
    comments: count(item.statistics?.commentCount),
    available: privacy !== "private" && live === "none" && (upload === "processed" || upload === "uploaded"),
  };
}

/** videos.list (1 unidade por lote de 50): metadados + estatísticas. IDs ausentes na resposta = removidos/privados. */
export async function fetchVideoStats(options: YoutubeClientOptions, ids: string[]): Promise<{ videos: YoutubeVideoStats[]; missing: string[]; calls: number }> {
  const unique = [...new Set(ids.filter((id) => VIDEO_ID.test(id)))];
  const videos: YoutubeVideoStats[] = [];
  let calls = 0;
  for (let index = 0; index < unique.length; index += 50) {
    const batch = unique.slice(index, index + 50);
    const query = new URLSearchParams({
      part: "snippet,contentDetails,statistics,status",
      id: batch.join(","),
      maxResults: "50",
      fields:
        "items(id,snippet(title,description,channelTitle,channelId,publishedAt,liveBroadcastContent,thumbnails),contentDetails(duration),statistics(viewCount,likeCount,commentCount),status(uploadStatus,privacyStatus))",
    });
    calls += 1;
    const body = (await call(options, `${YOUTUBE_VIDEOS_ENDPOINT}?${query.toString()}`)) as { items?: VideosItem[] };
    for (const item of body.items ?? []) {
      const mapped = mapVideosItem(item);
      if (mapped) videos.push(mapped);
    }
  }
  const found = new Set(videos.map((video) => video.videoId));
  return { videos, missing: unique.filter((id) => !found.has(id)), calls };
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
