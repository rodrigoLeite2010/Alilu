import "server-only";
import { parseQueueLink } from "@/lib/video-queue/links";
import { findTheme } from "@/lib/video-queue/catalog";
import { getQueueById, insertEvent as insertQueueEvent, insertItems } from "@/lib/video-queue/backend/queue-repository";
import { VideoQueueBusyError, withPlanningLock } from "@/lib/video-queue/backend/queue-planner";
import { ruleRelevance, themeTerms } from "@/lib/viral-radar/relevance";
import { computeViralScore, velocityReference, viewsVelocity, type MetricObservation } from "@/lib/viral-radar/score";
import {
  authorizationFromSource,
  decideRoute,
  failsCriteria,
  failureBackoffMinutes,
  normalizeCandidateUrl,
  orderByPriority,
  planRefill,
  queueIsStocked,
} from "@/lib/viral-radar/selection";
import type { CandidateRoute, CandidateStatus, ExecutionStatus, ExecutionTrigger } from "@/lib/viral-radar/types";
import { captionWithAi, classifyWithAi, RadarAiUnavailable } from "./ai-service";
import { connectorAvailability, refreshYoutubeStats, runConnector, youtubeSearchesPerRun, type ConnectorContext, type ConnectorResult, type DiscoveredItem } from "./connectors";
import {
  findUsedUrlsForAccount,
  finishExecution,
  getQueueStock,
  insertExecution,
  insertRadarEvent,
  insertSnapshot,
  listOpenCandidates,
  listSnapshots,
  listSources,
  listTrackedYoutubeIds,
  listUnscheduledQueueItemsWithScore,
  markCandidateQueued,
  pauseRadarBySystem,
  recordSourceFetch,
  releaseRadarLock,
  saveCandidateAi,
  saveCandidateScore,
  setQueueItemContent,
  setUnscheduledPositions,
  upsertCandidate,
  type CandidateRecord,
  type ExecutionStats,
  type RadarRecord,
  type SourceRecord,
} from "./radar-repository";
import { getDb } from "@/lib/db/client";

/**
 * Uma execução do radar (pesquisa → métricas → score → seleção → direitos →
 * fila). Chamada pelo cron (SCHEDULE/REFILL) ou por "Executar agora"
 * (MANUAL), SEMPRE com o lock do radar já adquirido. Cada fonte falha
 * isoladamente; uma falha nunca paralisa outro radar.
 */

export const RUN_LOCK_TTL_SECONDS = 10 * 60;
const MAX_TRACKED_REFRESH = 150;
const AI_CLASSIFY_PER_RUN = 5;

export interface RunRadarOptions {
  now?: () => Date;
  deadline?: number;
  fetchImpl?: ConnectorContext["fetchImpl"];
}

export interface RunRadarResult {
  radarId: string;
  executionId: string;
  status: ExecutionStatus;
  stats: ExecutionStats;
  message: string;
}

function log(event: string, data: Record<string, unknown>): void {
  console.info(JSON.stringify({ scope: "viral-radar", event, ...data }));
}

const emptyStats = (): ExecutionStats => ({
  discovered: 0,
  newCandidates: 0,
  refreshed: 0,
  scored: 0,
  queued: 0,
  awaiting: 0,
  references: 0,
  quotaUnits: 0,
  aiCalls: 0,
  errors: [],
});

/** URL usada na fila (arquivo do feed, ou o link da plataforma) — a mesma identidade dos itens da fila. */
function queueTarget(item: { mediaUrl: string | null; url: string }): { target: string; normalized: string } {
  const target = item.mediaUrl ?? item.url;
  const parsed = parseQueueLink(target);
  return { target, normalized: parsed.ok ? parsed.link.normalizedUrl : normalizeCandidateUrl(target) };
}

async function markUnavailable(radarId: string, platform: string, externalIds: string[]): Promise<void> {
  if (externalIds.length === 0) return;
  const db = getDb();
  await db`
    update viral_candidates set status = 'UNAVAILABLE', filter_reason = 'Removido, privado ou indisponível na plataforma.', updated_at = now()
    where radar_id = ${radarId} and platform = ${platform} and external_id = any(${externalIds}::text[]) and status not in ('QUEUED', 'IGNORED')
  `;
}

async function ingest(radar: RadarRecord, source: SourceRecord | null, items: DiscoveredItem[], now: Date, stats: ExecutionStats): Promise<Set<string>> {
  const seen = new Set<string>();
  const rights = source ? authorizationFromSource({ license: source.license, scope: source.licenseScope, declaredAt: source.licenseDeclaredAt }) : null;
  for (const item of items) {
    const { normalized } = queueTarget(item);
    const authorization = rights ?? { status: "NOT_AUTHORIZED" as const, type: null, note: "Conteúdo de terceiros: público não significa autorizado." };
    const { candidate, isNew } = await upsertCandidate({
      radarId: radar.id,
      userId: radar.userId,
      sourceId: source?.id ?? null,
      platform: item.platform,
      externalId: item.externalId,
      url: item.url,
      normalizedUrl: normalized,
      mediaUrl: item.mediaUrl,
      title: item.title,
      description: item.description,
      authorName: item.authorName,
      authorId: item.authorId,
      publishedAt: item.publishedAt,
      thumbnailUrl: item.thumbnailUrl,
      durationSeconds: item.durationSeconds,
      authorization: {
        status: authorization.status,
        type: authorization.type,
        scope: authorization.status === "AUTHORIZED" && source ? source.licenseScope : null,
        note: authorization.note,
        authorizedAt: authorization.status === "AUTHORIZED" && source ? source.licenseDeclaredAt : null,
      },
      now,
    });
    seen.add(`${item.platform}:${item.externalId}`);
    stats.discovered += 1;
    if (isNew) {
      stats.newCandidates += 1;
      await insertRadarEvent(radar.id, candidate.id, "discovered", `${item.platform} · ${item.title ?? item.url}`.slice(0, 300));
    }
    if (item.observation && (await insertSnapshot(candidate.id, { observedAt: now, ...item.observation }, item.provider))) stats.refreshed += 1;
  }
  return seen;
}

interface Scored {
  candidate: CandidateRecord;
  score: number | null;
  result: ReturnType<typeof computeViralScore>;
  failure: string | null;
}

function observationsFor(snapshots: Map<string, Array<{ observedAt: Date; views: number | null; likes: number | null; comments: number | null }>>, id: string): MetricObservation[] {
  return (snapshots.get(id) ?? []).map((row) => ({ observedAt: row.observedAt, views: row.views, likes: row.likes, comments: row.comments }));
}

function relevanceOf(candidate: CandidateRecord, terms: string[]): { value: number; source: "rules" | "ai" } {
  const ai = candidate.aiAnalysis && typeof candidate.aiAnalysis.relevance === "number" ? (candidate.aiAnalysis.relevance as number) : null;
  if (ai !== null) return { value: ai, source: "ai" };
  return { value: ruleRelevance(candidate, terms), source: "rules" };
}

async function scoreAll(radar: RadarRecord, candidates: CandidateRecord[], now: Date): Promise<Scored[]> {
  const snapshots = await listSnapshots(candidates.map((candidate) => candidate.id));
  const terms = themeTerms(radar.theme, radar.keywords, radar.hashtags);
  const velocities = candidates.map((candidate) => viewsVelocity(observationsFor(snapshots, candidate.id))?.perHour).filter((value): value is number => value !== undefined);
  const reference = velocityReference(velocities);
  return candidates.map((candidate) => {
    const relevance = relevanceOf(candidate, terms);
    const result = computeViralScore(
      { observations: observationsFor(snapshots, candidate.id), publishedAt: candidate.publishedAt, relevance: relevance.value, relevanceSource: relevance.source, now },
      radar.scoreWeights,
      reference,
    );
    const authorized = candidate.authorizationStatus === "AUTHORIZED";
    const failure =
      candidate.authorizationType === "MANUAL_APPROVAL"
        ? null
        : failsCriteria({ views: candidate.views, likes: candidate.likes, comments: candidate.comments, publishedAt: candidate.publishedAt, score: result.score, authorized }, radar.criteria, now);
    return { candidate: { ...candidate, score: result.score }, score: result.score, result, failure };
  });
}

const ROUTED: CandidateStatus[] = ["AWAITING_AUTHORIZATION", "ELIGIBLE", "REFERENCE"];

/** Decide o novo status/destino de cada candidato e devolve os elegíveis para a fila (melhores primeiro). */
async function routeCandidates(radar: RadarRecord, scored: Scored[], stats: ExecutionStats): Promise<Scored[]> {
  // Melhores primeiro: as novas seleções da execução vão para os maiores scores.
  const ordered = [...scored].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  let newSelections = 0;
  const eligible: Scored[] = [];
  for (const item of ordered) {
    const { candidate } = item;
    let status: CandidateStatus;
    let route: CandidateRoute | null;
    if (candidate.authorizationType === "MANUAL_APPROVAL" && candidate.authorizationStatus === "AUTHORIZED") {
      status = "ELIGIBLE";
      route = "A";
    } else if (candidate.status === "REFERENCE" && candidate.brief) {
      // Já virou referência para conteúdo original: mantém.
      status = "REFERENCE";
      route = "B";
    } else if (item.failure) {
      status = "FILTERED";
      route = null;
    } else if (ROUTED.includes(candidate.status)) {
      const decision = decideRoute(candidate.authorizationStatus, radar);
      status = decision.status;
      route = decision.route;
    } else if (newSelections < radar.criteria.maxSelectedPerRun) {
      const decision = decideRoute(candidate.authorizationStatus, radar);
      status = decision.status;
      route = decision.route;
      newSelections += 1;
      if (status === "AWAITING_AUTHORIZATION") stats.awaiting += 1;
      if (status === "REFERENCE") stats.references += 1;
      await insertRadarEvent(radar.id, candidate.id, "routed", `Destino ${route}: ${status}`);
    } else {
      status = "CLASSIFIED";
      route = null;
    }
    await saveCandidateScore(candidate.id, item.result, { status, route, filterReason: item.failure });
    stats.scored += 1;
    if (status === "ELIGIBLE") eligible.push({ ...item, candidate: { ...candidate, status, route } });
  }
  return eligible.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

async function aiClassify(radar: RadarRecord, scored: Scored[], now: Date, stats: ExecutionStats, deadline: number): Promise<boolean> {
  if (!radar.aiClassification) return false;
  const targets = scored
    .filter((item) => !item.candidate.aiAnalysis && item.failure === null)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, AI_CLASSIFY_PER_RUN);
  let changed = false;
  const themeName = findTheme(radar.category, radar.theme)?.name ?? radar.theme;
  for (const item of targets) {
    if (Date.now() > deadline - 30_000) break;
    try {
      const analysis = await classifyWithAi(
        { userId: radar.userId, radarId: radar.id, candidateId: item.candidate.id, dailyCap: radar.aiDailyCap, now },
        item.candidate,
        themeName,
      );
      stats.aiCalls += 1;
      await saveCandidateAi(item.candidate.id, { ...analysis, analyzedBy: "ai", basis: "metadados (título/descrição/canal)" });
      changed = true;
    } catch (error) {
      if (error instanceof RadarAiUnavailable) {
        stats.errors.push({ source: "ai", code: error.code, message: error.message });
        break;
      }
      stats.errors.push({ source: "ai", code: "AI_FAILED", message: "Falha na classificação por IA (seguindo com regras)." });
      break;
    }
  }
  return changed;
}

async function buildCaption(radar: RadarRecord, candidate: CandidateRecord, now: Date, stats: ExecutionStats) {
  const meta: Record<string, unknown> = {
    mode: radar.captionMode,
    style: radar.captionStyle,
    basedOn: { platform: candidate.platform, url: candidate.url, title: candidate.title, author: candidate.authorName },
    generatedAt: now.toISOString(),
  };
  if (radar.captionMode !== "AI") return { caption: null, facebookCaption: null, meta: { ...meta, used: "template" } };
  try {
    const generated = await captionWithAi(
      { userId: radar.userId, radarId: radar.id, candidateId: candidate.id, dailyCap: radar.aiDailyCap, now },
      {
        candidate,
        theme: findTheme(radar.category, radar.theme)?.name ?? radar.theme,
        style: radar.captionStyle,
        hashtags: radar.hashtags,
        ownContent: candidate.authorizationStatus === "AUTHORIZED",
      },
    );
    stats.aiCalls += 1;
    return { caption: generated.instagramCaption, facebookCaption: generated.facebookCaption, meta: { ...meta, used: "ai", headline: generated.headline, title: generated.title } };
  } catch (error) {
    const reason = error instanceof RadarAiUnavailable ? error.message : "Falha da IA";
    stats.errors.push({ source: "ai", code: error instanceof RadarAiUnavailable ? error.code : "AI_FAILED", message: `${reason} — usando o modelo de legenda da fila.` });
    return { caption: null, facebookCaption: null, meta: { ...meta, used: "template", fallbackReason: reason } };
  }
}

/** Envia os elegíveis (A) para a Fila de vídeos existente, até completar o tamanho ideal. */
async function enqueueEligible(radar: RadarRecord, eligible: Scored[], slots: number, now: Date, stats: ExecutionStats): Promise<number> {
  if (eligible.length === 0 || slots <= 0 || !radar.queueId) return 0;
  const queue = await getQueueById(radar.queueId);
  if (!queue || queue.status === "ARCHIVED") return 0;

  const targets = eligible.map((item) => ({ item, ...queueTarget(item.candidate) }));
  const used = await findUsedUrlsForAccount(radar.userId, queue.instagramAccountId, targets.map((target) => target.normalized));
  const chosen: typeof targets = [];
  for (const target of targets) {
    if (chosen.length >= slots) break;
    const { candidate } = target.item;
    if (used.has(target.normalized)) {
      await saveCandidateScore(candidate.id, target.item.result, { status: "FILTERED", route: null, filterReason: "Já usado nesta conta do Instagram (não republica automaticamente)." });
      continue;
    }
    if (candidate.platform === "RSS" && !candidate.mediaUrl) {
      await saveCandidateScore(candidate.id, target.item.result, {
        status: "AWAITING_AUTHORIZATION",
        route: "C",
        filterReason: "A fonte autorizada não informa o arquivo do vídeo no feed: envie o arquivo ou ajuste o feed.",
      });
      continue;
    }
    const parsed = parseQueueLink(target.target);
    if (!parsed.ok) {
      await saveCandidateScore(candidate.id, target.item.result, { status: "FILTERED", route: null, filterReason: `Link inválido para a fila: ${parsed.reason}` });
      continue;
    }
    chosen.push(target);
  }
  if (chosen.length === 0) return 0;

  let queued = 0;
  try {
    await withPlanningLock(
      queue.id,
      async () => {
        const links = chosen.map((target) => {
          const parsed = parseQueueLink(target.target);
          return (parsed as { ok: true; link: Parameters<typeof insertItems>[2][number] }).link;
        });
        // Autorização registrada na fonte/aprovação manual (nunca "público = autorizado").
        const authorizedAt = now;
        const { inserted } = await insertItems(queue.id, radar.userId, links, authorizedAt);
        const byUrl = new Map(inserted.map((item) => [item.normalizedUrl, item]));
        for (const target of chosen) {
          const item = byUrl.get(target.normalized);
          const { candidate } = target.item;
          if (!item) {
            await saveCandidateScore(candidate.id, target.item.result, { status: "FILTERED", route: null, filterReason: "Já está na fila do radar." });
            continue;
          }
          const caption = await buildCaption(radar, candidate, now, stats);
          await setQueueItemContent(item.id, {
            title: (candidate.title ?? "").slice(0, 200) || null,
            caption: caption.caption,
            facebookCaption: caption.facebookCaption,
          });
          if (await markCandidateQueued(candidate.id, item.id, caption.meta)) {
            queued += 1;
            await insertRadarEvent(radar.id, candidate.id, "queued", `Enviado à fila (${candidate.authorizationType ?? "autorizado"}).`);
            await insertQueueEvent(queue.id, item.id, "radar_added", `Radar Viral: ${(candidate.title ?? candidate.url).slice(0, 150)}`);
          }
        }
        if (radar.priorityMode === "SCORE") {
          const items = await listUnscheduledQueueItemsWithScore(queue.id);
          const order = orderByPriority(
            items.map((item) => ({ id: item.id, score: item.score, enqueuedAt: item.createdAt, position: item.position })),
            "SCORE",
            now,
          );
          await setUnscheduledPositions(queue.id, order);
        }
      },
      { wait: true },
    );
  } catch (error) {
    if (error instanceof VideoQueueBusyError) {
      stats.errors.push({ source: "queue", code: "QUEUE_BUSY", message: "A fila estava ocupada; os elegíveis entram na próxima execução." });
      return queued;
    }
    throw error;
  }
  return queued;
}

function summarize(stats: ExecutionStats, hasAuthorizedSource: boolean, skippedReason: string | null): string {
  if (skippedReason) return skippedReason;
  const parts = [
    `${stats.discovered} encontrados (${stats.newCandidates} novos)`,
    `${stats.scored} classificados`,
    `${stats.queued} enviados à fila`,
    stats.awaiting ? `${stats.awaiting} aguardando autorização` : "",
    stats.references ? `${stats.references} referências` : "",
    stats.errors.length ? `${stats.errors.length} aviso(s)` : "",
  ].filter(Boolean);
  const warning = hasAuthorizedSource ? "" : " Sem fontes autorizadas para publicação: só referências e aprovações manuais alimentam a fila.";
  return `${parts.join(" · ")}.${warning}`;
}

export async function runRadar(radar: RadarRecord, trigger: ExecutionTrigger, lockToken: string, options: RunRadarOptions = {}): Promise<RunRadarResult> {
  const nowFn = options.now ?? (() => new Date());
  const now = nowFn();
  const deadline = options.deadline ?? Date.now() + 120_000;
  const stats = emptyStats();
  const executionId = await insertExecution(radar.id, radar.userId, trigger);
  let status: ExecutionStatus = "SUCCEEDED";
  let message = "";
  let refillAttempted = false;
  let skippedReason: string | null = null;
  let hasAuthorizedSource = false;

  try {
    const queue = radar.queueId ? await getQueueById(radar.queueId) : null;
    if (!queue || queue.status === "ARCHIVED") {
      await pauseRadarBySystem(radar.id, "A fila de vídeos ligada a este radar não existe mais. Ligue o radar a uma fila nova.");
      status = "FAILED";
      message = "Fila ligada ausente ou arquivada: radar pausado.";
      await finishExecution(executionId, status, stats, message);
      await releaseRadarLock(radar.id, lockToken, now, { nextRunAt: null, success: false, backoffUntil: null, statusMessage: message, refillAttempted: false, refillEmpty: false, advanceSchedule: false });
      return { radarId: radar.id, executionId, status, stats, message };
    }

    const stock = await getQueueStock(queue.id);
    const refill = planRefill(stock, radar.queueMin, radar.queueTarget);
    refillAttempted = trigger === "REFILL" || refill.needsRefill;
    const sources = (await listSources(radar.id)).filter((source) => source.enabled);
    hasAuthorizedSource = sources.some((source) => source.license !== "NONE" && source.licenseDeclaredAt);

    if (trigger === "SCHEDULE" && queueIsStocked(stock, radar.queueTarget)) {
      // Controle de custo: fila abastecida → não pesquisa (só reavalia o que já existe, sem chamar APIs).
      skippedReason = `Fila abastecida (${stock.ready} prontos, ${stock.inPipeline} em processamento, ${stock.scheduled} agendados): pesquisa adiada.`;
      status = "SKIPPED";
    } else if (sources.length === 0) {
      skippedReason = "Nenhuma fonte ativa: adicione uma fonte de pesquisa ao radar.";
      status = "SKIPPED";
    } else {
      const budget = { youtubeSearches: youtubeSearchesPerRun() };
      const seen = new Set<string>();
      let okSources = 0;
      let attempted = 0;
      for (const source of sources) {
        if (Date.now() > deadline - 20_000) {
          stats.errors.push({ source: source.type, code: "TIME_BUDGET", message: "Tempo da execução esgotado; fonte fica para a próxima." });
          break;
        }
        const availability = connectorAvailability(source.type);
        if (!availability.available) {
          stats.errors.push({ source: source.type, code: "DISABLED", message: availability.reason ?? "Conector desativado." });
          await recordSourceFetch(source.id, availability.reason);
          continue;
        }
        attempted += 1;
        let result: ConnectorResult;
        try {
          result = await runConnector({ radar, source, now, budget, fetchImpl: options.fetchImpl }, queue.instagramAccountId);
        } catch {
          result = { status: "ERROR", items: [], quotaUnits: 0, error: { code: "UNEXPECTED", message: "Falha inesperada na fonte." } };
        }
        stats.quotaUnits += result.quotaUnits;
        await recordSourceFetch(source.id, result.error ? result.error.message : null);
        if (result.error) stats.errors.push({ source: source.type, code: result.error.code, message: result.error.message });
        if (result.status === "OK") okSources += 1;
        (await ingest(radar, source, result.items, now, stats)).forEach((key) => seen.add(key));
        if (result.unavailableIds?.length) await markUnavailable(radar.id, "YOUTUBE", result.unavailableIds);
      }

      // Nova observação dos vídeos do YouTube já acompanhados (base do crescimento real).
      const tracked = (await listTrackedYoutubeIds(radar.id, radar.criteria.maxAgeHours, MAX_TRACKED_REFRESH)).filter((row) => !seen.has(`YOUTUBE:${row.externalId}`));
      if (tracked.length > 0 && Date.now() < deadline - 15_000) {
        const refreshed = await refreshYoutubeStats(tracked.map((row) => row.externalId), now, options.fetchImpl);
        stats.quotaUnits += refreshed.quotaUnits;
        if (refreshed.error && refreshed.status !== "DISABLED") stats.errors.push({ source: "YOUTUBE_REFRESH", code: refreshed.error.code, message: refreshed.error.message });
        // Só grava a observação (não mexe em metadados nem na autorização do candidato).
        const byExternal = new Map(tracked.map((row) => [row.externalId, row.id]));
        for (const item of refreshed.items) {
          const candidateId = byExternal.get(item.externalId);
          if (candidateId && item.observation && (await insertSnapshot(candidateId, { observedAt: now, ...item.observation }, item.provider))) stats.refreshed += 1;
        }
        if (refreshed.unavailableIds?.length) await markUnavailable(radar.id, "YOUTUBE", refreshed.unavailableIds);
      }

      if (attempted > 0 && okSources === 0) status = "FAILED";
      else if (stats.errors.some((error) => error.code !== "DISABLED")) status = "PARTIAL";
    }

    // Pontuação, IA opcional, seleção e encaminhamento (também roda quando a pesquisa foi adiada — só banco).
    let open = await listOpenCandidates(radar.id);
    let scored = await scoreAll(radar, open, now);
    if (await aiClassify(radar, scored, now, stats, deadline)) {
      open = await listOpenCandidates(radar.id);
      scored = await scoreAll(radar, open, now);
    }
    const eligible = await routeCandidates(radar, scored, stats);
    const freshStock = await getQueueStock(queue.id);
    const slots = planRefill(freshStock, radar.queueMin, radar.queueTarget).slots;
    stats.queued = await enqueueEligible(radar, eligible, slots, now, stats);

    message = summarize(stats, hasAuthorizedSource, skippedReason);
    if (skippedReason && stats.queued > 0) message = `${skippedReason} ${stats.queued} elegível(is) enviado(s) à fila.`;
  } catch (error) {
    status = "FAILED";
    message = "Falha inesperada na execução do radar. Nova tentativa automática com espera.";
    stats.errors.push({ source: "runner", code: "UNEXPECTED", message: ((error as Error)?.message ?? "erro").slice(0, 200) });
    log("run.crash", { radarId: radar.id, message: (error as Error)?.message?.slice(0, 200) });
  }

  const failures = status === "FAILED" ? radar.consecutiveFailures + 1 : 0;
  const backoffUntil = status === "FAILED" ? new Date(now.getTime() + failureBackoffMinutes(failures) * 60_000) : null;
  await finishExecution(executionId, status, stats, message);
  await releaseRadarLock(radar.id, lockToken, nowFn(), {
    nextRunAt: new Date(now.getTime() + radar.frequencyMinutes * 60_000),
    success: status !== "FAILED",
    backoffUntil,
    statusMessage: message,
    refillAttempted,
    refillEmpty: stats.queued === 0,
    advanceSchedule: trigger !== "REFILL",
  });
  log("run.done", { radarId: radar.id, executionId, trigger, status, discovered: stats.discovered, queued: stats.queued, quotaUnits: stats.quotaUnits, aiCalls: stats.aiCalls });
  return { radarId: radar.id, executionId, status, stats, message };
}


/**
 * Aprovação manual (modo supervisionado): o usuário declarou a licença do
 * vídeo → entra na fila na hora (fora do limite de reabastecimento, porque
 * foi uma decisão explícita). Devolve o motivo quando não entrou.
 */
export async function enqueueApprovedCandidate(radar: RadarRecord, candidate: CandidateRecord, now: Date): Promise<{ queued: boolean; reason: string | null }> {
  const stats = emptyStats();
  const [scored] = await scoreAll(radar, [candidate], now);
  const queued = await enqueueEligible(radar, [{ ...scored, failure: null, candidate: { ...scored.candidate, status: "ELIGIBLE", route: "A" } }], 1, now, stats);
  if (queued > 0) return { queued: true, reason: null };
  const db = getDb();
  const rows = await db`select filter_reason from viral_candidates where id = ${candidate.id}`;
  return { queued: false, reason: (rows[0]?.filter_reason as string | null) ?? stats.errors[0]?.message ?? "Não foi possível enviar à fila agora." };
}
