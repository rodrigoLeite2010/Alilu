import "server-only";
import { randomUUID } from "node:crypto";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { computeNextRetryAt } from "@/lib/instagram/backend/publish-errors";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";
import {
  FacebookGraphApiError,
  createPageMultiPhotoPost,
  deletePageObject,
  finishPageReel,
  getPagePostPermalink,
  getReelCopyrightInfo,
  getReelStatus,
  listRecentPagePosts,
  publishPagePhoto,
  startPageReelUpload,
  uploadPageReelFromUrl,
  uploadUnpublishedPagePhoto,
} from "@/lib/facebook/backend/facebook-graph-client";
import {
  FacebookPublishValidationError,
  FacebookReelProcessingError,
  RECONNECT_PAGE_MESSAGE,
  classifyFacebookError,
  needsPageReconnect,
} from "@/lib/facebook/backend/facebook-publish-errors";
import { assertReelCompatible, prepareFacebookImageUrl } from "@/lib/facebook/backend/facebook-media";
import { facebookSupportFor, FACEBOOK_MAX_PHOTOS_PER_POST } from "@/lib/facebook/facebook-media-rules";
import { setFacebookPageStatus } from "@/lib/facebook/backend/facebook-page-repository";
import {
  claimDestinationForManualPublish,
  claimNextDueDestination,
  clearDestinationRequestStarted,
  getDestinationForPublish,
  getDestinationStatus,
  listDestinationsForPost,
  markDestinationFailed,
  markDestinationPublished,
  markDestinationRequestStarted,
  recordDestinationAttempt,
  releaseDestinationForResume,
  saveDestinationProgress,
  scheduleDestinationRetry,
  syncFacebookOnlyParentStatus,
  type ClaimedDestination,
  type DestinationForPublish,
} from "@/lib/facebook/backend/social-destination-repository";

/**
 * CAMADA ÚNICA DE PUBLICAÇÃO NO FACEBOOK — `publishFacebookDestination`.
 * "Publicar agora", "Tentar novamente" e o agendador passam por aqui.
 *
 * Garantias (espelham as do Instagram, instagram-publish-service.ts):
 *  1. Claim atômico antes de qualquer chamada à Meta; escritas exigem o lock.
 *  2. Nada aqui lê ou escreve o estado do Instagram: falha no Facebook
 *     nunca republica o Instagram.
 *  3. Nunca declara PUBLISHED sem confirmação da Meta (Reel: só quando o
 *     publishing_phase consta como concluído).
 *  4. POST não idempotente (foto / post com várias fotos) é marcado ANTES
 *     de sair (request_started_at). Se o resultado ficar desconhecido
 *     (timeout, queda), a próxima tentativa CONSULTA a Página
 *     (published_posts) antes de qualquer novo POST.
 *  5. Reel: o video_id é salvo na fase "start" e todas as fases seguintes
 *     são atreladas a ele — retomadas nunca criam um segundo Reel.
 *  6. Sem espera longa dentro da função serverless: o estado do Reel é
 *     consultado uma vez por execução; o agendador retoma em ~60 s.
 */

export type FacebookPublishOutcome = "PUBLISHED" | "PROCESSING" | "RETRY_SCHEDULED";
export type FacebookPublishTrigger = "manual" | "retry" | "scheduler";

export class FacebookPublishError extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
    this.name = "FacebookPublishError";
  }
}

export const FACEBOOK_LOCK_TTL_SECONDS = 5 * 60;
const RESUME_DELAY_MS = 60_000;
/** Espera mínima antes de concluir "não publicado" numa reconciliação (propagação na Meta). */
const RECONCILE_GRACE_MS = 2 * 60_000;
const RECONCILE_LOOKBACK_MS = 2 * 60_000;
const MAX_PROCESSING_MS = 2 * 60 * 60 * 1000;
const UNKNOWN_RESULT_RETRY_MS = 3 * 60_000;

type ExecuteResult = { status: "PUBLISHED"; externalId: string; url: string | null; reconciled?: boolean } | { status: "PROCESSING" };

interface Ctx {
  dest: DestinationForPublish;
  token: string;
  lockToken: string;
  trigger: FacebookPublishTrigger;
  now: () => Date;
  /** true enquanto um POST não idempotente está "no ar". */
  requestInFlight: boolean;
}

function pageUrl(id: string) {
  return `https://www.facebook.com/${encodeURIComponent(id)}`;
}

function normalizeMessage(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

/**
 * Reconciliação de um POST com resultado desconhecido: procura na Página
 * um post criado a partir do envio com a MESMA legenda.
 */
async function reconcile(ctx: Ctx): Promise<"found" | "wait" | "not_found" | "ambiguous" | ExecuteResult> {
  const startedAt = ctx.dest.requestStartedAt;
  if (!startedAt) return "not_found";
  const caption = normalizeMessage(ctx.dest.caption);
  const posts = await listRecentPagePosts({
    pageId: ctx.dest.pageId,
    pageToken: ctx.token,
    since: new Date(startedAt.getTime() - RECONCILE_LOOKBACK_MS),
  });
  if (caption) {
    const match = posts.find((post) => normalizeMessage(post.message) === caption);
    if (match) return { status: "PUBLISHED", externalId: match.id, url: match.permalinkUrl ?? pageUrl(match.id), reconciled: true };
  }
  if (ctx.now().getTime() - startedAt.getTime() < RECONCILE_GRACE_MS) return "wait";
  // Sem legenda não há como distinguir um post nosso de outro post da Página.
  if (!caption && posts.length > 0) return "ambiguous";
  return "not_found";
}

async function publishImage(ctx: Ctx): Promise<ExecuteResult> {
  const item = ctx.dest.items[0];
  if (!item || item.mediaType !== "image") throw new FacebookPublishValidationError("A mídia desta publicação não é uma imagem.", "media");
  const imageUrl = await prepareFacebookImageUrl({ storageUrl: item.storageUrl, fileSizeBytes: item.fileSizeBytes, userId: ctx.dest.userId });
  await markDestinationRequestStarted(ctx.dest.id, ctx.lockToken);
  ctx.requestInFlight = true;
  const result = await publishPagePhoto({ pageId: ctx.dest.pageId, pageToken: ctx.token, imageUrl, message: ctx.dest.caption });
  ctx.requestInFlight = false;
  const externalId = result.postId ?? result.photoId;
  const url = (await getPagePostPermalink(externalId, ctx.token)) ?? pageUrl(externalId);
  return { status: "PUBLISHED", externalId, url };
}

async function publishCarousel(ctx: Ctx): Promise<ExecuteResult> {
  const { items } = ctx.dest;
  if (items.length < 2 || items.length > FACEBOOK_MAX_PHOTOS_PER_POST) {
    throw new FacebookPublishValidationError(`Um post com várias fotos precisa ter entre 2 e ${FACEBOOK_MAX_PHOTOS_PER_POST} imagens.`, "validation");
  }
  // Fotos não publicadas, enviadas UMA A UMA e salvas a cada passo: uma
  // falha parcial retoma do ponto onde parou, sem reenviar as anteriores.
  const children = [...(ctx.dest.externalChildrenIds ?? [])].slice(0, items.length);
  for (let index = children.length; index < items.length; index++) {
    const item = items[index];
    const imageUrl = await prepareFacebookImageUrl({ storageUrl: item.storageUrl, fileSizeBytes: item.fileSizeBytes, userId: ctx.dest.userId });
    children.push(await uploadUnpublishedPagePhoto({ pageId: ctx.dest.pageId, pageToken: ctx.token, imageUrl }));
    await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { externalChildrenIds: children, phase: "photos_uploading" });
  }
  await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { phase: "photos_uploaded" });
  ctx.dest.externalChildrenIds = children;
  await markDestinationRequestStarted(ctx.dest.id, ctx.lockToken);
  ctx.requestInFlight = true;
  const postId = await createPageMultiPhotoPost({ pageId: ctx.dest.pageId, pageToken: ctx.token, message: ctx.dest.caption, photoIds: children });
  ctx.requestInFlight = false;
  const url = (await getPagePostPermalink(postId, ctx.token)) ?? pageUrl(postId);
  return { status: "PUBLISHED", externalId: postId, url };
}

async function publishReel(ctx: Ctx): Promise<ExecuteResult> {
  const item = ctx.dest.items[0];
  if (!item || item.mediaType !== "video") throw new FacebookPublishValidationError("A mídia deste Reel não é um vídeo.", "media");
  let videoId = ctx.dest.externalUploadId;
  let phase = ctx.dest.phase;

  if (!videoId) {
    await assertReelCompatible(item.storageUrl, item);
    videoId = await startPageReelUpload({ pageId: ctx.dest.pageId, pageToken: ctx.token });
    phase = "started";
    await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { externalUploadId: videoId, phase });
    logPublicationEvent({ event: "facebook.reel.started", platform: "facebook", destinationId: ctx.dest.id, phase });
  }
  if (phase === "started" || phase === null) {
    await uploadPageReelFromUrl({ videoId, pageToken: ctx.token, fileUrl: item.storageUrl });
    phase = "uploaded";
    await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { phase });
  }

  let status = await getReelStatus(videoId, ctx.token);
  if (phase === "uploaded" && status.uploadingStatus === "in_progress") {
    // A Meta ainda está baixando o vídeo da URL: "finish" só depois.
    return { status: "PROCESSING" };
  }
  if (phase === "uploaded" && (status.publishingStatus === null || status.publishingStatus === "not_started")) {
    // "finish" é atrelado ao video_id: repetir após uma queda nunca cria outro Reel.
    await markDestinationRequestStarted(ctx.dest.id, ctx.lockToken);
    await finishPageReel({ pageId: ctx.dest.pageId, pageToken: ctx.token, videoId, description: ctx.dest.caption });
    phase = "finished";
    await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { phase });
    status = await getReelStatus(videoId, ctx.token);
  } else if (phase === "uploaded") {
    phase = "finished";
    await saveDestinationProgress(ctx.dest.id, ctx.lockToken, { phase });
  }

  const failed = [status.videoStatus, status.uploadingStatus, status.processingStatus, status.publishingStatus].includes("error");
  if (failed) {
    const copyright = await getReelCopyrightInfo(videoId, ctx.token);
    throw new FacebookReelProcessingError(Boolean(copyright?.blocked));
  }
  if (status.publishingStatus === "complete" || status.publishStatus === "published") {
    return { status: "PUBLISHED", externalId: videoId, url: `https://www.facebook.com/reel/${encodeURIComponent(videoId)}` };
  }
  return { status: "PROCESSING" };
}

async function execute(ctx: Ctx): Promise<ExecuteResult> {
  const { dest } = ctx;
  if (dest.externalPublicationId) {
    return { status: "PUBLISHED", externalId: dest.externalPublicationId, url: null };
  }
  const support = facebookSupportFor(dest.postType, dest.items.some((item) => item.mediaType === "video"));
  if (!support.supported) throw new FacebookPublishValidationError(support.reason, "validation");
  if (dest.items.length === 0) throw new FacebookPublishValidationError("A publicação está sem mídia associada.", "validation");

  if (dest.postType !== "reels" && dest.requestStartedAt) {
    const outcome = await reconcile(ctx);
    if (typeof outcome === "object") return outcome;
    if (outcome === "wait") return { status: "PROCESSING" };
    if (outcome === "ambiguous" && ctx.trigger === "scheduler") {
      throw new FacebookPublishValidationError(
        "Não conseguimos confirmar se o post foi criado na Página. Confira a Página e use \"Tentar novamente\" só se ele não aparecer.",
        "unknown_result",
      );
    }
    // Consultamos a Página e o post não está lá (ou a pessoa confirmou): pode enviar.
    await clearDestinationRequestStarted(dest.id, ctx.lockToken);
    await recordDestinationAttempt({ destinationId: dest.id, trigger: ctx.trigger, outcome: "reconciled", errorSanitized: "Envio anterior não encontrado na Página." });
    dest.requestStartedAt = null;
  }

  if (dest.postType === "image") return publishImage(ctx);
  if (dest.postType === "carousel") return publishCarousel(ctx);
  return publishReel(ctx);
}

export interface FacebookPublishOptions {
  trigger: FacebookPublishTrigger;
  claimed?: { destination: ClaimedDestination; lockToken: string };
  now?: () => Date;
}

/** Publica (ou retoma) UM destino Facebook. */
export async function publishFacebookDestination(
  destinationId: string,
  userId: string,
  options: FacebookPublishOptions = { trigger: "manual" },
): Promise<FacebookPublishOutcome> {
  const now = options.now ?? (() => new Date());
  let lockToken: string;
  let claimed: ClaimedDestination | null;
  if (options.claimed) {
    lockToken = options.claimed.lockToken;
    claimed = options.claimed.destination;
  } else {
    lockToken = randomUUID();
    claimed = await claimDestinationForManualPublish(destinationId, userId, lockToken, FACEBOOK_LOCK_TTL_SECONDS);
  }
  if (!claimed) {
    const current = await getDestinationStatus(destinationId, userId);
    if (current === "PUBLISHED") return "PUBLISHED";
    if (current === "PROCESSING") return "PROCESSING";
    if (current === null) throw new FacebookPublishError("Destino de publicação não encontrado.", "validation");
    throw new FacebookPublishError(
      current === "CANCELLED" ? "A publicação no Facebook foi cancelada." : "Esta publicação no Facebook não pode ser enviada agora.",
      "validation",
    );
  }

  const logBase = { platform: "facebook", destinationId, publicationId: claimed.postId, trigger: options.trigger, attempt: claimed.attemptsCount + 1 };
  logPublicationEvent({ ...logBase, event: "facebook.publish.start", status: "PROCESSING" });

  const dest = await getDestinationForPublish(destinationId, userId);
  const ctx: Ctx | null = dest ? { dest, token: "", lockToken, trigger: options.trigger, now, requestInFlight: false } : null;
  try {
    if (!dest || !ctx) throw new FacebookPublishValidationError("Destino de publicação não encontrado.", "validation");
    logBase.publicationId = dest.postId;
    if (!dest.pageTokenEncrypted || dest.pageStatus === "revoked") {
      throw new FacebookPublishValidationError(
        dest.pageStatus === "revoked" || !dest.pageRef
          ? "A Página do Facebook foi desconectada. Reconecte a Página para publicar."
          : RECONNECT_PAGE_MESSAGE,
        "page_disconnected",
      );
    }
    ctx.token = decryptSecret(dest.pageTokenEncrypted);
    const result = await execute(ctx);

    if (result.status === "PUBLISHED") {
      await markDestinationPublished(dest.id, lockToken, result.externalId, result.url);
      await recordDestinationAttempt({ destinationId: dest.id, trigger: options.trigger, outcome: result.reconciled ? "reconciled" : "success", externalId: result.externalId });
      await syncFacebookOnlyParentStatus(dest.postId);
      logPublicationEvent({ ...logBase, event: "facebook.publish.done", status: "PUBLISHED" });
      return "PUBLISHED";
    }

    const since = claimed.processingStartedAt ? new Date(claimed.processingStartedAt).getTime() : now().getTime();
    if (now().getTime() - since > MAX_PROCESSING_MS) {
      // Não sabemos se a Meta ainda vai concluir: NEEDS_REVIEW (nunca "falhou" sem certeza).
      throw new FacebookPublishValidationError(
        "O Facebook não concluiu o processamento a tempo. Confira a Página antes de tentar novamente.",
        "unknown_result",
      );
    }
    await releaseDestinationForResume(dest.id, lockToken, new Date(now().getTime() + RESUME_DELAY_MS));
    await recordDestinationAttempt({ destinationId: dest.id, trigger: options.trigger, outcome: "pending" });
    await syncFacebookOnlyParentStatus(dest.postId);
    logPublicationEvent({ ...logBase, event: "facebook.publish.pending", status: "PROCESSING" });
    return "PROCESSING";
  } catch (error) {
    const classified = classifyFacebookError(error);
    logPublicationEvent({ ...logBase, event: "facebook.publish.error", status: "ERROR", errorKind: classified.reason, metaCode: classified.metaCode });

    // A Meta respondeu com erro ao POST: certamente nada foi criado → libera novo envio sem reconciliar.
    if (ctx?.requestInFlight && error instanceof FacebookGraphApiError && !error.unknownOutcome) {
      await clearDestinationRequestStarted(destinationId, lockToken).catch(() => undefined);
    }
    if (dest && needsPageReconnect(classified.reason) && dest.pageRef) {
      await setFacebookPageStatus(dest.pageRef, userId, "needs_reconnect", classified.message).catch(() => undefined);
    }

    if (classified.kind === "transient") {
      const retryAt = classified.reason === "unknown_result" && claimed.attemptsCount < 3
        ? new Date(now().getTime() + UNKNOWN_RESULT_RETRY_MS)
        : computeNextRetryAt(claimed.attemptsCount, now());
      if (retryAt) {
        await scheduleDestinationRetry(destinationId, lockToken, classified.message, classified.reason, retryAt);
        await recordDestinationAttempt({ destinationId, trigger: options.trigger, outcome: "failure", errorSanitized: classified.message, errorReason: classified.reason, metaCode: classified.metaCode });
        if (dest) await syncFacebookOnlyParentStatus(dest.postId);
        logPublicationEvent({ ...logBase, event: "facebook.publish.retry_scheduled", status: "SCHEDULED", nextAttemptAt: retryAt.toISOString() });
        return "RETRY_SCHEDULED";
      }
    }

    // Falha definitiva. Resultado ainda desconhecido vira NEEDS_REVIEW (nunca "falhou" sem certeza).
    const finalStatus = classified.reason === "unknown_result" ? "NEEDS_REVIEW" : "FAILED";
    if (dest?.postType === "carousel" && dest.externalChildrenIds?.length && ctx?.token && finalStatus === "FAILED" && classified.reason !== "token") {
      // Não deixa fotos não publicadas órfãs na Página. Melhor esforço.
      for (const photoId of dest.externalChildrenIds) await deletePageObject(photoId, ctx.token).catch(() => undefined);
      await saveDestinationProgress(destinationId, lockToken, { externalChildrenIds: null, phase: null }).catch(() => undefined);
    }
    await markDestinationFailed(destinationId, lockToken, classified.message, classified.reason, finalStatus);
    await recordDestinationAttempt({ destinationId, trigger: options.trigger, outcome: "failure", errorSanitized: classified.message, errorReason: classified.reason, metaCode: classified.metaCode });
    if (dest) await syncFacebookOnlyParentStatus(dest.postId);
    logPublicationEvent({ ...logBase, event: "facebook.publish.failed", status: finalStatus });
    throw new FacebookPublishError(classified.message, classified.reason);
  }
}

export interface FacebookDestinationResult {
  destinationId: string;
  accountName: string | null;
  status: FacebookPublishOutcome | "FAILED";
  error?: string;
  reason?: string;
}

/**
 * "Publicar agora" de uma publicação: tenta cada destino Facebook ainda não
 * publicado (independente do Instagram). Nunca lança — devolve o resultado
 * de cada destino.
 */
export async function publishFacebookDestinationsForPost(postId: string, userId: string, trigger: FacebookPublishTrigger = "manual"): Promise<FacebookDestinationResult[]> {
  const destinations = await listDestinationsForPost(postId, userId);
  const results: FacebookDestinationResult[] = [];
  for (const destination of destinations) {
    if (destination.platform !== "facebook" || destination.status === "CANCELLED") continue;
    if (destination.status === "PUBLISHED") {
      results.push({ destinationId: destination.id, accountName: destination.accountName, status: "PUBLISHED" });
      continue;
    }
    try {
      const status = await publishFacebookDestination(destination.id, userId, { trigger });
      results.push({ destinationId: destination.id, accountName: destination.accountName, status });
    } catch (error) {
      results.push({
        destinationId: destination.id,
        accountName: destination.accountName,
        status: "FAILED",
        error: error instanceof FacebookPublishError ? error.message : "Não foi possível publicar no Facebook.",
        reason: error instanceof FacebookPublishError ? error.reason : "other",
      });
    }
  }
  return results;
}

export interface FacebookSchedulerResult {
  destinationId: string;
  status: FacebookPublishOutcome | "FAILED";
  error?: string;
}

/** Agendador do Facebook: mesmo modelo do Instagram (claim atômico por destino, orçamento de tempo). */
export async function runFacebookScheduler(options: { limit?: number; timeBudgetMs?: number } = {}): Promise<FacebookSchedulerResult[]> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
  const budget = options.timeBudgetMs ?? 20_000;
  const startedAt = Date.now();
  const results: FacebookSchedulerResult[] = [];
  if (budget <= 0) {
    logPublicationEvent({ event: "facebook.scheduler.deferred", platform: "facebook", claimed: 0, durationMs: 0 });
    return results;
  }
  while (results.length < limit && Date.now() - startedAt < budget) {
    const lockToken = randomUUID();
    const claimed = await claimNextDueDestination(lockToken, FACEBOOK_LOCK_TTL_SECONDS);
    if (!claimed) break;
    try {
      const status = await publishFacebookDestination(claimed.id, claimed.userId, { trigger: "scheduler", claimed: { destination: claimed, lockToken } });
      results.push({ destinationId: claimed.id, status });
    } catch (error) {
      results.push({ destinationId: claimed.id, status: "FAILED", error: error instanceof FacebookPublishError ? error.message : "Falha ao publicar no Facebook." });
    }
  }
  logPublicationEvent({ event: "facebook.scheduler.run", platform: "facebook", claimed: results.length, durationMs: Date.now() - startedAt });
  return results;
}
