import "server-only";
import { randomUUID } from "node:crypto";
import { getFacebookPageForUser } from "@/lib/facebook/backend/facebook-page-repository";
import { addFacebookDestinationsIfMissing, type FacebookDestinationInput } from "@/lib/facebook/backend/social-destination-repository";
import { filterAuthorizedFacebookPages } from "@/lib/facebook/backend/destination-authorization";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { createDraftReelPost } from "@/lib/instagram/backend/instagram-post-repository";
import { getInstagramMediaByStorageUrl, insertInstagramMedia } from "@/lib/instagram/backend/media-repository";
import { findCategory, findTheme } from "@/lib/video-queue/catalog";
import { renderCaptionTemplate, resolveItemCaption, validateCaption } from "@/lib/video-queue/captions";
import { allocateSlots, pickPlannableItems } from "@/lib/video-queue/schedule";
import {
  acquirePlanningLock,
  cancelQueuePostIfUntouched,
  cancelScheduledItem,
  findActivePostForItem,
  getQueueById,
  insertEvent,
  listFutureScheduledItems,
  listItemsForQueue,
  listOccupiedSlots,
  listScheduledItemStates,
  markItemPlanningError,
  markItemPublished,
  markItemScheduled,
  releasePlanningLock,
  resetItemToReady,
  setQueueStatus,
  type VideoQueueItemRecord,
  type VideoQueueRecord,
} from "./queue-repository";

/**
 * Planejador da fila: transforma vídeos PRONTOS em publicações do
 * agendador que já existe. Nunca publica nada diretamente.
 *
 *   1. sincroniza o resultado das publicações já criadas (Publicado /
 *      cancelada ou excluída em "Minhas publicações");
 *   2. confere as contas de destino — conta/Página desconectada PAUSA a
 *      fila com o motivo (nunca troca de conta);
 *   3. escolhe os próximos vídeos (ordem + regra de "vídeo não pronto"),
 *      encontra os horários livres (sem tocar em agendamentos existentes)
 *      e cria as publicações dentro do horizonte configurado.
 *
 * Tudo sob um lock por fila (cron simultâneo, ações do usuário).
 * Idempotência: índice único parcial instagram_posts.video_queue_item_id
 * — se o planejamento cair entre criar a publicação e marcar o item, a
 * próxima execução encontra a publicação e só completa o vínculo.
 */

export const PLANNING_LOCK_TTL_SECONDS = 120;

export class VideoQueueBusyError extends Error {
  constructor() {
    super("A fila está sendo atualizada agora. Tente novamente em alguns segundos.");
    this.name = "VideoQueueBusyError";
  }
}

function log(event: string, data: Record<string, unknown>): void {
  console.info(JSON.stringify({ scope: "video-queue", event, ...data }));
}

/** Executa `fn` com o lock de planejamento da fila. `wait` tenta por alguns segundos antes de desistir. */
export async function withPlanningLock<T>(queueId: string, fn: () => Promise<T>, options: { wait?: boolean } = {}): Promise<T> {
  const token = randomUUID();
  let acquired = await acquirePlanningLock(queueId, token, PLANNING_LOCK_TTL_SECONDS);
  for (let attempt = 0; !acquired && options.wait && attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    acquired = await acquirePlanningLock(queueId, token, PLANNING_LOCK_TTL_SECONDS);
  }
  if (!acquired) throw new VideoQueueBusyError();
  let planned = false;
  try {
    const result = await fn();
    planned = true;
    return result;
  } finally {
    await releasePlanningLock(queueId, token, planned);
  }
}

// ─────────────────────────── Sincronização ───────────────────────────

/** Atualiza os itens agendados conforme o estado real das publicações (cada rede com status próprio). */
export async function syncScheduledItemsLocked(queue: VideoQueueRecord): Promise<{ published: number; cancelled: number }> {
  let published = 0;
  let cancelled = 0;
  for (const state of await listScheduledItemStates(queue.id)) {
    if (!state.postId) {
      await cancelScheduledItem(state.itemId, null, "A publicação deste vídeo foi excluída em Minhas publicações.");
      await insertEvent(queue.id, state.itemId, "publication_removed", "Publicação excluída fora da fila.");
      cancelled += 1;
      continue;
    }
    if (state.postStatus === "CANCELLED") {
      await cancelScheduledItem(state.itemId, state.postId, "A publicação deste vídeo foi cancelada em Minhas publicações.");
      await insertEvent(queue.id, state.itemId, "publication_cancelled", "Publicação cancelada fora da fila.");
      cancelled += 1;
      continue;
    }
    const liveDestinations = state.destinationStatuses.filter((status) => status !== "CANCELLED");
    const facebookDone = liveDestinations.every((status) => status === "PUBLISHED");
    const instagramDone = state.publishToInstagram ? state.postStatus === "PUBLISHED" : true;
    const anything = state.publishToInstagram || liveDestinations.length > 0;
    if (anything && instagramDone && facebookDone) {
      await markItemPublished(state.itemId, state.postPublishedAt);
      await insertEvent(queue.id, state.itemId, "published", "Publicado em todos os destinos.");
      published += 1;
    }
  }
  return { published, cancelled };
}

// ───────────────────────────── Destinos ─────────────────────────────

/** Motivo para pausar (conta/Página indisponível) ou null quando todos os destinos estão conectados. */
export async function checkTargets(queue: VideoQueueRecord): Promise<{ pages: FacebookDestinationInput[]; problem: string | null }> {
  const account = await getInstagramAccountByIdForUser(queue.instagramAccountId, queue.userId);
  if (!account) return { pages: [], problem: "A conta do Instagram desta fila não foi encontrada." };
  if (queue.publishToInstagram && account.status !== "connected") {
    return {
      pages: [],
      problem: `A conta do Instagram @${account.igUsername ?? "?"} está desconectada. Reconecte essa mesma conta e retome a fila.`,
    };
  }
  const pages: FacebookDestinationInput[] = [];
  for (const pageRef of queue.facebookPageIds) {
    const page = await getFacebookPageForUser(pageRef, queue.userId);
    if (!page) return { pages: [], problem: "Uma Página do Facebook desta fila não foi encontrada na sua conta." };
    if (!page.hasToken || page.status !== "connected") {
      return { pages: [], problem: `A Página do Facebook "${page.pageName}" precisa ser reconectada. Reconecte essa mesma Página e retome a fila.` };
    }
  }
  // Autorização contra o perfil de destinos da conta Instagram da fila:
  // Página negada NÃO é publicada (e nunca trocada por outra); o Instagram segue.
  const { pages: authorized, rejected } = await filterAuthorizedFacebookPages({
    userId: queue.userId,
    instagramAccountId: queue.instagramAccountId,
    pageRefs: queue.facebookPageIds,
    source: "video_queue",
  });
  pages.push(...authorized);
  if (!queue.publishToInstagram && pages.length === 0 && rejected.length > 0) {
    return { pages: [], problem: "As Páginas do Facebook desta fila não estão autorizadas para esta conta do Instagram. Revise os destinos da conta." };
  }
  return { pages, problem: null };
}

// ─────────────────────────── Liberação ───────────────────────────

/**
 * Cancela as publicações FUTURAS da fila que ainda não começaram e devolve
 * os vídeos para "Pronto" (pausa, mudança de horários, reordenação).
 * Publicações já concluídas, em andamento ou a menos de 1 min do horário
 * nunca são interrompidas.
 */
export async function releaseFutureScheduledLocked(queue: VideoQueueRecord): Promise<number> {
  let released = 0;
  for (const entry of await listFutureScheduledItems(queue.id)) {
    if (await cancelQueuePostIfUntouched(entry.postId, entry.userId)) {
      await resetItemToReady(entry.itemId, entry.postId);
      released += 1;
    }
  }
  if (released > 0) await insertEvent(queue.id, null, "released", `${released} publicação(ões) futura(s) desfeita(s) para replanejar.`);
  return released;
}

export async function pauseQueueLocked(queue: VideoQueueRecord, reason: string | null, bySystem: boolean): Promise<void> {
  await setQueueStatus(queue.id, "PAUSED", { reason, bySystem, fromStatuses: ["ACTIVE", "PAUSED", "DRAFT"] });
  await releaseFutureScheduledLocked(queue);
  await insertEvent(queue.id, null, bySystem ? "paused_by_system" : "paused", reason);
  log(bySystem ? "paused_by_system" : "paused", { queueId: queue.id });
}

// ─────────────────────────── Planejamento ───────────────────────────

function captionVariables(queue: VideoQueueRecord, items: VideoQueueItemRecord[]) {
  const visible = items.filter((item) => item.status !== "CANCELLED").sort((a, b) => a.position - b.position);
  const numbers = new Map(visible.map((item, index) => [item.id, index + 1]));
  return {
    tema: findTheme(queue.category, queue.theme)?.name ?? queue.theme,
    categoria: findCategory(queue.category)?.name ?? queue.category,
    total: visible.length,
    numberOf: (id: string) => numbers.get(id) ?? 0,
  };
}

async function ensureMediaId(item: VideoQueueItemRecord): Promise<string> {
  const existing = await getInstagramMediaByStorageUrl(item.blobUrl!, item.userId);
  if (existing) return existing.id;
  return insertInstagramMedia({
    userId: item.userId,
    storageUrl: item.blobUrl!,
    mediaType: "video",
    fileSizeBytes: item.fileSizeBytes,
    originalFilename: `fila-${item.id}.mp4`,
  });
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23505" || /duplicate key|unique/i.test((error as Error)?.message ?? "");
}

async function materializeItem(
  queue: VideoQueueRecord,
  item: VideoQueueItemRecord,
  at: Date,
  pages: FacebookDestinationInput[],
  vars: ReturnType<typeof captionVariables>,
): Promise<string | null> {
  const captionVars = { tema: vars.tema, categoria: vars.categoria, numero: vars.numberOf(item.id), total: vars.total };
  const caption = resolveItemCaption(item, queue.captionTemplate, captionVars);
  const captionError = validateCaption(caption);
  if (captionError) {
    await markItemPlanningError(item.id, captionError, "INVALID_CAPTION");
    await insertEvent(queue.id, item.id, "planning_failed", captionError);
    return null;
  }

  // Facebook: só Reels compatíveis (3–90 s, 9:16…). Incompatível = só Instagram, com aviso.
  let facebookPages = pages;
  let facebookNote: string | null = null;
  if (pages.length > 0 && item.facebookIncompatibleReason) {
    facebookPages = [];
    facebookNote = `Não enviado ao Facebook: ${item.facebookIncompatibleReason}`;
  }
  if (!queue.publishToInstagram && facebookPages.length === 0) {
    const message = item.facebookIncompatibleReason ?? "Nenhum destino disponível para este vídeo.";
    await markItemPlanningError(item.id, message, "NO_DESTINATION");
    await insertEvent(queue.id, item.id, "planning_failed", message);
    return null;
  }

  let post = await findActivePostForItem(item.id);
  if (!post) {
    const mediaId = await ensureMediaId(item);
    try {
      const postId = await createDraftReelPost({
        userId: queue.userId,
        instagramAccountId: queue.instagramAccountId,
        mediaId,
        caption,
        scheduledAtUtc: at,
        source: "VIDEO_QUEUE",
        timezone: queue.schedule.timezone,
        // O vídeo já tem o próprio áudio: nunca aplica a música padrão da conta.
        musicMode: "NONE",
        publishToInstagram: queue.publishToInstagram,
        videoQueueItemId: item.id,
      });
      post = { id: postId, scheduledAtUtc: at, status: "SCHEDULED" };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      post = await findActivePostForItem(item.id);
      if (!post) throw error;
    }
  }

  if (facebookPages.length > 0) {
    const fbCaption = item.facebookCaption?.trim()
      ? item.facebookCaption
      : queue.facebookCaptionTemplate?.trim()
        ? renderCaptionTemplate(queue.facebookCaptionTemplate, { ...captionVars, titulo: item.title })
        : null;
    await addFacebookDestinationsIfMissing(post.id, queue.userId, facebookPages, fbCaption, "video_queue");
  }
  await markItemScheduled(item.id, post.id, post.scheduledAtUtc ?? at, facebookNote);
  await insertEvent(queue.id, item.id, "scheduled", `Agendado para ${(post.scheduledAtUtc ?? at).toISOString()}.`);
  return post.id;
}

/** Usa a mesma publicação e os mesmos destinos do agendamento. O chamador tem o lock da fila. */
export async function materializeImmediateItemLocked(queue: VideoQueueRecord, item: VideoQueueItemRecord, now: Date) {
  const targets = await checkTargets(queue);
  if (targets.problem) return { postId: null, problem: targets.problem };
  const items = await listItemsForQueue(queue.id, queue.userId);
  const postId = await materializeItem(queue, item, now, targets.pages, captionVariables(queue, items));
  return { postId, problem: null };
}

export interface PlanQueueResult {
  queueId: string;
  status: VideoQueueRecord["status"] | "NOT_FOUND";
  published: number;
  cancelled: number;
  scheduled: number;
  paused?: string;
}

/** Sincroniza + planeja uma fila (lock já obtido). */
export async function planQueueLocked(queueId: string, now: Date = new Date()): Promise<PlanQueueResult> {
  const queue = await getQueueById(queueId);
  if (!queue) return { queueId, status: "NOT_FOUND", published: 0, cancelled: 0, scheduled: 0 };
  const sync = await syncScheduledItemsLocked(queue);
  const result: PlanQueueResult = { queueId, status: queue.status, ...sync, scheduled: 0 };
  if (queue.status !== "ACTIVE") return result;

  const targets = await checkTargets(queue);
  if (targets.problem) {
    await pauseQueueLocked(queue, targets.problem, true);
    return { ...result, status: "PAUSED", paused: targets.problem };
  }

  const items = await listItemsForQueue(queue.id, queue.userId);
  const candidates = pickPlannableItems(items, queue.schedule);
  if (candidates.length === 0) return result;

  const occupied = await listOccupiedSlots({
    userId: queue.userId,
    queueId: queue.id,
    instagramAccountId: queue.instagramAccountId,
    includeInstagram: queue.publishToInstagram,
    facebookPageIds: queue.facebookPageIds,
    from: new Date(now.getTime() - 2 * 24 * 3600_000),
  });
  const until = new Date(now.getTime() + queue.schedule.materializeAheadHours * 3600_000);
  const slots = allocateSlots({ config: queue.schedule, now, occupied, count: candidates.length, until });
  const vars = captionVariables(queue, items);
  for (let index = 0; index < slots.length; index += 1) {
    try {
      if (await materializeItem(queue, candidates[index], slots[index], targets.pages, vars)) result.scheduled += 1;
    } catch (error) {
      // Erro inesperado (banco/rede): o item continua PRONTO e é replanejado na próxima execução.
      log("materialize_failed", { queueId: queue.id, itemId: candidates[index].id, message: (error as Error)?.message?.slice(0, 200) });
      break;
    }
  }
  if (result.scheduled > 0) log("planned", { queueId: queue.id, scheduled: result.scheduled });
  return result;
}

/** Planejamento chamado pelo cron: se outra execução já está planejando a fila, simplesmente pula. */
export async function planQueue(queueId: string, now: Date = new Date()): Promise<PlanQueueResult | null> {
  try {
    return await withPlanningLock(queueId, () => planQueueLocked(queueId, now));
  } catch (error) {
    if (error instanceof VideoQueueBusyError) return null;
    throw error;
  }
}
