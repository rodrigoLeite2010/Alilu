import "server-only";
import { randomUUID } from "node:crypto";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { findTheme } from "@/lib/video-queue/catalog";
import { applyQueueAction, createQueue, retryErrors, VideoQueueError } from "@/lib/video-queue/backend/queue-service";
import { countItemsByQueue, emptyCounts, getQueueForUser, setQueueProcessingOptions } from "@/lib/video-queue/backend/queue-repository";
import { normalizeSettings, normalizeSource, normalizeSources, RadarConfigError } from "@/lib/viral-radar/config";
import { buildPerformanceReport } from "@/lib/viral-radar/insights";
import { MAX_RADARS_PER_USER, MAX_SOURCES_PER_RADAR, isLicenseScopeComplete, type LicenseScope } from "@/lib/viral-radar/types";
import { briefWithAi, RadarAiUnavailable } from "./ai-service";
import { connectorAvailability, fetchTrustedHeadlines, utcDay, youtubeDailyUnitCap } from "./connectors";
import {
  approveCandidate,
  archiveRadar,
  claimRadarForManualRun,
  countRadarCandidates,
  countRadarsForUser,
  deleteSource,
  findRadarByQueue,
  getCandidateForUser,
  getProviderUsage,
  getQueueStock,
  getRadarForUser,
  getSourceForUser,
  insertRadar,
  insertRadarEvent,
  insertSource,
  listCandidatesForUser,
  listExecutions,
  listLatestPostMetrics,
  listRadarEvents,
  listRadarsForUser,
  listSources,
  saveCandidateBrief,
  setCandidateStatus,
  setRadarStatus,
  sumUsageSince,
  updateRadarSettings,
  updateSource,
  type RadarRecord,
} from "./radar-repository";
import { enqueueApprovedCandidate, RUN_LOCK_TTL_SECONDS, runRadar } from "./radar-runner";

/**
 * Regras de negócio das telas do Radar Viral. Tudo é filtrado pelo usuário
 * da sessão (radar, fontes, candidatos, fila, contas). Contas, horários e
 * publicação ficam na Fila de vídeos ligada — nada é duplicado aqui.
 */

export class ViralRadarError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 400,
    readonly code = "INVALID",
  ) {
    super(message);
    this.name = "ViralRadarError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function wrap<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RadarConfigError) throw new ViralRadarError(error.message);
    throw error;
  }
}

async function requireRadar(userId: string, radarId: string): Promise<RadarRecord> {
  if (!UUID.test(radarId)) throw new ViralRadarError("Radar não encontrado.", 404, "NOT_FOUND");
  const radar = await getRadarForUser(radarId, userId);
  if (!radar || radar.status === "ARCHIVED") throw new ViralRadarError("Radar não encontrado.", 404, "NOT_FOUND");
  return radar;
}

function readProcessing(body: Record<string, unknown>): { reframeMode: "NONE" | "FIT_9_16"; maxDurationSeconds: number | null } {
  const reframeMode = body.reframeMode === "FIT_9_16" ? "FIT_9_16" : "NONE";
  let maxDurationSeconds: number | null = null;
  if (body.maxDurationSeconds !== undefined && body.maxDurationSeconds !== null && body.maxDurationSeconds !== "") {
    const value = Number(body.maxDurationSeconds);
    if (!Number.isInteger(value) || value < 3 || value > 900) throw new ViralRadarError("Duração máxima: entre 3 e 900 segundos.");
    maxDurationSeconds = value;
  }
  return { reframeMode, maxDurationSeconds };
}

// ───────────────────────────── Radares ─────────────────────────────

/**
 * Cria o radar e a Fila de vídeos dele (ou liga a uma fila existente do
 * usuário). A fila nasce com bloqueio de arquivo duplicado ligado e,
 * opcionalmente, adaptação 9:16. A publicação só começa quando a fila é
 * ativada (`activatePublishing` ou pelo painel da fila).
 */
export async function createRadar(userId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<{ radarId: string; queueId: string }> {
  if ((await countRadarsForUser(userId)) >= MAX_RADARS_PER_USER) throw new ViralRadarError(`Limite de ${MAX_RADARS_PER_USER} radares por conta.`);
  const settings = wrap(() => normalizeSettings(body));
  const sources = wrap(() => normalizeSources(body.sources));
  const processing = readProcessing(body);
  if (body.rightsConfirmed !== true) {
    throw new ViralRadarError("Confirme que só serão publicados vídeos próprios, licenciados ou aprovados por você com autorização.", 400, "AUTHORIZATION_REQUIRED");
  }

  let queueId: string;
  const existingQueueId = typeof body.queueId === "string" && body.queueId ? body.queueId : null;
  if (existingQueueId) {
    if (!UUID.test(existingQueueId)) throw new ViralRadarError("Fila inválida.");
    const queue = await getQueueForUser(existingQueueId, userId);
    if (!queue || queue.status === "ARCHIVED") throw new ViralRadarError("Fila não encontrada.");
    if (await findRadarByQueue(queue.id)) throw new ViralRadarError("Essa fila já pertence a outro radar (os radares não compartilham filas).");
    queueId = queue.id;
  } else {
    const publication = (body.publication && typeof body.publication === "object" ? body.publication : {}) as Record<string, unknown>;
    try {
      const created = await createQueue(
        userId,
        {
          name: `${settings.name} — fila`.slice(0, 80),
          category: settings.category,
          theme: settings.theme,
          instagramAccountId: publication.instagramAccountId,
          publishToInstagram: publication.publishToInstagram,
          facebookPageIds: publication.facebookPageIds,
          schedule: publication.schedule,
          captionTemplate: typeof publication.captionTemplate === "string" ? publication.captionTemplate : "",
          facebookCaptionTemplate: publication.facebookCaptionTemplate,
          rightsConfirmed: true,
          links: "",
        },
        now,
      );
      queueId = created.queueId;
    } catch (error) {
      if (error instanceof VideoQueueError) throw new ViralRadarError(error.message, error.httpStatus, error.code);
      throw error;
    }
  }
  await setQueueProcessingOptions(queueId, userId, { blockDuplicateFiles: true, ...processing });

  const radarId = await insertRadar(userId, settings, queueId, now);
  for (const source of sources) await insertSource(radarId, userId, source, now);
  await insertRadarEvent(radarId, null, "created", `Radar criado (${findTheme(settings.category, settings.theme)?.name ?? settings.theme}).`);

  if (body.activatePublishing === true) {
    try {
      await applyQueueAction(userId, queueId, "activate", now);
      await insertRadarEvent(radarId, null, "publishing_activated", "Publicação automática ativada na fila do radar.");
    } catch (error) {
      // O radar existe mesmo assim; o painel mostra a fila em rascunho com o motivo.
      if (!(error instanceof VideoQueueError)) throw error;
      await insertRadarEvent(radarId, null, "publishing_not_activated", error.message);
    }
  }
  return { radarId, queueId };
}

export async function updateRadar(userId: string, radarId: string, body: Record<string, unknown>): Promise<void> {
  const radar = await requireRadar(userId, radarId);
  const settings = wrap(() => normalizeSettings(body, radar));
  await updateRadarSettings(radar.id, userId, settings);
  if (radar.queueId && (body.reframeMode !== undefined || body.maxDurationSeconds !== undefined)) {
    await setQueueProcessingOptions(radar.queueId, userId, { blockDuplicateFiles: true, ...readProcessing(body) });
  }
  await insertRadarEvent(radar.id, null, "settings_updated", null);
}

export type RadarAction = "pause" | "resume" | "archive" | "run" | "activate_publishing";

export async function applyRadarAction(userId: string, radarId: string, action: RadarAction, now: Date = new Date()) {
  const radar = await requireRadar(userId, radarId);
  if (action === "pause") {
    if (!(await setRadarStatus(radar.id, userId, "PAUSED", "Pausado pelo usuário.", ["ACTIVE"]))) throw new ViralRadarError("O radar não está ativo.", 409, "INVALID_STATE");
    await insertRadarEvent(radar.id, null, "paused", null);
    return { ok: true };
  }
  if (action === "resume") {
    if (!radar.queueId) throw new ViralRadarError("Ligue o radar a uma fila de vídeos antes de retomar.", 409, "NO_QUEUE");
    if (!(await setRadarStatus(radar.id, userId, "ACTIVE", null, ["PAUSED"]))) throw new ViralRadarError("O radar não está pausado.", 409, "INVALID_STATE");
    await insertRadarEvent(radar.id, null, "resumed", null);
    return { ok: true };
  }
  if (action === "archive") {
    await archiveRadar(radar.id, userId);
    await insertRadarEvent(radar.id, null, "archived", "A fila de vídeos ligada continua existindo (gerencie em Filas de vídeos).");
    return { ok: true };
  }
  if (action === "activate_publishing") {
    if (!radar.queueId) throw new ViralRadarError("Radar sem fila ligada.", 409, "NO_QUEUE");
    try {
      await applyQueueAction(userId, radar.queueId, "activate", now);
    } catch (error) {
      if (error instanceof VideoQueueError) throw new ViralRadarError(error.message, error.httpStatus, error.code);
      throw error;
    }
    await insertRadarEvent(radar.id, null, "publishing_activated", null);
    return { ok: true };
  }
  // "Executar agora": mesmo lock do cron; orçamento curto (a rota tem limite de tempo).
  const token = randomUUID();
  const claimed = await claimRadarForManualRun(radar.id, userId, now, token, RUN_LOCK_TTL_SECONDS);
  if (!claimed) throw new ViralRadarError("O radar já está em execução. Aguarde alguns instantes.", 409, "BUSY");
  const result = await runRadar(claimed, "MANUAL", token, { deadline: Date.now() + 45_000 });
  return { ok: true, status: result.status, message: result.message, queued: result.stats.queued };
}

// ───────────────────────────── Fontes ─────────────────────────────

export async function addSource(userId: string, radarId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<string> {
  const radar = await requireRadar(userId, radarId);
  if ((await listSources(radar.id)).length >= MAX_SOURCES_PER_RADAR) throw new ViralRadarError(`No máximo ${MAX_SOURCES_PER_RADAR} fontes por radar.`);
  const source = wrap(() => normalizeSource(body));
  const id = await insertSource(radar.id, userId, source, now);
  await insertRadarEvent(radar.id, null, "source_added", `${source.type}${source.license !== "NONE" ? ` (${source.license})` : ""}`);
  return id;
}

export async function editSource(userId: string, sourceId: string, body: Record<string, unknown>, now: Date = new Date()): Promise<void> {
  if (!UUID.test(sourceId)) throw new ViralRadarError("Fonte não encontrada.", 404, "NOT_FOUND");
  const existing = await getSourceForUser(sourceId, userId);
  if (!existing) throw new ViralRadarError("Fonte não encontrada.", 404, "NOT_FOUND");
  const source = wrap(() => normalizeSource({ ...body, type: body.type ?? existing.type }));
  await updateSource(sourceId, userId, source, now);
  await insertRadarEvent(existing.radarId, null, "source_updated", `${source.type}${source.license !== "NONE" ? ` (${source.license})` : ""}`);
}

export async function removeSource(userId: string, sourceId: string): Promise<void> {
  if (!UUID.test(sourceId)) throw new ViralRadarError("Fonte não encontrada.", 404, "NOT_FOUND");
  const existing = await getSourceForUser(sourceId, userId);
  if (!existing || !(await deleteSource(sourceId, userId))) throw new ViralRadarError("Fonte não encontrada.", 404, "NOT_FOUND");
  await insertRadarEvent(existing.radarId, null, "source_removed", existing.type);
}

// ──────────────────────────── Candidatos ────────────────────────────

export type CandidateAction = "approve" | "ignore" | "restore" | "brief" | "reprocess";

async function requireCandidate(userId: string, candidateId: string) {
  if (!UUID.test(candidateId)) throw new ViralRadarError("Candidato não encontrado.", 404, "NOT_FOUND");
  const candidate = await getCandidateForUser(candidateId, userId);
  if (!candidate) throw new ViralRadarError("Candidato não encontrado.", 404, "NOT_FOUND");
  const radar = await requireRadar(userId, candidate.radarId);
  return { candidate, radar };
}

export async function applyCandidateAction(userId: string, candidateId: string, action: CandidateAction, body: Record<string, unknown>, now: Date = new Date()) {
  const { candidate, radar } = await requireCandidate(userId, candidateId);

  if (action === "approve") {
    // Aprovar = declarar a licença do vídeo de terceiros (nunca "é público, então pode").
    const scopeRaw = (body.licenseScope && typeof body.licenseScope === "object" ? body.licenseScope : {}) as Record<string, unknown>;
    const scope: LicenseScope = { edit: scopeRaw.edit === true, republish: scopeRaw.republish === true, commercial: scopeRaw.commercial === true };
    const note = typeof body.licenseNote === "string" ? body.licenseNote.trim().slice(0, 1000) : "";
    if (body.rightsConfirmed !== true) throw new ViralRadarError("Confirme que você obteve autorização do dono do vídeo.", 400, "AUTHORIZATION_REQUIRED");
    if (!isLicenseScopeComplete(scope)) throw new ViralRadarError("A autorização precisa cobrir edição, republicação e uso comercial.", 400, "AUTHORIZATION_SCOPE");
    if (note.length < 5) throw new ViralRadarError("Descreva a autorização (quem autorizou, quando, link ou documento).", 400, "AUTHORIZATION_NOTE");
    if (candidate.status === "QUEUED") throw new ViralRadarError("Este vídeo já está na fila.", 409, "INVALID_STATE");
    if (!(await approveCandidate(candidate.id, userId, scope, note, now))) throw new ViralRadarError("Não é possível aprovar este candidato agora.", 409, "INVALID_STATE");
    await insertRadarEvent(radar.id, candidate.id, "approved", note.slice(0, 200));
    const fresh = (await getCandidateForUser(candidate.id, userId))!;
    const result = await enqueueApprovedCandidate(radar, fresh, now);
    return { queued: result.queued, message: result.queued ? "Aprovado e enviado à fila." : `Aprovado. ${result.reason ?? ""}`.trim() };
  }
  if (action === "ignore") {
    if (!(await setCandidateStatus(candidate.id, userId, "IGNORED", null, ["DISCOVERED", "CLASSIFIED", "AWAITING_AUTHORIZATION", "ELIGIBLE", "REFERENCE", "FILTERED"]))) {
      throw new ViralRadarError("Não é possível ignorar este candidato agora.", 409, "INVALID_STATE");
    }
    await insertRadarEvent(radar.id, candidate.id, "ignored", null);
    return { queued: false, message: "Ignorado." };
  }
  if (action === "restore") {
    if (!(await setCandidateStatus(candidate.id, userId, "DISCOVERED", null, ["IGNORED"]))) throw new ViralRadarError("Só candidatos ignorados podem ser restaurados.", 409, "INVALID_STATE");
    await insertRadarEvent(radar.id, candidate.id, "restored", null);
    return { queued: false, message: "Restaurado; será reavaliado na próxima execução." };
  }
  if (action === "reprocess") {
    if (!candidate.queueItemId || !radar.queueId) throw new ViralRadarError("Este candidato não está na fila.", 409, "INVALID_STATE");
    const reopened = await retryErrors(userId, radar.queueId, [candidate.queueItemId]);
    await insertRadarEvent(radar.id, candidate.id, "reprocess", null);
    return { queued: reopened > 0, message: reopened > 0 ? "Reprocessamento agendado." : "Só itens com erro podem ser reprocessados." };
  }
  // "Criar conteúdo original": roteiro com IA a partir do ASSUNTO (nunca do arquivo).
  const sources = await listSources(radar.id);
  const headlines = await fetchTrustedHeadlines(sources);
  try {
    const brief = await briefWithAi(
      { userId, radarId: radar.id, candidateId: candidate.id, dailyCap: radar.aiDailyCap, now },
      { candidate, theme: findTheme(radar.category, radar.theme)?.name ?? radar.theme, style: radar.captionStyle, headlines, referenceUrl: candidate.url },
    );
    await saveCandidateBrief(candidate.id, userId, { ...brief, generatedAt: now.toISOString() });
    return { queued: false, message: "Roteiro original gerado. Revise as informações marcadas como \"a verificar\" antes de produzir." };
  } catch (error) {
    if (error instanceof RadarAiUnavailable) throw new ViralRadarError(error.message, 409, error.code);
    throw error;
  }
}

// ──────────────────────────── Painéis ────────────────────────────

function dayStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function listRadarsOverview(userId: string, now: Date = new Date()) {
  const radars = await listRadarsForUser(userId);
  const queueCounts = await countItemsByQueue(userId);
  const rows = await Promise.all(
    radars.map(async (radar) => ({
      radar,
      counters: await countRadarCandidates(radar.id, dayStartUtc(now)),
      queueCounts: radar.queueId ? (queueCounts.get(radar.queueId) ?? emptyCounts()) : emptyCounts(),
    })),
  );
  const nextRun = rows
    .filter((row) => row.radar.status === "ACTIVE" && row.radar.nextRunAt)
    .map((row) => row.radar.nextRunAt!.getTime())
    .sort((a, b) => a - b)[0];
  const nextPublication = rows
    .map((row) => row.queueCounts.nextPublicationAt?.getTime())
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)[0];
  return {
    rows,
    totals: {
      activeRadars: rows.filter((row) => row.radar.status === "ACTIVE").length,
      discoveredToday: rows.reduce((sum, row) => sum + row.counters.discoveredToday, 0),
      classified: rows.reduce((sum, row) => sum + row.counters.classified, 0),
      authorized: rows.reduce((sum, row) => sum + row.counters.authorized, 0),
      imported: rows.reduce((sum, row) => sum + row.counters.imported, 0),
      ready: rows.reduce((sum, row) => sum + row.counters.ready, 0),
      scheduled: rows.reduce((sum, row) => sum + row.counters.scheduled, 0),
      published: rows.reduce((sum, row) => sum + row.counters.published, 0),
      errors: rows.reduce((sum, row) => sum + row.counters.errors, 0),
      nextRunAt: nextRun ? new Date(nextRun) : null,
      nextPublicationAt: nextPublication ? new Date(nextPublication) : null,
    },
  };
}

export async function getRadarDashboard(userId: string, radarId: string, now: Date = new Date()) {
  const radar = await requireRadar(userId, radarId);
  const [sources, counters, executions, events, metrics, usage, youtubeUnitsToday] = await Promise.all([
    listSources(radar.id),
    countRadarCandidates(radar.id, dayStartUtc(now)),
    listExecutions(radar.id, userId, 20),
    listRadarEvents(radar.id, userId, 50),
    listLatestPostMetrics(radar.id, userId),
    sumUsageSince(radar.id, dayStartUtc(now)),
    getProviderUsage("youtube_data_api", utcDay(now)),
  ]);
  const queue = radar.queueId ? await getQueueForUser(radar.queueId, userId) : null;
  const queueCounts = queue ? ((await countItemsByQueue(userId, queue.id)).get(queue.id) ?? emptyCounts()) : emptyCounts();
  const stock = queue ? await getQueueStock(queue.id) : { ready: 0, inPipeline: 0, scheduled: 0, waitingFile: 0 };
  const account = queue ? await getInstagramAccountByIdForUser(queue.instagramAccountId, userId) : null;

  const pending: string[] = [];
  for (const type of new Set(sources.filter((source) => source.enabled).map((source) => source.type))) {
    const availability = connectorAvailability(type);
    if (!availability.available && availability.reason) pending.push(availability.reason);
  }
  if (!sources.some((source) => source.enabled && source.license !== "NONE" && source.licenseDeclaredAt)) {
    pending.push("Sem fontes autorizadas para publicação: cadastre um canal próprio ou feed licenciado, ou aprove vídeos manualmente com a autorização do dono.");
  }
  if (queue && queue.status !== "ACTIVE") pending.push(queue.status === "PAUSED" ? `Fila pausada: ${queue.pauseReason ?? "retome a fila para publicar."}` : "A publicação automática ainda não foi ativada na fila do radar.");
  if (account && account.status !== "connected") pending.push(`A conta @${account.igUsername ?? "?"} precisa ser reconectada.`);
  if (stock.waitingFile > 0) pending.push(`${stock.waitingFile} vídeo(s) autorizados aguardam o envio do arquivo (ex.: vídeos do YouTube, que não podem ser baixados pela API).`);

  return {
    radar,
    sources: sources.map((source) => ({ ...source, availability: connectorAvailability(source.type) })),
    counters,
    queue: queue
      ? {
          id: queue.id,
          name: queue.name,
          status: queue.status,
          pauseReason: queue.pauseReason,
          instagramUsername: account?.igUsername ?? null,
          facebookPages: queue.facebookPageIds.length,
          publishToInstagram: queue.publishToInstagram,
          schedule: queue.schedule,
          counts: queueCounts,
        }
      : null,
    stock,
    executions,
    events,
    performance: buildPerformanceReport(
      metrics.map((row) => ({ platform: row.platform, publishedAt: row.publishedAt, captionStyle: row.captionStyle, contentType: row.contentType, views: row.views, likes: row.likes, comments: row.comments })),
      queue?.schedule.timezone ?? "America/Sao_Paulo",
    ),
    metrics,
    usage: { ...usage, youtubeUnitsToday, youtubeDailyCap: youtubeDailyUnitCap() },
    pending,
  };
}

export async function listCandidates(userId: string, radarId: string, query: { status?: string | null; route?: string | null; page?: number }) {
  const radar = await requireRadar(userId, radarId);
  const limit = 25;
  const page = Math.max(1, Math.min(1000, Math.floor(query.page ?? 1)));
  const status = query.status && /^[A-Z_]{3,30}$/.test(query.status) ? query.status : null;
  const route = query.route && /^[ABC]$/.test(query.route) ? query.route : null;
  const result = await listCandidatesForUser(radar.id, userId, { status, route, limit, offset: (page - 1) * limit });
  return { ...result, page, pageSize: limit };
}
