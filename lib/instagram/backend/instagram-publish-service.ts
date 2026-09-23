import "server-only";
import { randomUUID } from "node:crypto";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createImageMediaContainer,
  createReelMediaContainer,
  getMediaContainerStatus,
  publishMediaContainer,
} from "@/lib/instagram/backend/meta-graph-client";
import {
  claimPostForManualPublish,
  getPostForPublish,
  getPostStatusForUser,
  markPostFailed,
  markPostProcessing,
  markPostPublished,
  recordPublishAttempt,
  releasePostForResume,
  schedulePostRetry,
  type ClaimedPost,
  type InstagramPostType,
  type PostForPublish,
} from "@/lib/instagram/backend/instagram-post-repository";
import {
  ContainerProcessingError,
  PublishValidationError,
  classifyPublishError,
  computeNextRetryAt,
} from "@/lib/instagram/backend/publish-errors";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";
import { notifyPublicationResult } from "@/lib/instagram/backend/publication-notifier";

/**
 * CAMADA ÚNICA DE PUBLICAÇÃO — `publishInstagramPublication`.
 *
 * Tanto "Publicar agora" (rota POST /api/instagram/posts/[id]/publish)
 * quanto o scheduler (/api/cron/instagram-publish) passam por aqui. Não
 * existe uma segunda implementação.
 *
 * Garantias:
 *   1. CLAIM ATÔMICO antes de qualquer chamada à Meta
 *      (claimPostForManualPublish / claimNextDuePost): só quem obtém o
 *      claim publica. Duas execuções simultâneas → uma publica, a outra
 *      não faz nada.
 *   2. Toda escrita de resultado é condicionada ao `lockToken` do claim.
 *   3. Container salvo = retomado, nunca recriado (Reels/carrossel que
 *      demoram na Meta continuam na próxima execução). Se o container já
 *      consta como PUBLISHED na Meta, marcamos PUBLISHED sem publicar de
 *      novo — protege contra resposta perdida da Meta.
 *   4. Nunca declara PUBLISHED sem confirmação da Meta.
 *   5. Falha temporária → volta para SCHEDULED com backoff (5/15/60 min,
 *      no máximo 3 retentativas); falha permanente → FAILED.
 */

export class InstagramPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramPublishError";
  }
}

/** Resultado visível para quem chama. */
export type PublishOutcome = "PUBLISHED" | "PROCESSING" | "RETRY_SCHEDULED";
/** Mantido por compatibilidade com consumidores antigos. */
export type PublishImagePostResult = PublishOutcome;

export type PublishTrigger = "manual" | "scheduler";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 12; // ~24s de polling dentro de uma execução
/** Quanto tempo esperar para retomar um container ainda em processamento. */
const RESUME_DELAY_MS = 60_000;
/** Claim expira sozinho se o worker morrer no meio (função encerrada, timeout). */
export const LOCK_TTL_SECONDS = 5 * 60;
/** Container preso em processamento por mais que isso vira falha. */
const MAX_PROCESSING_MS = 2 * 60 * 60 * 1000;

const MIN_CAROUSEL_ITEMS = 2;
const MAX_CAROUSEL_ITEMS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ExecuteResult = { status: "PUBLISHED"; mediaId: string | null } | { status: "PROCESSING" };

interface ExecuteContext {
  post: PostForPublish;
  accessToken: string;
  lockToken: string;
  pollIntervalMs: number;
}

/** Consulta o container até FINISHED e publica; PUBLISHED na Meta = já publicado (sem publicar de novo). */
async function pollAndPublishContainer(ctx: ExecuteContext, containerId: string): Promise<ExecuteResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const status = await getMediaContainerStatus({ containerId, accessToken: ctx.accessToken });

    if (status === "FINISHED") {
      const mediaId = await publishMediaContainer({
        igUserId: ctx.post.igUserId,
        accessToken: ctx.accessToken,
        containerId,
      });
      return { status: "PUBLISHED", mediaId };
    }
    if (status === "PUBLISHED") {
      return { status: "PUBLISHED", mediaId: null };
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new ContainerProcessingError(status);
    }
    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(ctx.pollIntervalMs);
    }
  }
  return { status: "PROCESSING" };
}

async function createContainerForPost(ctx: ExecuteContext): Promise<string> {
  const { post, accessToken } = ctx;

  if (post.postType === "image") {
    const item = post.items[0];
    if (!item || item.mediaType !== "image") {
      throw new PublishValidationError("A mídia associada a este post não é uma imagem.");
    }
    return createImageMediaContainer({ igUserId: post.igUserId, accessToken, imageUrl: item.storageUrl, caption: post.caption });
  }

  if (post.postType === "carousel") {
    if (post.items.length < MIN_CAROUSEL_ITEMS || post.items.length > MAX_CAROUSEL_ITEMS) {
      throw new PublishValidationError(
        `Um carrossel precisa ter entre ${MIN_CAROUSEL_ITEMS} e ${MAX_CAROUSEL_ITEMS} imagens (este tem ${post.items.length}).`,
      );
    }
    if (post.items.some((item) => item.mediaType !== "image")) {
      throw new PublishValidationError("Carrosséis publicados pelo Alilu aceitam somente imagens.");
    }
    // Containers-filho em sequência (nunca em paralelo). Só o container PAI
    // é salvo; se algo falhar aqui, uma nova tentativa recria os filhos —
    // containers não publicados expiram sozinhos na Meta, sem post duplicado.
    const children: string[] = [];
    for (const item of post.items) {
      children.push(await createCarouselItemContainer({ igUserId: post.igUserId, accessToken, imageUrl: item.storageUrl }));
    }
    return createCarouselContainer({ igUserId: post.igUserId, accessToken, childrenContainerIds: children, caption: post.caption });
  }

  if (post.postType === "reels") {
    const item = post.items[0];
    if (!item || item.mediaType !== "video") {
      throw new PublishValidationError("A mídia associada a este Reel não é um vídeo.");
    }
    return createReelMediaContainer({
      igUserId: post.igUserId,
      accessToken,
      videoUrl: item.storageUrl,
      caption: post.caption,
      shareToFeed: true,
    });
  }

  throw new PublishValidationError("Tipo de publicação não suportado.");
}

async function executePublish(ctx: ExecuteContext): Promise<ExecuteResult> {
  let containerId = ctx.post.metaContainerId;
  if (!containerId) {
    containerId = await createContainerForPost(ctx);
    await markPostProcessing(ctx.post.id, containerId, ctx.lockToken);
  }
  return pollAndPublishContainer(ctx, containerId);
}

export interface PublishOptions {
  trigger: PublishTrigger;
  /** Claim já obtido (scheduler). Sem ele, o claim manual é feito aqui. */
  claimed?: { post: ClaimedPost; lockToken: string };
  now?: () => Date;
  /** Intervalo do polling do container (padrão 2s). Só os testes mudam isso. */
  pollIntervalMs?: number;
}

/**
 * Publica uma publicação do usuário, de forma segura contra duplicidade.
 * Lança InstagramPublishError (mensagem em português, sanitizada) quando
 * a publicação falha de forma definitiva ou não pode ser publicada agora.
 */
export async function publishInstagramPublication(
  postId: string,
  userId: string,
  options: PublishOptions = { trigger: "manual" },
): Promise<PublishOutcome> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();

  let lockToken: string;
  let claimed: ClaimedPost | null;
  if (options.claimed) {
    lockToken = options.claimed.lockToken;
    claimed = options.claimed.post;
  } else {
    lockToken = randomUUID();
    claimed = await claimPostForManualPublish(postId, userId, lockToken, LOCK_TTL_SECONDS);
  }

  if (!claimed) {
    const current = await getPostStatusForUser(postId, userId);
    if (current === "PUBLISHED") return "PUBLISHED"; // idempotente
    if (current === "PROCESSING") return "PROCESSING"; // outro processo já está publicando
    if (current === null) throw new InstagramPublishError("Publicação não encontrada.");
    throw new InstagramPublishError(
      current === "CANCELLED"
        ? "Esta publicação foi cancelada e não pode mais ser publicada."
        : `Publicação no status '${current}' não pode ser publicada agora.`,
    );
  }

  const logBase = {
    publicationId: postId,
    type: claimed.postType as InstagramPostType,
    trigger: options.trigger,
    attempt: claimed.attemptsCount + 1,
    scheduledAt: claimed.scheduledAtUtc,
    startedAt: startedAt.toISOString(),
  };
  logPublicationEvent({ ...logBase, event: "publish.start", status: "PROCESSING" });

  let post: PostForPublish | null = null;
  try {
    post = await getPostForPublish(postId, userId);
    if (!post) throw new PublishValidationError("A publicação está sem mídia associada.");

    const accessToken = decryptSecret(post.accessTokenEncrypted);
    const result = await executePublish({
      post,
      accessToken,
      lockToken,
      pollIntervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
    });

    if (result.status === "PUBLISHED") {
      await markPostPublished(postId, result.mediaId, lockToken);
      await recordPublishAttempt({ postId, outcome: "success", containerId: post.metaContainerId ?? undefined, mediaId: result.mediaId ?? undefined });
      logPublicationEvent({ ...logBase, event: "publish.done", status: "PUBLISHED", completedAt: now().toISOString() });
      await notifyPublicationResult({ userId, publicationId: postId, status: "PUBLISHED" });
      return "PUBLISHED";
    }

    const processingSince = claimed.processingStartedAt ? new Date(claimed.processingStartedAt).getTime() : startedAt.getTime();
    if (now().getTime() - processingSince > MAX_PROCESSING_MS) {
      throw new ContainerProcessingError("EXPIRED");
    }
    await releasePostForResume(postId, new Date(now().getTime() + RESUME_DELAY_MS), lockToken);
    await recordPublishAttempt({ postId, outcome: "pending" });
    logPublicationEvent({ ...logBase, event: "publish.pending", status: "PROCESSING", completedAt: now().toISOString() });
    return "PROCESSING";
  } catch (error) {
    const classified = classifyPublishError(error);
    // Log com o detalhe da Meta (código/mensagem) — nunca com token: o
    // access token nunca faz parte de `error.details` nem da mensagem.
    logPublicationEvent({
      ...logBase,
      event: "publish.error",
      status: "ERROR",
      errorKind: classified.kind,
      metaCode: classified.metaCode,
      completedAt: now().toISOString(),
    });

    const nextRetryAt = classified.kind === "transient" ? computeNextRetryAt(claimed.attemptsCount, now()) : null;
    if (nextRetryAt) {
      await schedulePostRetry(postId, classified.message, nextRetryAt, lockToken);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: classified.message });
      logPublicationEvent({ ...logBase, event: "publish.retry_scheduled", status: "SCHEDULED", nextAttemptAt: nextRetryAt.toISOString() });
      return "RETRY_SCHEDULED";
    }

    await markPostFailed(postId, classified.message, lockToken);
    await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: classified.message });
    logPublicationEvent({ ...logBase, event: "publish.failed", status: "FAILED" });
    await notifyPublicationResult({ userId, publicationId: postId, status: "FAILED", message: classified.message });
    throw new InstagramPublishError(classified.message);
  }
}

/** Ponto de entrada usado pela rota "Publicar agora" (mantém o nome histórico). */
export async function publishPost(postId: string, userId: string): Promise<PublishOutcome> {
  return publishInstagramPublication(postId, userId, { trigger: "manual" });
}
