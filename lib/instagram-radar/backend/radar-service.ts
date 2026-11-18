import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { getInstagramAccountByIdForUser, listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { normalizeHashtags, MAX_RADAR_HASHTAGS_TEXT, needsCaptionReview, composeRadarCaption, validateRadarCaption } from "@/lib/instagram-radar/captions";
import { isRadarQueue, radarConfigFromQueue, radarPublishTimes } from "@/lib/instagram-radar/radar-config";
import {
  DEFAULT_RADAR_SCHEDULE,
  RadarScheduleError,
  accountDailyCap,
  allocateRadarSlots,
  describeDailyTimes,
  estimateDaysToConsume,
  normalizeRadarSchedule,
  type RadarScheduleConfig,
  type RadarSkipReason,
} from "@/lib/instagram-radar/schedule";
import { parseQueueLinks } from "@/lib/video-queue/links";
import { MAX_ITEMS_PER_QUEUE, MAX_LINKS_PER_SUBMISSION, type VideoQueueItemStatus } from "@/lib/video-queue/types";
import { releaseFutureScheduledLocked, planQueueLocked, VideoQueueBusyError, withPlanningLock } from "@/lib/video-queue/backend/queue-planner";
import {
  countActiveItems,
  countItemsByQueue,
  emptyCounts,
  getQueueForUser,
  getUserEmail,
  insertEvent,
  insertItems,
  listEvents,
  listItemsForQueue,
  listPostsForQueue,
  listQueuesForUser,
  setQueueProcessingOptions,
  type QueueCounts,
  type VideoQueueItemRecord,
  type VideoQueueRecord,
} from "@/lib/video-queue/backend/queue-repository";
import { VideoQueueError } from "@/lib/video-queue/backend/queue-service";
import {
  findUrlsAlreadyOnAccount,
  insertRadar,
  listAccountOccupiedSlots,
  listActiveRadarLimitsForAccount,
  listRadarsForAccount,
  updateRadar,
  type MissingCaptionPolicy,
} from "./radar-repository";

/**
 * Regras do Radar Instagram. Um radar = uma fila (video_queues, kind
 * INSTAGRAM_RADAR) ligada a UMA conta Instagram escolhida explicitamente.
 * Importação, worker, planejamento, publicação e cron são os da Fila de
 * vídeos; aqui ficam a validação (conta do usuário, 1–10/dia, intervalo,
 * janela), os links e a prévia. Nunca há Facebook nem troca de conta.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 80;
const MAX_TEMPLATE = 2200;
export const MAX_TXT_BYTES = 512 * 1024;

export class RadarError extends VideoQueueError {
  constructor(
    message: string,
    httpStatus = 400,
    code = "INVALID",
    readonly suggestions: string[] = [],
  ) {
    super(message, httpStatus, code);
    this.name = "RadarError";
  }
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function busy<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error) => {
    if (error instanceof VideoQueueBusyError) throw new RadarError(error.message, 409, "BUSY");
    throw error;
  });
}

export async function requireRadar(userId: string, radarId: string): Promise<VideoQueueRecord> {
  if (!UUID.test(radarId)) throw new RadarError("Radar não encontrado.", 404, "NOT_FOUND");
  const queue = await getQueueForUser(radarId, userId);
  if (!queue || queue.status === "ARCHIVED" || !isRadarQueue(queue)) throw new RadarError("Radar não encontrado.", 404, "NOT_FOUND");
  return queue;
}

/** A conta precisa ser DO USUÁRIO e estar conectada. Nunca há conta padrão nem troca automática. */
async function requireAccount(userId: string, instagramAccountId: unknown) {
  const id = str(instagramAccountId);
  if (!UUID.test(id)) throw new RadarError("Escolha a conta do Instagram de destino deste radar.", 400, "ACCOUNT_REQUIRED");
  const account = await getInstagramAccountByIdForUser(id, userId);
  if (!account) throw new RadarError("A conta do Instagram escolhida não foi encontrada na sua conta Alilu.", 404, "ACCOUNT_NOT_FOUND");
  if (account.status !== "connected") {
    throw new RadarError(`A conta @${account.igUsername ?? "?"} está desconectada. Reconecte essa mesma conta antes de usar no radar.`, 409, "ACCOUNT_DISCONNECTED");
  }
  return account;
}

export function readRadarSchedule(raw: unknown, base: RadarScheduleConfig = DEFAULT_RADAR_SCHEDULE): RadarScheduleConfig {
  try {
    return normalizeRadarSchedule((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, base);
  } catch (error) {
    if (error instanceof RadarScheduleError) throw new RadarError(error.message, 400, "INVALID_SCHEDULE", error.suggestions);
    throw error;
  }
}

interface CaptionSettings {
  captionTemplate: string;
  hashtags: string;
  missingCaptionPolicy: MissingCaptionPolicy;
  notReadyPolicy: "WAIT" | "NEXT_READY";
}

function readCaptionSettings(body: Record<string, unknown>, current?: CaptionSettings): CaptionSettings {
  const captionTemplate = body.captionTemplate === undefined && current ? current.captionTemplate : str(body.captionTemplate).trim();
  if (captionTemplate.length > MAX_TEMPLATE) throw new RadarError(`A legenda padrão pode ter no máximo ${MAX_TEMPLATE} caracteres.`);
  const hashtagsRaw = body.hashtags === undefined && current ? current.hashtags : str(body.hashtags);
  if (hashtagsRaw.length > MAX_RADAR_HASHTAGS_TEXT) throw new RadarError("Hashtags longas demais.");
  const hashtags = normalizeHashtags(hashtagsRaw);
  const sample = composeRadarCaption({ ownCaption: null, title: "", template: captionTemplate, hashtags, radarName: "", numero: 1, total: 1 });
  const captionError = validateRadarCaption(sample);
  if (captionError) throw new RadarError(captionError);
  const policyRaw = body.missingCaptionPolicy === undefined && current ? current.missingCaptionPolicy : body.missingCaptionPolicy;
  const missingCaptionPolicy: MissingCaptionPolicy = policyRaw === "REVIEW" ? "REVIEW" : "DEFAULT";
  const readyRaw = body.notReadyPolicy === undefined && current ? current.notReadyPolicy : body.notReadyPolicy;
  const notReadyPolicy = readyRaw === "WAIT" ? "WAIT" : "NEXT_READY";
  return { captionTemplate, hashtags, missingCaptionPolicy, notReadyPolicy };
}

function readName(value: unknown): string {
  const name = str(value).trim();
  if (!name || name.length > MAX_NAME) throw new RadarError(`Dê um nome ao radar (até ${MAX_NAME} caracteres).`);
  return name;
}

// ───────────────────────────── Links ─────────────────────────────

export type RadarLinksMode = "AUTHORIZED" | "REFERENCE";

export interface RadarLinksResult {
  added: number;
  /** Links que entraram só como referência (aguardando arquivo autorizado). */
  waitingFile: number;
  duplicates: string[];
  rejected: Array<{ sourceUrl: string; reason: string }>;
  /** Já agendados/publicados na MESMA conta por outro radar ou fila (não entram de novo). */
  alreadyOnAccount: string[];
  overLimit: boolean;
}

/**
 * Lê o modo dos links: "AUTHORIZED" exige a declaração de direitos e usa o
 * importador existente; "REFERENCE" (ou sem declaração) só registra o link —
 * nada é baixado até o arquivo autorizado ser enviado.
 */
function readLinksMode(body: Record<string, unknown>): { mode: RadarLinksMode; authorized: boolean } {
  const mode: RadarLinksMode = body.mode === "REFERENCE" ? "REFERENCE" : "AUTHORIZED";
  if (mode === "AUTHORIZED" && body.authorized !== true) {
    throw new RadarError(
      "Para importar os vídeos, confirme que você é o autor ou tem autorização para republicá-los. Sem autorização, escolha \"Registrar só como referência\".",
      400,
      "AUTHORIZATION_REQUIRED",
    );
  }
  return { mode, authorized: mode === "AUTHORIZED" };
}

async function addLinksLocked(queue: VideoQueueRecord, text: string, mode: RadarLinksMode, now: Date): Promise<RadarLinksResult> {
  if (text.length > MAX_TXT_BYTES * 2) throw new RadarError("Texto grande demais. Envie no máximo 512 KB de links por vez.");
  const isAdmin = isAdminEmail(await getUserEmail(queue.userId));
  const parsed = parseQueueLinks(text, isAdmin ? Infinity : MAX_LINKS_PER_SUBMISSION);
  if (!isAdmin) {
    const current = await countActiveItems(queue.id);
    if (current + parsed.accepted.length > MAX_ITEMS_PER_QUEUE) {
      throw new RadarError(`Um radar pode ter no máximo ${MAX_ITEMS_PER_QUEUE} vídeos. Crie outro radar para os demais.`);
    }
  }
  // Mesmo vídeo já agendado/publicado NESTA conta (por outro radar ou fila): não entra de novo.
  const already = new Set(await findUrlsAlreadyOnAccount(queue.userId, queue.instagramAccountId, queue.id, parsed.accepted.map((link) => link.normalizedUrl)));
  const fresh = parsed.accepted.filter((link) => !already.has(link.normalizedUrl));
  const { inserted, duplicates } = await insertItems(queue.id, queue.userId, fresh, now, { referenceOnly: mode === "REFERENCE" });
  if (inserted.length > 0) {
    await insertEvent(queue.id, null, "links_added", `${inserted.length} link(s) adicionado(s)${mode === "REFERENCE" ? " como referência (aguardando arquivo autorizado)" : ""}.`);
  }
  return {
    added: inserted.length,
    waitingFile: inserted.filter((item) => item.status === "WAITING_FILE").length,
    duplicates: [...parsed.duplicates, ...duplicates],
    rejected: parsed.rejected,
    alreadyOnAccount: parsed.accepted.filter((link) => already.has(link.normalizedUrl)).map((link) => link.sourceUrl),
    overLimit: parsed.overLimit,
  };
}

// ───────────────────────────── Radar ─────────────────────────────

export async function createRadar(userId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<{ radarId: string; links: RadarLinksResult }> {
  const name = readName(body.name);
  const account = await requireAccount(userId, body.instagramAccountId);
  const schedule = readRadarSchedule(body.schedule);
  const captions = readCaptionSettings(body);
  const links = str(body.links);
  const { mode } = links.trim() ? readLinksMode(body) : { mode: "REFERENCE" as RadarLinksMode };

  const radarId = await insertRadar({
    userId,
    name,
    instagramAccountId: account.id,
    schedule,
    ...captions,
    publishTimes: radarPublishTimes(schedule),
    rightsConfirmedAt: now,
  });
  // Mesmo arquivo (hash) já usado nesta conta não é publicado de novo.
  await setQueueProcessingOptions(radarId, userId, { blockDuplicateFiles: true, reframeMode: "NONE", maxDurationSeconds: null });
  await insertEvent(radarId, null, "created", `Radar criado para @${account.igUsername ?? account.igUserId} (${schedule.postsPerDay}/dia).`);
  const queue = (await getQueueForUser(radarId, userId))!;
  const result = links.trim() ? await addLinksLocked(queue, links, mode, now) : { added: 0, waitingFile: 0, duplicates: [], rejected: [], alreadyOnAccount: [], overLimit: false };
  return { radarId, links: result };
}

export async function addRadarLinks(userId: string, radarId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<RadarLinksResult> {
  const { mode } = readLinksMode(body);
  const queue = await requireRadar(userId, radarId);
  return busy(
    withPlanningLock(
      queue.id,
      async () => addLinksLocked(await requireRadar(userId, radarId), str(body.links), mode, now),
      { wait: true },
    ),
  );
}

/** Altera nome, frequência, janela e legendas das publicações FUTURAS (a conta nunca muda). */
export async function updateRadarSettings(userId: string, radarId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<void> {
  const queue = await requireRadar(userId, radarId);
  if (body.instagramAccountId !== undefined && body.instagramAccountId !== queue.instagramAccountId) {
    throw new RadarError("A conta de destino de um radar não pode ser trocada. Crie outro radar para outra conta.", 409, "ACCOUNT_LOCKED");
  }
  const name = body.name === undefined ? queue.name : readName(body.name);
  const schedule = readRadarSchedule(body.schedule ?? {}, radarConfigFromQueue(queue));
  const captions = readCaptionSettings(body, {
    captionTemplate: queue.captionTemplate,
    hashtags: queue.radar?.hashtags ?? "",
    missingCaptionPolicy: queue.radar?.missingCaptionPolicy ?? "DEFAULT",
    notReadyPolicy: queue.schedule.notReadyPolicy,
  });
  await busy(
    withPlanningLock(
      queue.id,
      async () => {
        await releaseFutureScheduledLocked(queue);
        await updateRadar(queue.id, userId, { name, schedule, ...captions, publishTimes: radarPublishTimes(schedule) });
        await insertEvent(queue.id, null, "settings_updated", `Frequência: ${schedule.postsPerDay}/dia, ${schedule.intervalMinutes} min, ${schedule.windowStart}–${schedule.windowEnd}. Publicações futuras replanejadas.`);
        await planQueueLocked(queue.id, now);
      },
      { wait: true },
    ),
  );
}

// ───────────────────────────── Prévia ─────────────────────────────

export interface RadarPreview {
  account: { id: string; username: string | null; status: string };
  schedule: RadarScheduleConfig;
  dailyTimesLabel: string;
  linksCount: number;
  readyCount: number;
  awaitingFileCount: number;
  awaitingCaptionReviewCount: number;
  accountDailyCap: number;
  otherRadarsOnAccount: Array<{ id: string; name: string; status: string; postsPerDay: number }>;
  nextSlots: string[];
  projected: Array<{ itemId: string | null; position: number; at: string }>;
  /** Dias para publicar os vídeos JÁ prontos (se todos continuarem elegíveis e as publicações derem certo). */
  estimatedDaysForReady: number;
  estimatedDaysForAll: number;
  skipped: Array<{ at: string; reason: RadarSkipReason }>;
  warnings: string[];
}

const PENDING_FOR_PREVIEW: VideoQueueItemStatus[] = ["PENDING", "VALIDATING", "IMPORTING", "PROCESSING", "READY", "WAITING_FILE"];

/** Prévia: horários calculados, considerando TODOS os agendamentos já existentes na conta. Não garante sucesso. */
export async function buildRadarPreview(input: {
  userId: string;
  queueId: string | null;
  account: { id: string; igUsername: string | null; status: string };
  schedule: RadarScheduleConfig;
  items: Array<Pick<VideoQueueItemRecord, "id" | "position" | "status" | "caption">>;
  linksWithoutItems?: number;
  missingCaptionPolicy: MissingCaptionPolicy;
  now: Date;
}): Promise<RadarPreview> {
  const { schedule, now } = input;
  const queueId = input.queueId ?? "00000000-0000-0000-0000-000000000000";
  const [occupied, activeRadars, radarsOnAccount] = await Promise.all([
    listAccountOccupiedSlots({ userId: input.userId, instagramAccountId: input.account.id, queueId, from: new Date(now.getTime() - 2 * 24 * 3600_000) }),
    listActiveRadarLimitsForAccount(input.userId, input.account.id),
    listRadarsForAccount(input.userId, input.account.id),
  ]);
  const others = activeRadars.filter((radar) => radar.id !== input.queueId);
  const cap = accountDailyCap([...others.map((radar) => radar.postsPerDay), schedule.postsPerDay]);

  const pending = input.items.filter((item) => PENDING_FOR_PREVIEW.includes(item.status)).sort((a, b) => a.position - b.position);
  const reviewBlocked = pending.filter((item) => needsCaptionReview(input.missingCaptionPolicy, item.caption));
  const ready = pending.filter((item) => item.status === "READY" && !needsCaptionReview(input.missingCaptionPolicy, item.caption));
  const extra = input.linksWithoutItems ?? 0;
  const totalPending = Math.min(pending.length + extra, 1000);

  const all = allocateRadarSlots({ config: schedule, now, occupied, count: Math.max(totalPending, 10), accountDailyCap: cap });
  const readySlots = allocateRadarSlots({ config: schedule, now, occupied, count: ready.length, accountDailyCap: cap }).slots;
  const projected = all.slots.slice(0, totalPending).map((at, index) => ({
    itemId: pending[index]?.id ?? null,
    position: pending[index]?.position ?? index + 1,
    at: at.toISOString(),
  }));

  const warnings: string[] = [];
  if (others.length > 0) {
    warnings.push(
      `Outro(s) radar(es) ativo(s) usam esta conta (${others.map((radar) => `${radar.name}: ${radar.postsPerDay}/dia`).join(", ")}). O limite combinado da conta é ${cap} publicação(ões) por dia, somando todos os radares e agendamentos.`,
    );
  } else if (cap < schedule.postsPerDay) {
    warnings.push(`O limite combinado da conta é ${cap} publicação(ões) por dia.`);
  }
  const conflicts = all.skipped.filter((entry) => entry.reason === "INTERVAL_CONFLICT").length;
  const capped = all.skipped.filter((entry) => entry.reason === "ACCOUNT_DAILY_LIMIT").length;
  if (conflicts > 0) warnings.push(`${conflicts} horário(s) foram pulados porque já há outra publicação nesta conta a menos do intervalo mínimo. O horário não é deslocado.`);
  if (capped > 0) warnings.push(`${capped} horário(s) foram pulados porque a conta já atingiu o limite do dia com outros agendamentos.`);
  if (reviewBlocked.length > 0) warnings.push(`${reviewBlocked.length} vídeo(s) só serão agendados depois da revisão da legenda.`);
  if (input.account.status !== "connected") warnings.push("A conta está desconectada: nada será publicado até reconectar a MESMA conta.");

  return {
    account: { id: input.account.id, username: input.account.igUsername, status: input.account.status },
    schedule,
    dailyTimesLabel: describeDailyTimes(schedule),
    linksCount: pending.length + extra,
    readyCount: ready.length,
    awaitingFileCount: input.items.filter((item) => item.status === "WAITING_FILE").length,
    awaitingCaptionReviewCount: reviewBlocked.length,
    accountDailyCap: cap,
    otherRadarsOnAccount: radarsOnAccount.filter((radar) => radar.id !== input.queueId),
    nextSlots: all.slots.slice(0, 10).map((at) => at.toISOString()),
    projected: projected.slice(0, 300),
    estimatedDaysForReady: estimateDaysToConsume(readySlots, schedule.timezone),
    estimatedDaysForAll: estimateDaysToConsume(all.slots.slice(0, totalPending), schedule.timezone),
    skipped: all.skipped.slice(0, 20).map((entry) => ({ at: entry.at.toISOString(), reason: entry.reason })),
    warnings,
  };
}

/** Prévia ANTES de criar o radar (conta + programação + links colados). */
export async function previewNewRadar(userId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<RadarPreview> {
  const account = await requireAccount(userId, body.instagramAccountId);
  const schedule = readRadarSchedule(body.schedule);
  const parsed = parseQueueLinks(str(body.links), Infinity);
  return buildRadarPreview({
    userId,
    queueId: null,
    account,
    schedule,
    items: [],
    linksWithoutItems: parsed.accepted.length,
    missingCaptionPolicy: body.missingCaptionPolicy === "REVIEW" ? "REVIEW" : "DEFAULT",
    now,
  });
}

// ───────────────────────────── Painel ─────────────────────────────

export interface RadarOverview {
  queue: VideoQueueRecord;
  counts: QueueCounts;
  account: { id: string; username: string | null; status: string } | null;
}

export async function listRadarsOverview(userId: string): Promise<RadarOverview[]> {
  const [queues, counts, accounts] = await Promise.all([listQueuesForUser(userId, "INSTAGRAM_RADAR"), countItemsByQueue(userId), listInstagramAccountsForUser(userId)]);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return queues.map((queue) => {
    const account = byId.get(queue.instagramAccountId);
    return {
      queue,
      counts: counts.get(queue.id) ?? emptyCounts(),
      account: account ? { id: account.id, username: account.igUsername, status: account.status } : null,
    };
  });
}

export async function getRadarDashboard(userId: string, radarId: string, now: Date = new Date()) {
  const queue = await requireRadar(userId, radarId);
  const [items, countsMap, posts, events, account] = await Promise.all([
    listItemsForQueue(queue.id, userId),
    countItemsByQueue(userId, queue.id),
    listPostsForQueue(queue.id, userId),
    listEvents(queue.id, userId, 80),
    getInstagramAccountByIdForUser(queue.instagramAccountId, userId),
  ]);
  const schedule = radarConfigFromQueue(queue);
  const preview = await buildRadarPreview({
    userId,
    queueId: queue.id,
    account: account ?? { id: queue.instagramAccountId, igUsername: null, status: "revoked" },
    schedule,
    items,
    missingCaptionPolicy: queue.radar?.missingCaptionPolicy ?? "DEFAULT",
    now,
  });
  const counts = countsMap.get(queue.id) ?? emptyCounts();
  return {
    queue,
    schedule,
    counts,
    nextPublicationAt: counts.nextPublicationAt?.toISOString() ?? preview.nextSlots[0] ?? null,
    account: account ? { id: account.id, username: account.igUsername, status: account.status } : null,
    items: items.map((item) => ({ item, post: item.postId ? (posts.get(item.postId) ?? null) : null })),
    preview,
    events,
  };
}
