import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { del as deleteBlob } from "@vercel/blob";
import { getFacebookPageForUser } from "@/lib/facebook/backend/facebook-page-repository";
import { destinationViewsByPost, resolveFacebookPages, SocialDestinationsError, type PublicationDestinationView } from "@/lib/facebook/backend/social-destinations-service";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { DestinationAuthorizationError, authorizeFacebookPagesForAccount } from "@/lib/facebook/backend/destination-authorization";
import { findCategory, findTheme } from "@/lib/video-queue/catalog";
import { validateCaption } from "@/lib/video-queue/captions";
import { parseQueueLinks } from "@/lib/video-queue/links";
import { allocateSlots, normalizeScheduleConfig, QueueScheduleError, DEFAULT_SCHEDULE, type QueueScheduleConfig } from "@/lib/video-queue/schedule";
import { IN_FLIGHT_STATUSES, MAX_ITEMS_PER_QUEUE, MAX_LINKS_PER_SUBMISSION, type VideoQueueItemStatus } from "@/lib/video-queue/types";
import { queueUploadPrefix, runQueueImports } from "./queue-processor";
import {
  materializeImmediateItemLocked,
  pauseQueueLocked,
  planQueueLocked,
  releaseFutureScheduledLocked,
  VideoQueueBusyError,
  withPlanningLock,
} from "./queue-planner";
import {
  archiveQueue,
  attachUploadToItem,
  cancelQueuePostIfUntouched,
  cancelScheduledItem,
  cancelUnscheduledItem,
  countActiveItems,
  countItemsByQueue,
  deleteItem,
  emptyCounts,
  findUrlsInOtherQueues,
  getItemForUser,
  getQueueForUser,
  getUserEmail,
  insertEvent,
  insertItems,
  insertQueue,
  listEvents,
  listItemsForQueue,
  listOccupiedSlots,
  listPostsForQueue,
  listQueuesForUser,
  reorderItems,
  retryErroredItems,
  setQueueStatus,
  updateItemContent,
  updateQueueSettings,
  type QueueCounts,
  type VideoQueueItemRecord,
  type VideoQueueRecord,
} from "./queue-repository";

/**
 * Regras de negócio da Fila de vídeos: validação de posse (fila, conta
 * Instagram, Páginas e itens sempre do usuário da sessão), criação,
 * links, ações do painel e prévia da programação.
 */

export class VideoQueueError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 400,
    readonly code = "INVALID",
  ) {
    super(message);
    this.name = "VideoQueueError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 80;
const MAX_TEMPLATE = 2200;
const MAX_PAGES = 5;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function busy<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error) => {
    if (error instanceof VideoQueueBusyError) throw new VideoQueueError(error.message, 409, "BUSY");
    throw error;
  });
}

async function requireQueue(userId: string, queueId: string): Promise<VideoQueueRecord> {
  if (!UUID.test(queueId)) throw new VideoQueueError("Fila não encontrada.", 404, "NOT_FOUND");
  const queue = await getQueueForUser(queueId, userId);
  if (!queue || queue.status === "ARCHIVED") throw new VideoQueueError("Fila não encontrada.", 404, "NOT_FOUND");
  return queue;
}

async function requireItem(userId: string, itemId: string): Promise<VideoQueueItemRecord> {
  if (!UUID.test(itemId)) throw new VideoQueueError("Vídeo não encontrado.", 404, "NOT_FOUND");
  const item = await getItemForUser(itemId, userId);
  if (!item) throw new VideoQueueError("Vídeo não encontrado.", 404, "NOT_FOUND");
  return item;
}

// ──────────────────────────── Destinos ────────────────────────────

interface DestinationsInput {
  instagramAccountId: string;
  publishToInstagram: boolean;
  facebookPageIds: string[];
}

function readDestinations(body: Record<string, unknown>): DestinationsInput {
  const instagramAccountId = str(body.instagramAccountId);
  if (!UUID.test(instagramAccountId)) throw new VideoQueueError("Escolha a conta do Instagram desta fila.");
  const publishToInstagram = body.publishToInstagram !== false;
  const rawPages = body.facebookPageIds === undefined ? [] : body.facebookPageIds;
  if (!Array.isArray(rawPages) || rawPages.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new VideoQueueError("Páginas do Facebook inválidas.");
  }
  const facebookPageIds = [...new Set(rawPages as string[])];
  if (facebookPageIds.length > MAX_PAGES) throw new VideoQueueError(`Escolha no máximo ${MAX_PAGES} Páginas do Facebook.`);
  if (!publishToInstagram && facebookPageIds.length === 0) throw new VideoQueueError("Escolha pelo menos uma rede: Instagram e/ou uma Página do Facebook.");
  return { instagramAccountId, publishToInstagram, facebookPageIds };
}

/** Conta e Páginas precisam ser DO USUÁRIO e estar conectadas — nunca há troca automática de conta. */
async function assertDestinations(userId: string, input: DestinationsInput): Promise<void> {
  const account = await getInstagramAccountByIdForUser(input.instagramAccountId, userId);
  if (!account) throw new VideoQueueError("A conta do Instagram escolhida não foi encontrada na sua conta Alilu.");
  if (input.publishToInstagram && account.status !== "connected") {
    throw new VideoQueueError(`A conta do Instagram @${account.igUsername ?? "?"} está desconectada. Reconecte-a antes de usar na fila.`);
  }
  try {
    await resolveFacebookPages(userId, input.facebookPageIds);
    // Cada Página precisa estar AUTORIZADA para a conta Instagram da fila
    // (perfil de destinos). Nunca troca por outra Página.
    await authorizeFacebookPagesForAccount({
      userId,
      instagramAccountId: input.instagramAccountId,
      pageRefs: input.facebookPageIds,
      source: "video_queue",
    });
  } catch (error) {
    if (error instanceof SocialDestinationsError || error instanceof DestinationAuthorizationError) throw new VideoQueueError(error.message);
    throw error;
  }
}

function readSchedule(raw: unknown, base: QueueScheduleConfig = DEFAULT_SCHEDULE): QueueScheduleConfig {
  try {
    return normalizeScheduleConfig((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, base);
  } catch (error) {
    if (error instanceof QueueScheduleError) throw new VideoQueueError(error.message);
    throw error;
  }
}

function readTemplates(body: Record<string, unknown>): { captionTemplate: string; facebookCaptionTemplate: string | null } {
  const captionTemplate = str(body.captionTemplate).slice(0, MAX_TEMPLATE + 1);
  if (captionTemplate.length > MAX_TEMPLATE) throw new VideoQueueError(`O template de legenda pode ter no máximo ${MAX_TEMPLATE} caracteres.`);
  const hashtagError = validateCaption(captionTemplate);
  if (hashtagError) throw new VideoQueueError(hashtagError);
  const fb = str(body.facebookCaptionTemplate).trim();
  if (fb.length > 5000) throw new VideoQueueError("O template de legenda do Facebook pode ter no máximo 5000 caracteres.");
  return { captionTemplate, facebookCaptionTemplate: fb ? fb : null };
}

// ───────────────────────────── Links ─────────────────────────────

export interface AddLinksResult {
  added: number;
  duplicates: string[];
  rejected: Array<{ sourceUrl: string; reason: string }>;
  inOtherQueues: string[];
  waitingFile: number;
  overLimit: boolean;
}

async function addLinksToQueue(queue: VideoQueueRecord, text: string, now: Date): Promise<AddLinksResult> {
  const isAdmin = isAdminEmail(await getUserEmail(queue.userId));
  const parsed = parseQueueLinks(text, isAdmin ? Infinity : MAX_LINKS_PER_SUBMISSION);
  if (!isAdmin) {
    const current = await countActiveItems(queue.id);
    if (current + parsed.accepted.length > MAX_ITEMS_PER_QUEUE) {
      throw new VideoQueueError(`Uma fila pode ter no máximo ${MAX_ITEMS_PER_QUEUE} vídeos. Crie outra fila para os demais.`);
    }
  }
  const inOtherQueues = await findUrlsInOtherQueues(queue.userId, queue.id, parsed.accepted.map((link) => link.normalizedUrl));
  const { inserted, duplicates } = await insertItems(queue.id, queue.userId, parsed.accepted, now);
  if (inserted.length > 0) await insertEvent(queue.id, null, "links_added", `${inserted.length} link(s) adicionado(s).`);
  return {
    added: inserted.length,
    duplicates: [...parsed.duplicates, ...duplicates],
    rejected: parsed.rejected,
    inOtherQueues,
    waitingFile: inserted.filter((item) => item.status === "WAITING_FILE").length,
    overLimit: parsed.overLimit,
  };
}

// ──────────────────────────── Filas ────────────────────────────

export async function createQueue(userId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<{ queueId: string; links: AddLinksResult }> {
  if (body.rightsConfirmed !== true) {
    throw new VideoQueueError("Confirme que você tem os direitos ou a autorização para republicar estes vídeos.", 400, "AUTHORIZATION_REQUIRED");
  }
  const name = str(body.name).trim();
  if (!name || name.length > MAX_NAME) throw new VideoQueueError(`Dê um nome à fila (até ${MAX_NAME} caracteres).`);
  const category = str(body.category);
  const theme = str(body.theme);
  if (!findCategory(category)) throw new VideoQueueError("Categoria inválida.");
  if (!findTheme(category, theme)) throw new VideoQueueError("Tema inválido para esta categoria.");
  const destinations = readDestinations(body);
  await assertDestinations(userId, destinations);
  const schedule = readSchedule(body.schedule);
  const templates = readTemplates(body);

  const queueId = await insertQueue({ userId, name, category, theme, ...destinations, schedule, ...templates, rightsConfirmedAt: now });
  await insertEvent(queueId, null, "created", `Fila criada (${findTheme(category, theme)!.name}).`);
  const queue = (await getQueueForUser(queueId, userId))!;
  const links = await addLinksToQueue(queue, str(body.links), now);
  return { queueId, links };
}

export async function addLinks(userId: string, queueId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<AddLinksResult> {
  if (body.authorized !== true) {
    throw new VideoQueueError("Confirme que você tem os direitos ou a autorização para republicar estes vídeos.", 400, "AUTHORIZATION_REQUIRED");
  }
  const queue = await requireQueue(userId, queueId);
  if (queue.kind === "INSTAGRAM_RADAR") {
    throw new VideoQueueError("Adicione links a este radar pela tela do Radar Instagram.", 409, "RADAR_LINKS");
  }
  return busy(withPlanningLock(queue.id, async () => {
    const current = await requireQueue(userId, queueId);
    return addLinksToQueue(current, str(body.links), now);
  }, { wait: true }));
}

export interface QueueOverview {
  queue: VideoQueueRecord;
  counts: QueueCounts;
}

export async function listQueuesOverview(userId: string): Promise<QueueOverview[]> {
  const [queues, counts] = await Promise.all([listQueuesForUser(userId), countItemsByQueue(userId)]);
  return queues.map((queue) => ({ queue, counts: counts.get(queue.id) ?? emptyCounts() }));
}

/** Configurações: horários futuros, destinos, legendas. Desfaz o que ainda não começou e replaneja. */
export async function updateSettings(userId: string, queueId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<void> {
  const queue = await requireQueue(userId, queueId);
  if (queue.kind === "INSTAGRAM_RADAR") {
    // Radar tem regras próprias (1–10/dia, janela, só Instagram): edita-se pela tela do Radar Instagram.
    throw new VideoQueueError("Este é um Radar Instagram. Altere as configurações em Instagram › Radar Instagram.", 409, "RADAR_SETTINGS");
  }
  const name = body.name === undefined ? queue.name : str(body.name).trim();
  if (!name || name.length > MAX_NAME) throw new VideoQueueError(`Dê um nome à fila (até ${MAX_NAME} caracteres).`);
  const destinations = readDestinations({
    instagramAccountId: queue.instagramAccountId, // a conta Instagram da fila nunca muda (evita misturar contas)
    publishToInstagram: body.publishToInstagram === undefined ? queue.publishToInstagram : body.publishToInstagram,
    facebookPageIds: body.facebookPageIds === undefined ? queue.facebookPageIds : body.facebookPageIds,
  });
  await assertDestinations(userId, destinations);
  const schedule = readSchedule(body.schedule ?? {}, queue.schedule);
  const templates = readTemplates({
    captionTemplate: body.captionTemplate === undefined ? queue.captionTemplate : body.captionTemplate,
    facebookCaptionTemplate: body.facebookCaptionTemplate === undefined ? queue.facebookCaptionTemplate : body.facebookCaptionTemplate,
  });
  await busy(
    withPlanningLock(
      queue.id,
      async () => {
        await releaseFutureScheduledLocked(queue);
        await updateQueueSettings(queue.id, userId, { name, ...destinations, schedule, ...templates });
        await insertEvent(queue.id, null, "settings_updated", "Configurações alteradas; publicações futuras replanejadas.");
        await planQueueLocked(queue.id, now);
      },
      { wait: true },
    ),
  );
}

export type QueueAction = "activate" | "pause" | "resume" | "archive";

export async function applyQueueAction(userId: string, queueId: string, action: QueueAction, now: Date = new Date()): Promise<void> {
  const queue = await requireQueue(userId, queueId);
  await busy(
    withPlanningLock(
      queue.id,
      async () => {
        if (action === "activate" || action === "resume") {
          if (!(await setQueueStatus(queue.id, "ACTIVE", { fromStatuses: ["DRAFT", "PAUSED"] }))) {
            throw new VideoQueueError("A fila já está ativa.", 409, "INVALID_STATE");
          }
          await insertEvent(queue.id, null, action === "activate" ? "activated" : "resumed", null);
          const result = await planQueueLocked(queue.id, now);
          if (result.paused) throw new VideoQueueError(result.paused, 409, "TARGET_DISCONNECTED");
          return;
        }
        if (action === "pause") {
          if (queue.status !== "ACTIVE") throw new VideoQueueError("Só uma fila ativa pode ser pausada.", 409, "INVALID_STATE");
          await pauseQueueLocked(queue, "Pausada pelo usuário.", false);
          return;
        }
        await releaseFutureScheduledLocked(queue);
        await archiveQueue(queue.id, userId);
        await insertEvent(queue.id, null, "archived", null);
      },
      { wait: true },
    ),
  );
}

export async function reorderQueue(userId: string, queueId: string, orderedIds: unknown, now: Date = new Date()): Promise<void> {
  const queue = await requireQueue(userId, queueId);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new VideoQueueError("Ordem inválida.");
  }
  await busy(
    withPlanningLock(
      queue.id,
      async () => {
        await releaseFutureScheduledLocked(queue);
        await reorderItems(queue.id, userId, orderedIds as string[]);
        await insertEvent(queue.id, null, "reordered", null);
        await planQueueLocked(queue.id, now);
      },
      { wait: true },
    ),
  );
}

export async function retryErrors(userId: string, queueId: string, itemIds: unknown): Promise<number> {
  const queue = await requireQueue(userId, queueId);
  let ids: string[] | null = null;
  if (itemIds !== undefined && itemIds !== null) {
    if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== "string" || !UUID.test(id))) throw new VideoQueueError("Itens inválidos.");
    ids = itemIds as string[];
  }
  const count = await retryErroredItems(queue.id, userId, ids);
  if (count > 0) await insertEvent(queue.id, null, "retry", `${count} vídeo(s) com erro voltaram para a fila.`);
  return count;
}

/** "Processar agora": importa 1 vídeo desta fila e planeja — sem esperar o cron. */
export async function processNow(userId: string, queueId: string, now: Date = new Date()) {
  const queue = await requireQueue(userId, queueId);
  const results = await runQueueImports({
    maxItems: 1,
    maxInFlight: Number(process.env.VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS) || 2,
    deadline: Date.now() + 60_000,
    scope: { userId, queueId: queue.id },
  });
  let plan = null;
  if (queue.status === "ACTIVE") {
    plan = await withPlanningLock(queue.id, () => planQueueLocked(queue.id, now)).catch((error) => {
      if (error instanceof VideoQueueBusyError) return null;
      throw error;
    });
  }
  return { imports: results, plan };
}

// ───────────────────────────── Itens ─────────────────────────────

export async function prepareItemForImmediatePublish(userId: string, itemId: string): Promise<string> {
  const original = await requireItem(userId, itemId);
  const queue = await requireQueue(userId, original.queueId);
  if (queue.kind === "INSTAGRAM_RADAR") {
    // O radar publica só nos horários calculados (respeita N/dia e o intervalo da conta).
    throw new VideoQueueError("Vídeos do Radar Instagram são publicados apenas nos horários programados do radar.", 409, "RADAR_SCHEDULE_ONLY");
  }
  if (original.status === "PENDING") {
    await runQueueImports({
      maxItems: 1,
      maxInFlight: Number(process.env.VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS) || 2,
      deadline: Date.now() + 60_000,
      scope: { userId, queueId: queue.id, itemId },
    });
  }
  return busy(withPlanningLock(queue.id, async () => {
    const currentQueue = await requireQueue(userId, queue.id);
    const item = await requireItem(userId, itemId);
    if (item.status === "SCHEDULED" && item.postId) return item.postId;
    if (item.status !== "READY" || !item.blobUrl) {
      throw new VideoQueueError(item.statusMessage ?? "O vídeo ainda não está pronto. Aguarde o processamento e tente novamente.", 409);
    }
    const { postId, problem } = await materializeImmediateItemLocked(currentQueue, item, new Date());
    if (postId) return postId;
    const updated = await requireItem(userId, itemId);
    throw new VideoQueueError(problem ?? updated.statusMessage ?? "Não foi possível preparar a publicação.", 409);
  }, { wait: true }));
}

export async function updateItem(userId: string, itemId: string, body: Record<string, unknown>): Promise<VideoQueueItemRecord> {
  const item = await requireItem(userId, itemId);
  const read = (key: string, current: string | null, max: number): string | null => {
    if (body[key] === undefined) return current;
    if (body[key] === null) return null;
    if (typeof body[key] !== "string") throw new VideoQueueError("Texto inválido.");
    const value = (body[key] as string).trim();
    if (value.length > max) throw new VideoQueueError(`Texto longo demais (máx. ${max} caracteres).`);
    return value || null;
  };
  const title = read("title", item.title, 300);
  const caption = read("caption", item.caption, 2200);
  const facebookCaption = read("facebookCaption", item.facebookCaption, 5000);
  if (caption) {
    const error = validateCaption(caption);
    if (error) throw new VideoQueueError(error);
  }
  if (item.status === "SCHEDULED") {
    throw new VideoQueueError("Este vídeo já foi agendado. Edite a legenda em Minhas publicações ou pause a fila para replanejar.", 409, "ALREADY_SCHEDULED");
  }
  const updated = await updateItemContent(item.id, userId, { title, caption, facebookCaption });
  if (!updated) throw new VideoQueueError("Este vídeo não pode mais ser editado.", 409, "INVALID_STATE");
  return updated;
}

async function cancelItemInternal(item: VideoQueueItemRecord, message: string): Promise<void> {
  if ((IN_FLIGHT_STATUSES as string[]).includes(item.status)) {
    throw new VideoQueueError("Este vídeo está sendo importado agora. Aguarde alguns segundos e tente de novo.", 409, "IN_FLIGHT");
  }
  if (item.status === "SCHEDULED") {
    const queue = (await getQueueForUser(item.queueId, item.userId))!;
    await busy(
      withPlanningLock(
        queue.id,
        async () => {
          if (!item.postId || !(await cancelQueuePostIfUntouched(item.postId, item.userId))) {
            throw new VideoQueueError("A publicação deste vídeo já começou ou está a menos de 1 minuto — não dá para cancelar.", 409, "ALREADY_PUBLISHING");
          }
          await cancelScheduledItem(item.id, item.postId, message);
        },
        { wait: true },
      ),
    );
  } else if (!(await cancelUnscheduledItem(item.id, item.userId, message))) {
    throw new VideoQueueError("Este vídeo não pode ser cancelado.", 409, "INVALID_STATE");
  }
  await insertEvent(item.queueId, item.id, "cancelled", message);
}

export async function cancelItem(userId: string, itemId: string): Promise<void> {
  const item = await requireItem(userId, itemId);
  if (item.status === "CANCELLED") return;
  await cancelItemInternal(item, "Cancelado pelo usuário.");
}

export async function removeItem(userId: string, itemId: string): Promise<void> {
  const item = await requireItem(userId, itemId);
  if (item.status === "PUBLISHED") throw new VideoQueueError("Vídeos já publicados ficam no histórico.", 409, "INVALID_STATE");
  if (item.status !== "CANCELLED") await cancelItemInternal(item, "Removido pelo usuário.");
  const current = await getItemForUser(item.id, userId);
  if (current && current.postId) {
    // Ainda vinculado a uma publicação (histórico): fica cancelado, sem apagar.
    return;
  }
  const removed = await deleteItem(item.id, userId);
  if (!removed) return;
  for (const url of [removed.blobUrl, removed.thumbnailUrl]) {
    if (url && url.includes("/video-queue/")) await deleteBlob(url).catch(() => undefined);
  }
  await insertEvent(item.queueId, null, "removed", removed.sourceUrl.slice(0, 200));
}

function isOwnQueueUpload(url: string, userId: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!pathname.startsWith(queueUploadPrefix(userId)) || pathname.includes("..")) return null;
    return pathname;
  } catch {
    return null;
  }
}

/** Arquivo autorizado enviado pelo usuário (upload direto navegador → Blob). Validação real acontece no worker. */
export async function registerItemUpload(userId: string, itemId: string, body: Record<string, unknown>): Promise<VideoQueueItemRecord> {
  if (body.authorized !== true) {
    throw new VideoQueueError("Confirme que você tem os direitos ou a autorização para publicar este vídeo.", 400, "AUTHORIZATION_REQUIRED");
  }
  const item = await requireItem(userId, itemId);
  const blobUrl = str(body.blobUrl);
  const pathname = isOwnQueueUpload(blobUrl, userId);
  if (!pathname) throw new VideoQueueError("Envie o arquivo pela própria tela.", 400, "INVALID_UPLOAD");
  const updated = await attachUploadToItem(item.id, userId, blobUrl, pathname);
  if (!updated) throw new VideoQueueError("Este vídeo não aceita upload agora.", 409, "INVALID_STATE");
  await insertEvent(item.queueId, item.id, "file_uploaded", "Arquivo autorizado enviado pelo usuário.");
  return updated;
}

// ─────────────────────────── Painel ───────────────────────────

export interface PreviewEntry {
  itemId: string;
  position: number;
  at: string;
  projected: boolean;
}

/** Programação: horários reais das publicações já criadas + previsão para os vídeos restantes. */
export function buildPreview(
  queue: VideoQueueRecord,
  items: VideoQueueItemRecord[],
  occupied: Array<{ at: Date; own: boolean }>,
  now: Date,
  limit = 300,
): PreviewEntry[] {
  const fixed: PreviewEntry[] = items
    .filter((item) => (item.status === "SCHEDULED" || item.status === "PUBLISHED") && item.scheduledAtUtc)
    .map((item) => ({ itemId: item.id, position: item.position, at: item.scheduledAtUtc!.toISOString(), projected: false }));
  const pendingStatuses: VideoQueueItemStatus[] = ["PENDING", "VALIDATING", "IMPORTING", "PROCESSING", "READY", "WAITING_FILE"];
  const pending = items
    .filter((item) => pendingStatuses.includes(item.status))
    .sort((a, b) => (queue.schedule.orderMode === "REVERSE" ? b.position - a.position : a.position - b.position))
    .slice(0, limit);
  const slots = allocateSlots({ config: queue.schedule, now, occupied, count: pending.length });
  const projected = pending.slice(0, slots.length).map((item, index) => ({ itemId: item.id, position: item.position, at: slots[index].toISOString(), projected: true }));
  return [...fixed, ...projected].sort((a, b) => a.at.localeCompare(b.at));
}

export async function getQueueDashboard(userId: string, queueId: string, now: Date = new Date()) {
  const queue = await requireQueue(userId, queueId);
  const [items, countsMap, posts, destinations, events, occupied, account] = await Promise.all([
    listItemsForQueue(queue.id, userId),
    countItemsByQueue(userId, queue.id),
    listPostsForQueue(queue.id, userId),
    destinationViewsByPost(userId),
    listEvents(queue.id, userId, 60),
    listOccupiedSlots({
      userId,
      queueId: queue.id,
      instagramAccountId: queue.instagramAccountId,
      includeInstagram: queue.publishToInstagram,
      facebookPageIds: queue.facebookPageIds,
      from: new Date(now.getTime() - 2 * 24 * 3600_000),
    }),
    getInstagramAccountByIdForUser(queue.instagramAccountId, userId),
  ]);
  const pages = await Promise.all(queue.facebookPageIds.map((id) => getFacebookPageForUser(id, userId)));
  const preview = buildPreview(queue, items, occupied, now);
  const counts = countsMap.get(queue.id) ?? emptyCounts();
  const nextProjected = preview.find((entry) => new Date(entry.at) > now);
  return {
    queue,
    counts,
    nextPublicationAt: counts.nextPublicationAt?.toISOString() ?? nextProjected?.at ?? null,
    account: account ? { id: account.id, username: account.igUsername, status: account.status } : null,
    pages: pages.map((page, index) =>
      page
        ? { id: page.id, name: page.pageName, status: page.hasToken ? page.status : "revoked" }
        : { id: queue.facebookPageIds[index], name: "Página removida", status: "revoked" },
    ),
    items: items.map((item) => ({
      item,
      post: item.postId ? (posts.get(item.postId) ?? null) : null,
      destinations: item.postId ? ((destinations.get(item.postId) ?? []) as PublicationDestinationView[]) : [],
    })),
    preview,
    events,
  };
}
