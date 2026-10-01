import "server-only";
import {
  InstagramImportProviderError,
  type InstagramMediaImportProvider,
  type InstagramMediaItem,
  type InstagramMediaResult,
} from "./provider";

/**
 * Apify — Actor "Instagram Downloader API" (apify.com/snapinsta/
 * instagram-downloader-api, consultado em 01/10/2026): API comercial
 * documentada, cobra por pedido (US$ 0,43–1,20 por 1.000), só conteúdo
 * PÚBLICO (privado, apagado, restrito por idade/região não resolve), sem
 * login do usuário. Um link por execução.
 *
 *   POST https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items
 *        Authorization: Bearer <APIFY_TOKEN>   body { "url": "…" }
 *   → [ { status: true, sourceUrl, media: [ { url, thumbnail, fileType } ], requestId } ]
 *   → [ { status: false, error: { code, message, requestId } } ]
 *
 * O token nunca é logado nem vai para a URL (cabeçalho Authorization).
 */

export const APIFY_API_BASE_URL = "https://api.apify.com/v2";
export const DEFAULT_APIFY_INSTAGRAM_ACTOR = "snapinsta~instagram-downloader-api";
/** O Actor precisa terminar dentro do orçamento da function (60 s). */
const RUN_TIMEOUT_SECONDS = 45;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new InstagramImportProviderError("Importação indisponível no momento.", "NOT_CONFIGURED", false);
  return token;
}

function actorId(): string {
  const value = process.env.APIFY_INSTAGRAM_ACTOR?.trim() || DEFAULT_APIFY_INSTAGRAM_ACTOR;
  if (!/^[A-Za-z0-9_.-]+~[A-Za-z0-9_.-]+$/.test(value)) {
    throw new InstagramImportProviderError("Importação indisponível no momento.", "NOT_CONFIGURED", false);
  }
  return value;
}

/** Erro do Actor → código do Alilu. */
export function classifyApifyError(code: string, message: string): InstagramImportProviderError {
  const text = `${code} ${message}`.toUpperCase();
  if (text.includes("INVALID_INSTAGRAM_URL") || text.includes("INVALID_URL")) {
    return new InstagramImportProviderError("Esse link do Instagram não foi reconhecido.", "INVALID_URL", false);
  }
  if (/PRIVATE|LOGIN|RESTRICT|AGE|REGION/.test(text)) {
    return new InstagramImportProviderError("Esse conteúdo não está disponível publicamente.", "PRIVATE_CONTENT", false);
  }
  if (/NOT[_ ]?FOUND|DELETED|REMOVED|UNAVAILABLE|EXPIRED|NO[_ ]MEDIA/.test(text)) {
    return new InstagramImportProviderError("Esse conteúdo não está disponível publicamente.", "NOT_FOUND", false);
  }
  if (text.includes("UNSUPPORTED")) {
    return new InstagramImportProviderError("Esse formato ainda não é suportado.", "UNSUPPORTED", false);
  }
  return new InstagramImportProviderError("Não conseguimos importar agora. Tente novamente ou faça upload manual.", "PROVIDER_FAILED", true);
}

function mediaTypeOf(fileType: string | null, url: string): InstagramMediaItem["mediaType"] | null {
  const type = (fileType ?? "").toLowerCase();
  if (type.startsWith("video/")) return "VIDEO";
  if (type.startsWith("image/")) return "IMAGE";
  const path = url.split("?")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(path)) return "VIDEO";
  if (/\.(jpe?g|png|webp|heic)$/.test(path)) return "IMAGE";
  return null;
}

export function parseApifyItems(payload: unknown): Omit<InstagramMediaResult, "provider"> {
  const item = Array.isArray(payload) ? payload[0] : payload;
  if (!isRecord(item)) {
    throw new InstagramImportProviderError("Não conseguimos importar agora. Tente novamente ou faça upload manual.", "PROVIDER_FAILED", true);
  }
  if (item.status !== true) {
    const error = isRecord(item.error) ? item.error : {};
    throw classifyApifyError(String(error.code ?? ""), String(error.message ?? ""));
  }
  const media = Array.isArray(item.media) ? item.media : [];
  const items: InstagramMediaItem[] = [];
  for (const entry of media) {
    if (!isRecord(entry) || typeof entry.url !== "string" || !/^https?:\/\//i.test(entry.url)) continue;
    const contentType = typeof entry.fileType === "string" ? entry.fileType : null;
    const mediaType = mediaTypeOf(contentType, entry.url);
    if (!mediaType) continue;
    items.push({
      mediaType,
      mediaUrl: entry.url,
      thumbnailUrl: typeof entry.thumbnail === "string" && /^https?:\/\//i.test(entry.thumbnail) ? entry.thumbnail : null,
      contentType,
    });
  }
  if (items.length === 0) {
    throw new InstagramImportProviderError("Esse conteúdo não está disponível publicamente.", "NOT_FOUND", false);
  }
  return {
    requestId: typeof item.requestId === "string" ? item.requestId : null,
    items,
    title: null,
    durationSeconds: null,
    width: null,
    height: null,
  };
}

export const apifyInstagramProvider: InstagramMediaImportProvider = {
  id: "apify",

  async resolve(normalizedUrl: string): Promise<InstagramMediaResult> {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(
        `${APIFY_API_BASE_URL}/acts/${actorId()}/run-sync-get-dataset-items?timeout=${RUN_TIMEOUT_SECONDS}&clean=true`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl }),
          signal: AbortSignal.timeout((RUN_TIMEOUT_SECONDS + 8) * 1000),
        },
      );
    } catch {
      throw new InstagramImportProviderError("Não conseguimos importar agora. Tente novamente ou faça upload manual.", "PROVIDER_FAILED", true);
    }
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      // 401/403: token inválido; 402: sem saldo na Apify; 408/429/5xx: tente de novo.
      throw new InstagramImportProviderError(
        "Não conseguimos importar agora. Tente novamente ou faça upload manual.",
        "PROVIDER_FAILED",
        response.status === 408 || response.status === 429 || response.status >= 500,
        response.status,
      );
    }
    return { provider: "apify", ...parseApifyItems(payload) };
  },
};
