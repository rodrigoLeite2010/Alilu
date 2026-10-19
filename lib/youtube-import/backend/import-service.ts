import "server-only";
import { del as deleteBlob, head as headBlob } from "@vercel/blob";
import { canUseImporter } from "@/lib/billing/backend/automation-access-service";
import { getImportSettings } from "@/lib/instagram-import/backend/import-repository";
import { InvalidMediaError, probeVideoBuffer, type ProbedMedia } from "@/lib/instagram-import/backend/media-probe";
import { parseYoutubeUrl } from "../url";
import { YOUTUBE_IMPORT_MESSAGES, YOUTUBE_UPLOAD_CONTENT_TYPES, isDurationMismatch } from "../types";
import { fetchYoutubeMetadata, YoutubeApiError, type YoutubeApiOptions, type YoutubeVideoMetadata } from "./youtube-api";
import {
  completeYoutubeImport,
  countYoutubeAnalysesSince,
  deleteYoutubeImport,
  findCompletedYoutubeImport,
  getYoutubeImportForUser,
  insertYoutubeImport,
  recordYoutubeAnalysis,
  type YoutubeImportRecord,
} from "./import-repository";

/**
 * "Importar do YouTube" — regra de negócio.
 *
 *   link → validar/normalizar (só domínios do YouTube, só o ID sai daqui)
 *   → declaração de autorização → limites (por minuto e por dia)
 *   → API oficial (Data API v3; sem chave, oEmbed) → registro ANALYZED com
 *   metadados e disponibilidade → prévia no player oficial
 *   → o USUÁRIO envia o arquivo original (navegador → Vercel Blob direto,
 *   token restrito a videos/imports/{userId}/youtube/{importId}/)
 *   → servidor confere no Blob (head), valida pelo conteúdo (ffprobe),
 *   tamanho e duração → COMPLETED → editor (?youtube=<id>).
 *
 * O arquivo NUNCA é baixado do YouTube: não há scraping, nem extração de
 * stream, nem contorno de assinatura/DRM. Sem arquivo validado, nada é
 * apresentado como "importado".
 */

export class YoutubeImportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "YoutubeImportError";
  }
}

export const youtubeUploadPrefix = (userId: string) => `videos/imports/${userId}/youtube/`;
export const youtubeUploadPrefixForImport = (userId: string, importId: string) => `${youtubeUploadPrefix(userId)}${importId}/`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function youtubeImportLimits() {
  return {
    perDay: intFromEnv("YOUTUBE_IMPORT_MAX_ANALYSES_PER_DAY", 50, 1, 10_000),
    perMinute: intFromEnv("YOUTUBE_IMPORT_MAX_ANALYSES_PER_MINUTE", 10, 1, 1_000),
    requiresPaidPlan: process.env.YOUTUBE_IMPORT_REQUIRES_PAID_PLAN === "true",
  };
}

function log(event: string, data: Record<string, unknown>): void {
  // Nunca registra a chave, URLs de arquivo ou conteúdo — só metadados técnicos.
  console.info(JSON.stringify({ scope: "youtube-import", event, ...data }));
}

/** Início do dia em São Paulo (UTC−3, sem horário de verão desde 2019) — o "hoje" que a tela mostra. */
const SAO_PAULO_OFFSET_MS = 3 * 3600_000;
export function startOfSaoPauloDay(now: Date): Date {
  const local = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + SAO_PAULO_OFFSET_MS);
}

// Cache curto em memória (por instância) dos metadados — economiza cota quando
// a mesma pessoa analisa o mesmo vídeo várias vezes. Policies III.E.4 permitem
// armazenamento temporário; 10 minutos fica muito abaixo do teto de 30 dias.
const METADATA_TTL_MS = 10 * 60 * 1000;
const metadataCache = new Map<string, { value: YoutubeVideoMetadata; fetchedAt: number; expiresAt: number }>();

export function __clearYoutubeMetadataCacheForTests(): void {
  metadataCache.clear();
}

async function cachedMetadata(videoId: string, options: YoutubeApiOptions, now: number): Promise<{ value: YoutubeVideoMetadata; fetchedAt: Date }> {
  const hit = metadataCache.get(videoId);
  if (hit && hit.expiresAt > now) return { value: hit.value, fetchedAt: new Date(hit.fetchedAt) };
  const value = await fetchYoutubeMetadata(videoId, options);
  if (metadataCache.size >= 500) metadataCache.delete(metadataCache.keys().next().value as string);
  metadataCache.set(videoId, { value, fetchedAt: now, expiresAt: now + METADATA_TTL_MS });
  return { value, fetchedAt: new Date(now) };
}

const API_ERROR_MESSAGE: Record<YoutubeApiError["code"], string> = {
  QUOTA_EXCEEDED: YOUTUBE_IMPORT_MESSAGES.QUOTA_EXCEEDED,
  RATE_LIMITED: YOUTUBE_IMPORT_MESSAGES.RATE_LIMITED,
  API_AUTH_FAILED: YOUTUBE_IMPORT_MESSAGES.API_AUTH_FAILED,
  CONNECTION: YOUTUBE_IMPORT_MESSAGES.CONNECTION,
  BAD_RESPONSE: YOUTUBE_IMPORT_MESSAGES.CONNECTION,
};

export function youtubeWarningFor(record: Pick<YoutubeImportRecord, "errorCode" | "metadataSource">): string | null {
  if (record.errorCode && record.errorCode in API_ERROR_MESSAGE) return API_ERROR_MESSAGE[record.errorCode as YoutubeApiError["code"]];
  if (record.metadataSource === "oembed") return YOUTUBE_IMPORT_MESSAGES.NOT_CONFIGURED;
  return null;
}

export interface YoutubeImportQuota {
  used: number;
  limit: number;
  unlimited: boolean;
}

export async function getYoutubeImportQuota(userId: string, isAdmin: boolean, now: Date = new Date()): Promise<YoutubeImportQuota> {
  const used = await countYoutubeAnalysesSince(userId, startOfSaoPauloDay(now));
  return { used, limit: youtubeImportLimits().perDay, unlimited: isAdmin };
}

export interface AnalyzeResult {
  record: YoutubeImportRecord | null;
  duplicate: YoutubeImportRecord | null;
}

export async function analyzeYoutubeLink(
  userId: string,
  input: { url: unknown; authorized: unknown; force?: unknown },
  now: Date = new Date(),
  access: { isAdmin?: boolean; api?: YoutubeApiOptions } = {},
): Promise<AnalyzeResult> {
  if (input.authorized !== true) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.AUTHORIZATION_REQUIRED, "AUTHORIZATION_REQUIRED", 400);
  const limits = youtubeImportLimits();
  if (limits.requiresPaidPlan && access.isAdmin !== true) {
    const gate = await canUseImporter(userId, now);
    if (!gate.allowed) {
      throw new YoutubeImportError("O importador faz parte dos planos pagos.", "PLAN_REQUIRED", 402, { planCode: gate.code });
    }
  }

  const originalUrl = typeof input.url === "string" ? input.url.trim() : "";
  const parsed = parseYoutubeUrl(originalUrl);
  // Link inválido não gera registro nem consulta externa (e não conta no limite).
  if (!parsed.ok) throw new YoutubeImportError(parsed.message, parsed.code, 400);

  if (input.force !== true) {
    const existing = await findCompletedYoutubeImport(userId, parsed.videoId);
    if (existing) return { record: null, duplicate: existing };
  }

  // Conta a tentativa antes de checar (inserir-e-contar): pedidos simultâneos não furam o limite.
  await recordYoutubeAnalysis(userId, now);
  const lastMinute = await countYoutubeAnalysesSince(userId, new Date(now.getTime() - 60_000));
  if (lastMinute > limits.perMinute) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.RATE_LIMITED, "RATE_LIMITED", 429);
  if (access.isAdmin !== true) {
    const today = await countYoutubeAnalysesSince(userId, startOfSaoPauloDay(now));
    if (today > limits.perDay) {
      throw new YoutubeImportError(`${YOUTUBE_IMPORT_MESSAGES.DAILY_LIMIT} (limite: ${limits.perDay} por dia)`, "DAILY_LIMIT", 429);
    }
  }

  const started = Date.now();
  let metadata: YoutubeVideoMetadata | null = null;
  let fetchedAt: Date | null = null;
  let errorCode: string | null = null;
  try {
    const cached = await cachedMetadata(parsed.videoId, access.api ?? {}, now.getTime());
    metadata = cached.value;
    fetchedAt = cached.fetchedAt;
  } catch (error) {
    errorCode = error instanceof YoutubeApiError ? error.code : "CONNECTION";
    log("metadata_failed", {
      userId,
      videoId: parsed.videoId,
      errorCode,
      httpStatus: error instanceof YoutubeApiError ? error.httpStatus : null,
      reason: error instanceof YoutubeApiError ? error.reason : null,
    });
    if (errorCode === "API_AUTH_FAILED") console.error("[youtube-import] YOUTUBE_API_KEY recusada pela API (inválida, restrita ou API não habilitada).");
  }

  const record = await insertYoutubeImport({
    userId,
    videoId: parsed.videoId,
    urlKind: parsed.kind,
    originalUrl,
    normalizedUrl: parsed.normalizedUrl,
    availability: metadata?.availability ?? "UNKNOWN",
    metadataSource: metadata?.source ?? "none",
    title: metadata?.title ?? null,
    channelTitle: metadata?.channelTitle ?? null,
    channelId: metadata?.channelId ?? null,
    thumbnailUrl: metadata?.thumbnailUrl ?? null,
    youtubeDurationSeconds: metadata?.durationSeconds ?? null,
    embeddable: metadata?.embeddable ?? false,
    madeForKids: metadata?.madeForKids ?? null,
    regionRestricted: metadata?.regionRestricted ?? false,
    metadataFetchedAt: fetchedAt,
    errorCode,
    authorizedAt: now,
  });
  log("analyzed", {
    importId: record.id,
    userId,
    videoId: parsed.videoId,
    kind: parsed.kind,
    availability: record.availability,
    source: record.metadataSource,
    errorCode,
    executionMs: Date.now() - started,
  });
  return { record, duplicate: null };
}

/** O pathname escolhido pelo navegador para o upload direto — nunca confiar sem validar. */
export function parseYoutubeUploadPathname(pathname: string, userId: string): { importId: string } | null {
  const prefix = youtubeUploadPrefix(userId);
  if (!pathname.startsWith(prefix) || pathname.includes("..") || pathname.includes("\\")) return null;
  const rest = pathname.slice(prefix.length).split("/");
  if (rest.length !== 2 || !isUuid(rest[0]) || !/^[A-Za-z0-9._-]{1,80}$/.test(rest[1])) return null;
  return { importId: rest[0] };
}

/** Só blobs públicos da Vercel, dentro da pasta da importação do próprio usuário. */
export function isOwnYoutubeUploadUrl(url: string, userId: string, importId: string): { pathname: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    // Query/fragmento mudariam a string guardada e a limpeza (comparação exata de URL) não reconheceria o arquivo.
    if (parsed.search || parsed.hash || url.includes("?") || url.includes("#")) return null;
    if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    const owner = parseYoutubeUploadPathname(pathname, userId);
    if (!owner || owner.importId !== importId) return null;
    return { pathname };
  } catch {
    return null;
  }
}

/** Garante, antes de emitir o token de upload, que a importação é do usuário e ainda aceita arquivo. */
export async function assertImportAcceptsUpload(userId: string, importId: string): Promise<YoutubeImportRecord> {
  const record = isUuid(importId) ? await getYoutubeImportForUser(importId, userId) : null;
  if (!record) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.NOT_FOUND, "NOT_FOUND", 404);
  if (record.status !== "ANALYZED") throw new YoutubeImportError("Esta importação já tem um arquivo. Analise o link de novo para enviar outro.", "ALREADY_COMPLETED", 409);
  return record;
}

export interface RegisterUploadDeps {
  head?: (url: string) => Promise<{ size: number; contentType: string; pathname: string; url?: string }>;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  del?: (url: string) => Promise<unknown>;
  probe?: (buffer: Buffer, maxDurationSeconds: number) => Promise<ProbedMedia>;
}

/**
 * O arquivo já subiu direto do navegador para o Blob (token restrito à pasta
 * desta importação). Aqui: confere que o blob existe NO STORE DA ALILU (head
 * com a credencial do servidor), tamanho, tipo e o conteúdo real (ffprobe).
 * Qualquer falha apaga o arquivo enviado. Só então vira COMPLETED.
 */
export async function registerYoutubeUpload(
  userId: string,
  importId: string,
  input: { blobUrl: unknown; authorized: unknown },
  now: Date = new Date(),
  deps: RegisterUploadDeps = {},
): Promise<YoutubeImportRecord> {
  if (input.authorized !== true) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.AUTHORIZATION_REQUIRED, "AUTHORIZATION_REQUIRED", 400);
  if (!isUuid(importId)) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.NOT_FOUND, "NOT_FOUND", 404);
  const current = await getYoutubeImportForUser(importId, userId);
  if (!current) throw new YoutubeImportError(YOUTUBE_IMPORT_MESSAGES.NOT_FOUND, "NOT_FOUND", 404);
  const blobUrl = typeof input.blobUrl === "string" ? input.blobUrl : "";
  if (current.status === "COMPLETED" && current.fileUrl === blobUrl) return current;
  if (current.status !== "ANALYZED") {
    throw new YoutubeImportError("Esta importação já tem um arquivo. Analise o link de novo para enviar outro.", "ALREADY_COMPLETED", 409);
  }
  const owned = isOwnYoutubeUploadUrl(blobUrl, userId, importId);
  if (!owned) throw new YoutubeImportError("Envie o arquivo pela própria tela da Alilu.", "INVALID_UPLOAD", 400);

  const head = deps.head ?? (async (url: string) => headBlob(url));
  const fetchImpl = deps.fetchImpl ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const remove = deps.del ?? ((url: string) => deleteBlob(url));
  const probe = deps.probe ?? probeVideoBuffer;
  const discard = () => Promise.resolve(remove(blobUrl)).catch(() => undefined);

  const settings = await getImportSettings();
  const maxBytes = settings.maxImportedVideoSizeMb * 1024 * 1024;
  const maxSeconds = settings.maxImportedDurationMinutes * 60;
  const started = Date.now();
  const fail = async (code: string, message: string, status: number): Promise<never> => {
    await discard();
    log("upload_rejected", { importId, userId, errorCode: code, executionMs: Date.now() - started });
    throw new YoutubeImportError(message, code, status, { importId });
  };

  let info: { size: number; contentType: string; pathname: string; url?: string };
  try {
    info = await head(blobUrl);
  } catch {
    // Não existe no store da Alilu (ou o store está fora): não há o que apagar com segurança.
    log("upload_rejected", { importId, userId, errorCode: "UPLOAD_NOT_FOUND" });
    throw new YoutubeImportError("Não encontramos o arquivo enviado. Envie de novo.", "UPLOAD_NOT_FOUND", 400, { importId });
  }
  if (info.pathname !== owned.pathname) return fail("INVALID_UPLOAD", "Envie o arquivo pela própria tela da Alilu.", 400);
  // Guarda a URL canônica que o próprio Blob devolve (a mesma que a limpeza vê no list()).
  const canonicalUrl = info.url && isOwnYoutubeUploadUrl(info.url, userId, importId) ? info.url : blobUrl;
  const contentType = (info.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!(YOUTUBE_UPLOAD_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return fail("INVALID_FILE", YOUTUBE_IMPORT_MESSAGES.INVALID_FILE, 415);
  }
  if (info.size > maxBytes) {
    return fail("TOO_LARGE", `${YOUTUBE_IMPORT_MESSAGES.TOO_LARGE} O limite é ${settings.maxImportedVideoSizeMb} MB.`, 413);
  }

  let buffer: Buffer;
  try {
    const response = await fetchImpl(blobUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return fail("STORAGE_FAILED", YOUTUBE_IMPORT_MESSAGES.STORAGE_FAILED, 502);
  }
  if (buffer.length > maxBytes) return fail("TOO_LARGE", `${YOUTUBE_IMPORT_MESSAGES.TOO_LARGE} O limite é ${settings.maxImportedVideoSizeMb} MB.`, 413);

  let probed: ProbedMedia;
  try {
    probed = await probe(buffer, maxSeconds);
  } catch (error) {
    if (error instanceof InvalidMediaError && error.code === "TOO_LONG") {
      return fail("TOO_LONG", `${YOUTUBE_IMPORT_MESSAGES.TOO_LONG} O limite é ${settings.maxImportedDurationMinutes} minutos.`, 413);
    }
    return fail("INVALID_FILE", error instanceof InvalidMediaError ? error.message : YOUTUBE_IMPORT_MESSAGES.INVALID_FILE, 422);
  }
  if (probed.mediaType !== "VIDEO") return fail("INVALID_FILE", YOUTUBE_IMPORT_MESSAGES.INVALID_FILE, 422);

  const completed = await completeYoutubeImport(importId, userId, {
    fileUrl: canonicalUrl,
    storagePath: owned.pathname,
    contentType,
    fileSizeBytes: buffer.length,
    durationSeconds: probed.durationSeconds,
    width: probed.width,
    height: probed.height,
    videoCodec: probed.videoCodec,
    hasAudio: probed.hasAudio,
    durationMismatch: isDurationMismatch(probed.durationSeconds, current.youtubeDurationSeconds),
    completedAt: now,
  });
  if (!completed) {
    // Outro envio terminou primeiro: mantém o que já foi registrado e descarta este arquivo.
    await discard();
    const latest = await getYoutubeImportForUser(importId, userId);
    if (latest?.status === "COMPLETED") return latest;
    throw new YoutubeImportError("Esta importação já tem um arquivo.", "ALREADY_COMPLETED", 409);
  }
  log("uploaded", {
    importId,
    userId,
    videoId: completed.videoId,
    bytes: buffer.length,
    durationSeconds: probed.durationSeconds,
    durationMismatch: completed.durationMismatch,
    executionMs: Date.now() - started,
  });
  return completed;
}

/** Exclui o registro (só do próprio usuário) e o arquivo enviado. */
export async function deleteYoutubeImportWithFile(userId: string, importId: string, remove: (url: string) => Promise<unknown> = (url) => deleteBlob(url)): Promise<boolean> {
  if (!isUuid(importId)) return false;
  const removed = await deleteYoutubeImport(importId, userId);
  if (!removed) return false;
  if (removed.fileUrl) await Promise.resolve(remove(removed.fileUrl)).catch(() => undefined);
  log("deleted", { importId, userId });
  return true;
}
