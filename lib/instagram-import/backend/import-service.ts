import "server-only";
import { canUseImporter } from "@/lib/billing/backend/automation-access-service";
import { del as deleteBlob, put } from "@vercel/blob";
import {
  INSTAGRAM_IMPORT_ERROR_MESSAGES,
  parseInstagramUrl,
  type InstagramImportStatus,
} from "../url";
import { getInstagramImportProvider } from "./providers/provider-registry";
import { InstagramImportProviderError, type InstagramMediaItem } from "./providers/provider";
import { safeDownload, SafeDownloadError } from "./safe-download";
import { InvalidMediaError, probeImageBuffer, probeVideoBuffer, type ProbedMedia } from "./media-probe";
import {
  appendImportedCarouselItem,
  claimForImport,
  countProviderCallsSince,
  deleteImport,
  findCompletedImport,
  getImportForUser,
  getImportSettings,
  insertImport,
  updateImport,
  type InstagramImportRecord,
} from "./import-repository";

/**
 * "Importar do Instagram" — regra de negócio:
 *
 *   validar link (só instagram.com, /reel /p /tv) → declaração de
 *   autorização obrigatória → duplicidade → limite diário → provedor
 *   resolve (só público) → prévia (READY) → usuário confirma → download
 *   SEGURO (SSRF, tipo, tamanho, tempo) → validar conteúdo (ffprobe/imagem)
 *   → Blob do Alilu (a URL do provedor expira) → COMPLETED.
 *
 * Nunca pede nem guarda senha, cookie ou token do Instagram do usuário.
 * Importar NÃO custa créditos; o custo do provedor é só registrado.
 */

export class InstagramImportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "InstagramImportError";
  }
}

export const IMPORT_STORAGE_PREFIX = "videos/imports/";
export const importStoragePrefix = (userId: string) => `${IMPORT_STORAGE_PREFIX}${userId}/`;
export const manualUploadPrefix = (userId: string) => `${importStoragePrefix(userId)}manual/`;

export const IMPORT_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime"];
export const IMPORT_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function log(event: string, data: Record<string, unknown>): void {
  // Sem URLs com token, sem conteúdo do usuário — só metadados.
  console.info(JSON.stringify({ scope: "instagram-import", event, ...data }));
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const STATUS_BY_PROVIDER_ERROR: Record<string, InstagramImportStatus> = {
  INVALID_URL: "INVALID_URL",
  PRIVATE_CONTENT: "PRIVATE_CONTENT",
  NOT_FOUND: "PRIVATE_CONTENT",
  UNSUPPORTED: "UNSUPPORTED",
  PROVIDER_FAILED: "FAILED",
  NOT_CONFIGURED: "FAILED",
};

export interface ResolveResult {
  record: InstagramImportRecord | null;
  /** Já importado antes: a tela oferece "abrir existente" ou "importar novamente". */
  duplicate: InstagramImportRecord | null;
}

export interface InstagramImportQuota {
  /** Importações (consultas ao provedor) feitas hoje (UTC). */
  used: number;
  /** Limite diário para usuários comuns (configurável em /admin/instagram-import). */
  limit: number;
  /** Administrador (ADMIN_EMAILS): sem limite. */
  unlimited: boolean;
}

/**
 * Cota diária de importação. `isAdmin` vem SEMPRE da sessão no servidor
 * (isAdminEmail em lib/admin/admin-access.ts) — nunca do corpo da requisição.
 */
export async function getInstagramImportQuota(userId: string, isAdmin: boolean, now: Date = new Date()): Promise<InstagramImportQuota> {
  const [settings, used] = await Promise.all([getImportSettings(), countProviderCallsSince(userId, startOfUtcDay(now))]);
  return { used, limit: settings.maxImportsPerDay, unlimited: isAdmin };
}

export async function resolveInstagramLink(
  userId: string,
  input: { url: unknown; authorized: unknown; force?: unknown },
  now: Date = new Date(),
  access: { isAdmin?: boolean } = {},
): Promise<ResolveResult> {
  if (input.authorized !== true) {
    throw new InstagramImportError("Confirme que o conteúdo é seu ou que você tem autorização para usá-lo.", "AUTHORIZATION_REQUIRED", 400);
  }
  // Importador = recurso dos planos pagos. A regra é do servidor (a tela só mostra o convite); administradores passam.
  if (access.isAdmin !== true) {
    const gate = await canUseImporter(userId, now);
    if (!gate.allowed) {
      throw new InstagramImportError(gate.reason ?? "O importador de Instagram faz parte dos planos pagos.", "PLAN_REQUIRED", 402, {
        planCode: gate.code,
      });
    }
  }
  const originalUrl = typeof input.url === "string" ? input.url.trim() : "";
  const parsed = parseInstagramUrl(originalUrl);
  if (!parsed.ok) {
    await insertImport({
      userId,
      originalUrl: originalUrl || "(vazio)",
      normalizedUrl: originalUrl.slice(0, 2048) || "(vazio)",
      urlKind: "unknown",
      shortcode: null,
      status: parsed.code,
      provider: "none",
      errorCode: parsed.code,
      errorMessage: parsed.message,
      authorizedAt: now,
    });
    throw new InstagramImportError(parsed.message, parsed.code, 400);
  }

  if (input.force !== true) {
    const existing = await findCompletedImport(userId, parsed.normalizedUrl);
    if (existing) return { record: null, duplicate: existing };
  }

  const settings = await getImportSettings();
  const quota = await getInstagramImportQuota(userId, access.isAdmin === true, now);
  if (quota.used >= quota.limit) {
    if (!quota.unlimited) {
      throw new InstagramImportError(
        `Você atingiu o limite de ${quota.limit} importações do Instagram por hoje. Tente novamente amanhã.`,
        "DAILY_LIMIT",
        429,
      );
    }
    // A importação continua sendo registrada normalmente; só não bloqueia.
    console.info(JSON.stringify({ scope: "instagram-import", event: "Instagram import limit bypassed for admin user" }));
  }

  const provider = getInstagramImportProvider();
  const record = await insertImport({
    userId,
    originalUrl,
    normalizedUrl: parsed.normalizedUrl,
    urlKind: parsed.kind,
    shortcode: parsed.shortcode,
    status: "RESOLVING",
    provider: provider.id,
    authorizedAt: now,
  });

  const started = Date.now();
  try {
    const result = await provider.resolve(parsed.normalizedUrl);
    const first = result.items[0];
    const updated = await updateImport(record.id, {
      status: "READY",
      providerRequestId: result.requestId,
      resolvedItems: result.items,
      selectedIndex: 0,
      mediaType: first.mediaType,
      thumbnailUrl: first.thumbnailUrl ?? (first.mediaType === "IMAGE" ? first.mediaUrl : null),
      durationSeconds: result.durationSeconds,
      width: result.width,
      height: result.height,
      providerCostUsd: settings.providerCostUsd,
      executionMs: Date.now() - started,
    });
    log("resolved", { importId: record.id, userId, provider: provider.id, mediaType: first.mediaType, items: result.items.length, executionMs: Date.now() - started });
    return { record: updated, duplicate: null };
  } catch (error) {
    const providerError =
      error instanceof InstagramImportProviderError
        ? error
        : new InstagramImportProviderError(INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED, "PROVIDER_FAILED", true);
    const status = STATUS_BY_PROVIDER_ERROR[providerError.code] ?? "FAILED";
    await updateImport(record.id, {
      status,
      errorCode: providerError.code,
      errorMessage: providerError.message,
      // Pedido inválido de formato/configuração não chega a ser cobrado; os demais contam como execução.
      providerCostUsd: providerError.code === "NOT_CONFIGURED" ? 0 : settings.providerCostUsd,
      executionMs: Date.now() - started,
    });
    log("resolve_failed", { importId: record.id, userId, provider: provider.id, status, errorCode: providerError.code, httpStatus: providerError.httpStatus, executionMs: Date.now() - started });
    if (providerError.code === "NOT_CONFIGURED") console.error("[instagram-import] provedor não configurado (APIFY_TOKEN)");
    throw new InstagramImportError(
      status === "FAILED" ? INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED : providerError.message,
      status,
      status === "FAILED" ? 502 : 422,
      { importId: record.id, manualUpload: true },
    );
  }
}

function extensionFor(contentType: string, mediaType: "VIDEO" | "IMAGE"): string {
  if (contentType === "video/quicktime") return "mov";
  if (mediaType === "VIDEO") return "mp4";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function validateMedia(buffer: Buffer, mediaType: "VIDEO" | "IMAGE", maxDurationSeconds: number): Promise<ProbedMedia> {
  return mediaType === "VIDEO" ? probeVideoBuffer(buffer, maxDurationSeconds) : probeImageBuffer(buffer);
}

const DOWNLOAD_ERROR_MESSAGE: Record<SafeDownloadError["code"], string> = {
  BLOCKED_URL: "Não conseguimos importar agora. Tente novamente ou faça upload manual.",
  TOO_LARGE: "O arquivo é grande demais para importar.",
  BAD_CONTENT_TYPE: "Esse formato ainda não é suportado.",
  HTTP_ERROR: "O link temporário do conteúdo expirou. Cole o link de novo para importar.",
  TIMEOUT: "O download demorou demais. Tente novamente ou faça upload manual.",
  INTERRUPTED: "O download foi interrompido. Tente novamente ou faça upload manual.",
};

/** "Importar para o Alilu": baixa (seguro), valida e guarda no Blob. */
export async function importResolvedMedia(
  userId: string,
  importId: string,
  input: { itemIndex?: unknown },
  now: Date = new Date(),
): Promise<InstagramImportRecord> {
  const current = await getImportForUser(importId, userId);
  if (!current) throw new InstagramImportError("Importação não encontrada.", "NOT_FOUND", 404);
  if (current.status === "COMPLETED") return current;
  if (current.status === "IMPORTING") throw new InstagramImportError("Este conteúdo já está sendo importado.", "IMPORT_IN_PROGRESS", 409);
  if (current.status !== "READY") throw new InstagramImportError("Este conteúdo não pode mais ser importado. Cole o link de novo.", "NOT_READY", 409);

  const index = Number.isInteger(input.itemIndex) ? Number(input.itemIndex) : 0;
  const item: InstagramMediaItem | undefined = current.resolvedItems[index];
  if (!item) throw new InstagramImportError("Item inválido.", "INVALID_ITEM", 400);

  const claimed = await claimForImport(importId, userId, index);
  if (!claimed) throw new InstagramImportError("Este conteúdo já está sendo importado.", "IMPORT_IN_PROGRESS", 409);

  const settings = await getImportSettings();
  const started = Date.now();
  const fail = async (code: string, message: string) => {
    await updateImport(importId, { status: "FAILED", errorCode: code, errorMessage: message, executionMs: Date.now() - started });
    log("import_failed", { importId, userId, provider: current.provider, mediaType: item.mediaType, errorCode: code, executionMs: Date.now() - started });
    throw new InstagramImportError(message, code, code === "TOO_LARGE" || code === "TOO_LONG" ? 413 : 422, { importId, manualUpload: true });
  };

  let downloaded;
  try {
    downloaded = await safeDownload(item.mediaUrl, {
      maxBytes: settings.maxImportedVideoSizeMb * 1024 * 1024,
      allowedContentTypes:
        item.mediaType === "VIDEO" ? [...IMPORT_VIDEO_CONTENT_TYPES, "application/octet-stream"] : [...IMPORT_IMAGE_CONTENT_TYPES, "application/octet-stream"],
      timeoutMs: 50_000,
    });
  } catch (error) {
    if (error instanceof SafeDownloadError) return fail(error.code, DOWNLOAD_ERROR_MESSAGE[error.code]);
    return fail("DOWNLOAD_FAILED", INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED);
  }

  let probe: ProbedMedia;
  try {
    probe = await validateMedia(downloaded.buffer, item.mediaType, settings.maxImportedDurationMinutes * 60);
  } catch (error) {
    if (error instanceof InvalidMediaError) return fail(error.code, error.message);
    return fail("INVALID_MEDIA", "O arquivo baixado não é um vídeo/imagem válido.");
  }

  const contentType =
    downloaded.contentType === "application/octet-stream" ? (item.mediaType === "VIDEO" ? "video/mp4" : "image/jpeg") : downloaded.contentType;
  let blob;
  try {
    blob = await put(`${importStoragePrefix(userId)}${importId}.${extensionFor(contentType, item.mediaType)}`, downloaded.buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
  } catch {
    return fail("STORAGE_FAILED", INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED);
  }

  const completed = await updateImport(importId, {
    status: "COMPLETED",
    mediaType: probe.mediaType,
    importedFileUrl: blob.url,
    storagePath: blob.pathname,
    contentType,
    fileSizeBytes: downloaded.buffer.length,
    durationSeconds: probe.durationSeconds,
    width: probe.width,
    height: probe.height,
    videoCodec: probe.videoCodec,
    hasAudio: probe.hasAudio,
    // Só a URL do Alilu fica guardada; as temporárias do provedor são descartadas.
    resolvedItems: [],
    // Importou um item só: itens de carrossel parciais (se houver) deixam de valer.
    importedItems: [],
    errorCode: null,
    errorMessage: null,
    executionMs: Date.now() - started,
    completedAt: now,
  });
  log("imported", {
    importId,
    userId,
    provider: current.provider,
    mediaType: probe.mediaType,
    durationSeconds: probe.durationSeconds,
    downloadBytes: downloaded.buffer.length,
    executionMs: Date.now() - started,
    status: "COMPLETED",
  });
  return completed!;
}

/** Máximo de itens que um carrossel do Instagram pode ter (e que a Meta aceita publicar). */
export const MAX_CAROUSEL_IMPORT_ITEMS = 10;

/** Foto do carrossel em PNG/WebP vira JPEG (a publicação de carrossel da Meta só aceita JPEG). */
async function toJpeg(buffer: Buffer): Promise<Buffer> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, image.width, image.height);
  context.drawImage(image, 0, 0);
  return canvas.toBuffer("image/jpeg", 92);
}

/**
 * Carrossel: importa UM item (o cliente chama item por item, em sequência,
 * para cada chamada caber no tempo da function). Idempotente por índice.
 * Quando todos os itens estiverem guardados, a importação vira COMPLETED.
 * Falha de um item NÃO derruba a importação: a tela oferece tentar de novo
 * ou seguir sem ele (finishCarouselImport).
 */
export async function importCarouselItem(userId: string, importId: string, input: { itemIndex?: unknown }): Promise<InstagramImportRecord> {
  const current = await getImportForUser(importId, userId);
  if (!current) throw new InstagramImportError("Importação não encontrada.", "NOT_FOUND", 404);
  if (current.status === "COMPLETED") return current;
  if (current.status !== "READY") throw new InstagramImportError("Este conteúdo não pode mais ser importado. Cole o link de novo.", "NOT_READY", 409);
  if (current.resolvedItems.length < 2) throw new InstagramImportError("Este link não é um carrossel.", "NOT_CAROUSEL", 400);

  const index = Number.isInteger(input.itemIndex) ? Number(input.itemIndex) : -1;
  const item = current.resolvedItems[index];
  if (!item || index >= MAX_CAROUSEL_IMPORT_ITEMS) throw new InstagramImportError("Item inválido.", "INVALID_ITEM", 400);
  if (current.importedItems.some((existing) => existing.index === index)) return current;

  const settings = await getImportSettings();
  const started = Date.now();
  const itemError = (code: string, message: string) => {
    log("carousel_item_failed", { importId, userId, index, mediaType: item.mediaType, errorCode: code, executionMs: Date.now() - started });
    return new InstagramImportError(message, code, code === "TOO_LARGE" || code === "TOO_LONG" ? 413 : 422, { importId, itemIndex: index });
  };

  let downloaded;
  try {
    downloaded = await safeDownload(item.mediaUrl, {
      maxBytes: settings.maxImportedVideoSizeMb * 1024 * 1024,
      allowedContentTypes:
        item.mediaType === "VIDEO" ? [...IMPORT_VIDEO_CONTENT_TYPES, "application/octet-stream"] : [...IMPORT_IMAGE_CONTENT_TYPES, "application/octet-stream"],
      timeoutMs: 50_000,
    });
  } catch (error) {
    if (error instanceof SafeDownloadError) throw itemError(error.code, DOWNLOAD_ERROR_MESSAGE[error.code]);
    throw itemError("DOWNLOAD_FAILED", INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED);
  }

  let probe: ProbedMedia;
  try {
    probe = await validateMedia(downloaded.buffer, item.mediaType, settings.maxImportedDurationMinutes * 60);
  } catch (error) {
    if (error instanceof InvalidMediaError) throw itemError(error.code, error.message);
    throw itemError("INVALID_MEDIA", "O arquivo baixado não é um vídeo/imagem válido.");
  }

  let buffer = downloaded.buffer;
  let contentType =
    downloaded.contentType === "application/octet-stream" ? (item.mediaType === "VIDEO" ? "video/mp4" : "image/jpeg") : downloaded.contentType;
  if (probe.mediaType === "IMAGE" && contentType !== "image/jpeg") {
    try {
      buffer = await toJpeg(buffer);
      contentType = "image/jpeg";
    } catch {
      throw itemError("INVALID_MEDIA", "Não foi possível preparar uma das fotos do carrossel.");
    }
  }

  let blob;
  try {
    blob = await put(`${importStoragePrefix(userId)}${importId}-${index + 1}.${extensionFor(contentType, probe.mediaType)}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
  } catch {
    throw itemError("STORAGE_FAILED", INSTAGRAM_IMPORT_ERROR_MESSAGES.PROVIDER_FAILED);
  }

  const appended = await appendImportedCarouselItem(importId, userId, {
    index,
    mediaType: probe.mediaType,
    fileUrl: blob.url,
    storagePath: blob.pathname,
    contentType,
    fileSizeBytes: buffer.length,
    durationSeconds: probe.durationSeconds,
    width: probe.width,
    height: probe.height,
    hasAudio: probe.hasAudio,
  });
  if (!appended) {
    // Outra aba guardou o mesmo item primeiro: descarta a cópia duplicada.
    await deleteBlob(blob.url).catch(() => undefined);
    return (await getImportForUser(importId, userId)) ?? current;
  }
  log("carousel_item_imported", { importId, userId, index, mediaType: probe.mediaType, bytes: buffer.length, executionMs: Date.now() - started });

  const total = Math.min(appended.resolvedItems.length, MAX_CAROUSEL_IMPORT_ITEMS);
  if (appended.importedItems.length >= total) return finishCarouselImport(userId, importId);
  return appended;
}

/** Fecha o carrossel com os itens já guardados (todos, ou "seguir sem os que falharam"). */
export async function finishCarouselImport(userId: string, importId: string, now: Date = new Date()): Promise<InstagramImportRecord> {
  const current = await getImportForUser(importId, userId);
  if (!current) throw new InstagramImportError("Importação não encontrada.", "NOT_FOUND", 404);
  if (current.status === "COMPLETED") return current;
  const first = current.importedItems[0];
  if (current.status !== "READY" || !first) throw new InstagramImportError("Nenhum item do carrossel foi importado ainda.", "NOTHING_IMPORTED", 409);
  const completed = await updateImport(importId, {
    status: "COMPLETED",
    mediaType: first.mediaType,
    importedFileUrl: first.fileUrl,
    storagePath: first.storagePath,
    contentType: first.contentType,
    fileSizeBytes: current.importedItems.reduce((sum, item) => sum + item.fileSizeBytes, 0),
    durationSeconds: first.durationSeconds,
    width: first.width,
    height: first.height,
    hasAudio: first.hasAudio,
    resolvedItems: [],
    errorCode: null,
    errorMessage: null,
    completedAt: now,
  });
  log("carousel_imported", { importId, userId, items: current.importedItems.length });
  return completed!;
}

function isOwnManualUploadUrl(url: string, userId: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return pathname.startsWith(manualUploadPrefix(userId)) && !pathname.includes("..");
  } catch {
    return false;
  }
}

/** Fallback "Fazer upload do vídeo": o arquivo já subiu direto para o Blob; aqui só validamos e registramos. */
export async function registerManualUpload(
  userId: string,
  input: { blobUrl: unknown; pathname?: unknown; authorized: unknown; originalUrl?: unknown },
  now: Date = new Date(),
): Promise<InstagramImportRecord> {
  if (input.authorized !== true) {
    throw new InstagramImportError("Confirme que o conteúdo é seu ou que você tem autorização para usá-lo.", "AUTHORIZATION_REQUIRED", 400);
  }
  const blobUrl = typeof input.blobUrl === "string" ? input.blobUrl : "";
  if (!isOwnManualUploadUrl(blobUrl, userId)) throw new InstagramImportError("Envie o arquivo pela própria tela.", "INVALID_UPLOAD", 400);
  const settings = await getImportSettings();
  const started = Date.now();

  const response = await fetch(blobUrl);
  if (!response.ok) throw new InstagramImportError("Não foi possível ler o arquivo enviado.", "INVALID_UPLOAD", 400);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const mediaType = contentType.startsWith("image/") ? "IMAGE" : "VIDEO";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > settings.maxImportedVideoSizeMb * 1024 * 1024) {
    await deleteBlob(blobUrl).catch(() => undefined);
    throw new InstagramImportError("O arquivo é grande demais para importar.", "TOO_LARGE", 413);
  }
  let probe: ProbedMedia;
  try {
    probe = await validateMedia(buffer, mediaType, settings.maxImportedDurationMinutes * 60);
  } catch (error) {
    await deleteBlob(blobUrl).catch(() => undefined);
    if (error instanceof InvalidMediaError) throw new InstagramImportError(error.message, error.code, 422);
    throw new InstagramImportError("O arquivo não é um vídeo/imagem válido.", "INVALID_MEDIA", 422);
  }

  const original = typeof input.originalUrl === "string" ? parseInstagramUrl(input.originalUrl) : null;
  const record = await insertImport({
    userId,
    originalUrl: original?.ok ? (input.originalUrl as string) : "upload manual",
    normalizedUrl: original?.ok ? original.normalizedUrl : `manual:${blobUrl}`,
    urlKind: "manual",
    shortcode: original?.ok ? original.shortcode : null,
    status: "PENDING",
    provider: "manual",
    authorizedAt: now,
  });
  const completed = await updateImport(record.id, {
    status: "COMPLETED",
    mediaType: probe.mediaType,
    importedFileUrl: blobUrl,
    storagePath: new URL(blobUrl).pathname.replace(/^\//, ""),
    contentType,
    fileSizeBytes: buffer.length,
    durationSeconds: probe.durationSeconds,
    width: probe.width,
    height: probe.height,
    videoCodec: probe.videoCodec,
    hasAudio: probe.hasAudio,
    executionMs: Date.now() - started,
    completedAt: now,
  });
  log("manual_upload", { importId: record.id, userId, mediaType: probe.mediaType, downloadBytes: buffer.length, executionMs: Date.now() - started });
  return completed!;
}

/** Exclui o registro e o arquivo guardado. */
export async function deleteInstagramImport(userId: string, importId: string): Promise<boolean> {
  const removed = await deleteImport(importId, userId);
  if (!removed) return false;
  const urls = new Set([removed.importedFileUrl, ...removed.importedItems.map((item) => item.fileUrl)].filter((url): url is string => Boolean(url)));
  for (const url of urls) await deleteBlob(url).catch(() => undefined);
  log("deleted", { importId, userId });
  return true;
}
