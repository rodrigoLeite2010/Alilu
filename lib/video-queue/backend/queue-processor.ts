import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { getImportForUser, getImportSettings } from "@/lib/instagram-import/backend/import-repository";
import {
  IMPORT_VIDEO_CONTENT_TYPES,
  InstagramImportError,
  importResolvedMedia,
  resolveInstagramLink,
} from "@/lib/instagram-import/backend/import-service";
import { InvalidMediaError, probeVideoBuffer, type ProbedMedia } from "@/lib/instagram-import/backend/media-probe";
import { SafeDownloadError, safeDownload } from "@/lib/instagram-import/backend/safe-download";
import { validateFacebookReelSpecs } from "@/lib/facebook/facebook-media-rules";
import { parseQueueLink, waitingFileMessage } from "@/lib/video-queue/links";
import {
  claimNextItemForImport,
  countInFlightItems,
  findDuplicateFileForAccount,
  getQueueProcessingOptions,
  getUserEmail,
  insertEvent,
  markItemOutcome,
  markItemReady,
  setItemInstagramImport,
  setItemStage,
  type VideoQueueItemRecord,
} from "./queue-repository";
import { extractThumbnailJpeg } from "./thumbnail";
import { renderReframe } from "./reframe-runner";
import { planReframe } from "@/lib/video-queue/reframe";

/**
 * Worker de importação da fila. Processa UM item por vez (o cron chama em
 * sequência, dentro do orçamento de tempo) com claim atômico e lock com
 * expiração: dois crons simultâneos nunca pegam o mesmo item, e um item
 * cujo worker morreu (timeout da função, reinício) é retomado depois que o
 * lock expira — o arquivo vai sempre para o MESMO caminho no Blob, então a
 * retomada sobrescreve em vez de duplicar.
 *
 * Reaproveita o que já existe:
 *   - download seguro (SSRF, DNS rebinding, tipo, tamanho, tempo) e
 *     validação real com ffprobe do importador do Instagram;
 *   - limites de tamanho/duração de /admin/instagram-import;
 *   - para links do Instagram, o próprio importador (provedor autorizado,
 *     plano pago, cota diária e declaração de direitos).
 * Nada de YouTube/TikTok/outras plataformas é baixado: o item fica
 * aguardando o arquivo autorizado.
 */

export const IMPORT_LOCK_TTL_SECONDS = 5 * 60;
export const MAX_IMPORT_ATTEMPTS = 3;
/** Espera antes da 2ª e da 3ª tentativa após falha temporária. */
export const IMPORT_BACKOFF_MINUTES = [5, 15, 60];
export const QUEUE_STORAGE_PREFIX = "video-queue/";
export const queueStoragePrefix = (userId: string) => `${QUEUE_STORAGE_PREFIX}${userId}/`;
export const queueUploadPrefix = (userId: string) => `${queueStoragePrefix(userId)}uploads/`;

const DOWNLOAD_TIMEOUT_MS = 50_000;
const VIDEO_CONTENT_TYPES = [...IMPORT_VIDEO_CONTENT_TYPES, "application/octet-stream"];

function log(event: string, data: Record<string, unknown>): void {
  console.info(JSON.stringify({ scope: "video-queue", event, ...data }));
}

/** Falha que já sabe o que fazer com o item. */
class ItemFailure extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly kind: "permanent" | "transient" | "waiting_file",
    readonly extra: { nextAttemptAt?: Date; resetAttempts?: boolean; clearInstagramImport?: boolean } = {},
  ) {
    super(message);
    this.name = "ItemFailure";
  }
}

export interface ProcessItemResult {
  itemId: string;
  queueId: string;
  status: VideoQueueItemRecord["status"];
  code?: string;
}

function downloadFailure(error: SafeDownloadError): ItemFailure {
  switch (error.code) {
    case "BLOCKED_URL":
      return new ItemFailure("Endereço bloqueado por segurança (rede interna, porta ou redirecionamento não permitido).", "BLOCKED_URL", "permanent");
    case "TOO_LARGE":
      return new ItemFailure("O vídeo é grande demais para importar.", "TOO_LARGE", "permanent");
    case "BAD_CONTENT_TYPE":
      return new ItemFailure(
        "O link não aponta para um arquivo de vídeo (MP4/MOV) — pode ser uma página. Envie o arquivo do vídeo.",
        "NOT_A_VIDEO_FILE",
        "waiting_file",
      );
    case "HTTP_ERROR": {
      const status = error.httpStatus ?? 0;
      if (status === 429 || status >= 500) return new ItemFailure("O servidor do vídeo não respondeu agora. Nova tentativa em breve.", "HTTP_TRANSIENT", "transient");
      return new ItemFailure(`Vídeo indisponível no endereço informado (HTTP ${status || "erro"}).`, "UNAVAILABLE", "permanent");
    }
    case "TIMEOUT":
      return new ItemFailure("O download demorou demais. Nova tentativa em breve.", "TIMEOUT", "transient");
    case "INTERRUPTED":
    default:
      return new ItemFailure("O download foi interrompido. Nova tentativa em breve.", "INTERRUPTED", "transient");
  }
}

async function downloadVideo(url: string, maxBytes: number): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const result = await safeDownload(url, { maxBytes, allowedContentTypes: VIDEO_CONTENT_TYPES, timeoutMs: DOWNLOAD_TIMEOUT_MS });
    return { buffer: result.buffer, contentType: result.contentType };
  } catch (error) {
    if (error instanceof SafeDownloadError) throw downloadFailure(error);
    throw new ItemFailure("Não foi possível acessar o endereço do vídeo. Nova tentativa em breve.", "NETWORK", "transient");
  }
}

async function probe(buffer: Buffer, maxDurationSeconds: number): Promise<ProbedMedia> {
  try {
    return await probeVideoBuffer(buffer, maxDurationSeconds);
  } catch (error) {
    if (error instanceof InvalidMediaError) throw new ItemFailure(error.message, error.code, "permanent");
    throw new ItemFailure("O arquivo não é um vídeo válido.", "INVALID_MEDIA", "permanent");
  }
}

function nextUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5));
}

/** Obtém o arquivo de um link do Instagram pelo importador existente e devolve a URL do arquivo no Alilu. */
async function importFromInstagram(item: VideoQueueItemRecord, lockToken: string, now: Date): Promise<string> {
  const email = await getUserEmail(item.userId);
  const isAdmin = isAdminEmail(email);
  let record = item.instagramImportId ? await getImportForUser(item.instagramImportId, item.userId) : null;
  if (record && !["READY", "COMPLETED"].includes(record.status)) record = null;

  if (!record) {
    try {
      // A declaração de direitos foi feita ao criar a fila/adicionar os links (authorized_at do item).
      const resolved = await resolveInstagramLink(item.userId, { url: item.sourceUrl, authorized: true }, now, { isAdmin });
      record = resolved.duplicate ?? resolved.record;
    } catch (error) {
      if (error instanceof InstagramImportError) {
        if (error.code === "DAILY_LIMIT") {
          throw new ItemFailure(`${error.message} O vídeo será importado automaticamente amanhã.`, "DAILY_LIMIT", "transient", {
            nextAttemptAt: nextUtcDay(now),
            resetAttempts: true,
          });
        }
        if (error.code === "PLAN_REQUIRED") {
          throw new ItemFailure("A importação de links do Instagram faz parte dos planos pagos. Envie o arquivo do vídeo para continuar.", "PLAN_REQUIRED", "waiting_file");
        }
        if (["INVALID_URL", "UNSUPPORTED", "PRIVATE_CONTENT"].includes(error.code)) {
          throw new ItemFailure(`${error.message} Envie o arquivo autorizado para continuar.`, error.code, "waiting_file");
        }
        throw new ItemFailure("O importador do Instagram não respondeu agora. Nova tentativa em breve.", error.code, "transient");
      }
      throw new ItemFailure("O importador do Instagram não respondeu agora. Nova tentativa em breve.", "PROVIDER_FAILED", "transient");
    }
    if (!record) throw new ItemFailure("O importador do Instagram não respondeu agora. Nova tentativa em breve.", "PROVIDER_FAILED", "transient");
    await setItemInstagramImport(item.id, lockToken, record.id);
  }

  if (record.status === "READY") {
    const index = record.resolvedItems.findIndex((media) => media.mediaType === "VIDEO");
    if (index < 0) throw new ItemFailure("Esse link do Instagram não tem vídeo (é uma imagem).", "NOT_A_VIDEO", "permanent");
    try {
      record = await importResolvedMedia(item.userId, record.id, { itemIndex: index }, now);
    } catch (error) {
      const code = error instanceof InstagramImportError ? error.code : "IMPORT_FAILED";
      if (["TOO_LARGE", "TOO_LONG", "INVALID_MEDIA", "BAD_CONTENT_TYPE"].includes(code)) {
        throw new ItemFailure((error as Error).message, code, "permanent");
      }
      // Link temporário expirado, download interrompido etc.: a próxima tentativa consulta o provedor de novo.
      throw new ItemFailure("Não foi possível baixar o vídeo do Instagram agora. Nova tentativa em breve.", code, "transient", { clearInstagramImport: true });
    }
  }

  if (record.status !== "COMPLETED" || !record.importedFileUrl) {
    throw new ItemFailure("O importador do Instagram não concluiu a importação. Nova tentativa em breve.", "IMPORT_INCOMPLETE", "transient", { clearInstagramImport: true });
  }
  if (record.mediaType !== "VIDEO") throw new ItemFailure("Esse link do Instagram não tem vídeo (é uma imagem).", "NOT_A_VIDEO", "permanent");
  return record.importedFileUrl;
}

async function importItem(item: VideoQueueItemRecord, lockToken: string, now: Date): Promise<void> {
  // Plataformas sem download autorizado: nada é baixado.
  if (item.sourceKind === "YOUTUBE" || item.sourceKind === "TIKTOK" || item.sourceKind === "OTHER_PLATFORM") {
    const parsed = parseQueueLink(item.sourceUrl);
    throw new ItemFailure(waitingFileMessage(item.sourceKind, parsed.ok ? parsed.link.platform : null), "AUTHORIZED_FILE_REQUIRED", "waiting_file");
  }

  const settings = await getImportSettings();
  const maxBytes = settings.maxImportedVideoSizeMb * 1024 * 1024;
  const maxDurationSeconds = settings.maxImportedDurationMinutes * 60;

  await setItemStage(item.id, lockToken, "IMPORTING");
  let sourceUrl: string;
  if (item.sourceKind === "UPLOAD") {
    if (!item.blobUrl) throw new ItemFailure("Envie o arquivo do vídeo para continuar.", "AUTHORIZED_FILE_REQUIRED", "waiting_file");
    sourceUrl = item.blobUrl;
  } else if (item.sourceKind === "INSTAGRAM") {
    sourceUrl = await importFromInstagram(item, lockToken, now);
  } else {
    sourceUrl = item.sourceUrl;
  }
  const downloaded = await downloadVideo(sourceUrl, maxBytes);

  await setItemStage(item.id, lockToken, "PROCESSING");
  let probed = await probe(downloaded.buffer, maxDurationSeconds);
  let contentType = downloaded.contentType === "video/quicktime" ? "video/quicktime" : "video/mp4";
  const extension = contentType === "video/quicktime" ? "mov" : "mp4";
  const base = `${queueStoragePrefix(item.userId)}${item.queueId}/${item.id}`;

  // Opções da fila (padrão neutro: filas existentes não mudam de comportamento).
  const options = await getQueueProcessingOptions(item.queueId);
  const contentSha256 = createHash("sha256").update(downloaded.buffer).digest("hex");
  if (options?.blockDuplicateFiles) {
    const duplicate = await findDuplicateFileForAccount(item.userId, options.instagramAccountId, contentSha256, item.id);
    if (duplicate) throw new ItemFailure("Este mesmo arquivo de vídeo já foi usado nesta conta do Instagram (duplicado).", "DUPLICATE_FILE", "permanent");
  }

  // Adaptação 9:16 / duração (opcional): o ORIGINAL é preservado em outro arquivo.
  let finalBuffer = downloaded.buffer;
  let originalBlobUrl: string | null = null;
  let statusMessage: string | null = null;
  const plan = options ? planReframe(probed, { mode: options.reframeMode, maxDurationSeconds: options.maxDurationSeconds }) : null;
  if (plan) {
    const rendered = await renderReframe(downloaded.buffer, plan);
    let renderedProbe: ProbedMedia | null = null;
    if (rendered) {
      try {
        renderedProbe = await probeVideoBuffer(rendered, maxDurationSeconds);
      } catch {
        renderedProbe = null;
      }
    }
    if (rendered && renderedProbe) {
      if (item.sourceKind === "UPLOAD") {
        originalBlobUrl = item.blobUrl;
      } else {
        try {
          originalBlobUrl = (await put(`${base}-original.${extension}`, downloaded.buffer, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType })).url;
        } catch {
          throw new ItemFailure("Falha ao guardar o vídeo. Nova tentativa em breve.", "STORAGE_FAILED", "transient");
        }
      }
      finalBuffer = rendered;
      probed = renderedProbe;
      contentType = "video/mp4";
      statusMessage = `Adaptado para Reels: ${plan.reasons.join(", ")}.`;
    } else {
      statusMessage = "Não foi possível adaptar para 9:16 agora; o vídeo segue no formato original.";
    }
  }

  let blobUrl = item.blobUrl;
  let blobPath = item.blobPath;
  if (item.sourceKind !== "UPLOAD" || finalBuffer !== downloaded.buffer) {
    const target = finalBuffer !== downloaded.buffer ? `${base}.mp4` : `${base}.${extension}`;
    try {
      const stored = await put(target, finalBuffer, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType });
      blobUrl = stored.url;
      blobPath = stored.pathname;
    } catch {
      throw new ItemFailure("Falha ao guardar o vídeo. Nova tentativa em breve.", "STORAGE_FAILED", "transient");
    }
  }

  let thumbnailUrl: string | null = null;
  const jpeg = await extractThumbnailJpeg(finalBuffer, probed.durationSeconds);
  if (jpeg) {
    try {
      thumbnailUrl = (await put(`${base}-thumb.jpg`, jpeg, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg" })).url;
    } catch {
      thumbnailUrl = null;
    }
  }

  const facebookIncompatibleReason = validateFacebookReelSpecs({
    hasVideo: true,
    width: probed.width,
    height: probed.height,
    durationSeconds: probed.durationSeconds,
    videoCodec: probed.videoCodec,
  });

  await markItemReady(item.id, lockToken, {
    blobUrl: blobUrl!,
    blobPath: blobPath ?? new URL(blobUrl!).pathname.replace(/^\//, ""),
    thumbnailUrl,
    contentType,
    fileSizeBytes: finalBuffer.length,
    durationSeconds: probed.durationSeconds,
    width: probed.width,
    height: probed.height,
    videoCodec: probed.videoCodec,
    hasAudio: probed.hasAudio,
    facebookIncompatibleReason,
    contentSha256,
    originalBlobUrl,
    statusMessage,
  });
}

/** Processa um item já com claim. Nunca lança: o resultado fica gravado no item. */
export async function processClaimedItem(item: VideoQueueItemRecord, lockToken: string, now: Date = new Date()): Promise<ProcessItemResult> {
  const started = Date.now();
  // Worker morreu várias vezes neste item (lock expirado repetidamente): para de tentar.
  if (item.attemptsCount > MAX_IMPORT_ATTEMPTS) {
    await markItemOutcome(item.id, lockToken, {
      status: "ERROR",
      code: "TOO_MANY_ATTEMPTS",
      message: "Não foi possível importar depois de várias tentativas. Use \"Reprocessar\" ou envie o arquivo.",
    });
    await insertEvent(item.queueId, item.id, "import_failed", "Várias tentativas sem sucesso.");
    return { itemId: item.id, queueId: item.queueId, status: "ERROR", code: "TOO_MANY_ATTEMPTS" };
  }

  try {
    await importItem(item, lockToken, now);
    await insertEvent(item.queueId, item.id, "imported", "Vídeo importado e pronto para publicação.");
    log("imported", { itemId: item.id, queueId: item.queueId, kind: item.sourceKind, ms: Date.now() - started });
    return { itemId: item.id, queueId: item.queueId, status: "READY" };
  } catch (error) {
    const failure =
      error instanceof ItemFailure ? error : new ItemFailure("Falha inesperada ao importar. Nova tentativa em breve.", "UNEXPECTED", "transient");
    let status: "ERROR" | "WAITING_FILE" | "PENDING";
    let nextAttemptAt: Date | null = null;
    if (failure.kind === "waiting_file") status = "WAITING_FILE";
    else if (failure.kind === "permanent") status = "ERROR";
    else if (failure.extra.nextAttemptAt) {
      status = "PENDING";
      nextAttemptAt = failure.extra.nextAttemptAt;
    } else if (item.attemptsCount < MAX_IMPORT_ATTEMPTS) {
      status = "PENDING";
      const minutes = IMPORT_BACKOFF_MINUTES[Math.min(item.attemptsCount - 1, IMPORT_BACKOFF_MINUTES.length - 1)];
      nextAttemptAt = new Date(now.getTime() + minutes * 60_000);
    } else {
      status = "ERROR";
    }
    const message = status === "ERROR" && failure.kind === "transient" ? `${failure.message.replace(/ Nova tentativa em breve\.$/, "")} (tentativas esgotadas)` : failure.message;
    await markItemOutcome(item.id, lockToken, {
      status,
      message,
      code: failure.code,
      nextAttemptAt,
      resetAttempts: failure.extra.resetAttempts,
      clearInstagramImport: failure.extra.clearInstagramImport,
    });
    await insertEvent(item.queueId, item.id, status === "PENDING" ? "import_retry" : status === "WAITING_FILE" ? "waiting_file" : "import_failed", message);
    log("import_outcome", { itemId: item.id, queueId: item.queueId, kind: item.sourceKind, status, code: failure.code, ms: Date.now() - started });
    return { itemId: item.id, queueId: item.queueId, status, code: failure.code };
  }
}

export interface RunImportsOptions {
  maxItems: number;
  maxInFlight: number;
  /** Para de pegar itens novos quando o tempo restante ficar abaixo disso. */
  deadline: number;
  scope?: Parameters<typeof claimNextItemForImport>[2];
  now?: () => Date;
}

/** Importa itens em sequência, respeitando o teto global de downloads simultâneos e o orçamento de tempo. */
export async function runQueueImports(options: RunImportsOptions): Promise<ProcessItemResult[]> {
  const results: ProcessItemResult[] = [];
  const now = options.now ?? (() => new Date());
  while (results.length < options.maxItems && Date.now() < options.deadline) {
    if ((await countInFlightItems()) >= options.maxInFlight) break;
    const lockToken = randomUUID();
    const item = await claimNextItemForImport(lockToken, IMPORT_LOCK_TTL_SECONDS, options.scope);
    if (!item) break;
    results.push(await processClaimedItem(item, lockToken, now()));
  }
  return results;
}
