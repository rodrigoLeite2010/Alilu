import "server-only";
import { pipelineStage } from "@/lib/viral-radar/stage";
import { PIPELINE_STAGE_LABEL } from "@/lib/viral-radar/types";
import type { CandidateWithPipeline, RadarRecord } from "./radar-repository";
import type { getRadarDashboard, listRadarsOverview } from "./radar-service";

/** O que as telas recebem (sem tokens, sem dados internos de lock). */

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

export function serializeRadar(radar: RadarRecord) {
  return {
    id: radar.id,
    name: radar.name,
    category: radar.category,
    theme: radar.theme,
    keywords: radar.keywords,
    hashtags: radar.hashtags,
    language: radar.language,
    region: radar.region,
    status: radar.status,
    pauseReason: radar.pauseReason,
    frequencyMinutes: radar.frequencyMinutes,
    criteria: radar.criteria,
    scoreWeights: radar.scoreWeights,
    autoMode: radar.autoMode,
    supervisedMode: radar.supervisedMode,
    queueId: radar.queueId,
    queueMin: radar.queueMin,
    queueTarget: radar.queueTarget,
    priorityMode: radar.priorityMode,
    captionMode: radar.captionMode,
    captionStyle: radar.captionStyle,
    aiClassification: radar.aiClassification,
    aiDailyCap: radar.aiDailyCap,
    nextRunAt: iso(radar.nextRunAt),
    lastRunAt: iso(radar.lastRunAt),
    lastSuccessAt: iso(radar.lastSuccessAt),
    lastStatusMessage: radar.lastStatusMessage,
    consecutiveFailures: radar.consecutiveFailures,
    backoffUntil: iso(radar.backoffUntil),
  };
}

export function serializeCandidate(row: CandidateWithPipeline) {
  const stage = pipelineStage({ status: row.status, itemStatus: row.itemStatus, postStatus: row.postStatus, queueStatus: row.queueStatus });
  return {
    id: row.id,
    platform: row.platform,
    externalId: row.externalId,
    url: row.url,
    hasMediaFile: Boolean(row.mediaUrl),
    title: row.title,
    authorName: row.authorName,
    publishedAt: iso(row.publishedAt),
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    metricsObservedAt: iso(row.metricsObservedAt),
    score: row.score,
    scoreVersion: row.scoreVersion,
    scoreReason: row.scoreReason,
    scoreComponents: row.scoreComponents,
    authorizationStatus: row.authorizationStatus,
    authorizationType: row.authorizationType,
    authorizationNote: row.authorizationNote,
    status: row.status,
    route: row.route,
    filterReason: row.filterReason,
    stage,
    stageLabel: PIPELINE_STAGE_LABEL[stage],
    queueItemId: row.queueItemId,
    itemMessage: row.itemMessage,
    scheduledAtUtc: iso(row.scheduledAtUtc),
    aiAnalysis: row.aiAnalysis,
    brief: row.brief,
    firstSeenAt: iso(row.firstSeenAt),
  };
}

export function serializeDashboard(dashboard: Awaited<ReturnType<typeof getRadarDashboard>>) {
  return {
    radar: serializeRadar(dashboard.radar),
    sources: dashboard.sources.map((source) => ({
      id: source.id,
      type: source.type,
      label: source.label,
      enabled: source.enabled,
      config: source.config,
      license: source.license,
      licenseScope: source.licenseScope,
      licenseNote: source.licenseNote,
      licenseEvidenceUrl: source.licenseEvidenceUrl,
      licenseDeclaredAt: iso(source.licenseDeclaredAt),
      trustedForFacts: source.trustedForFacts,
      lastFetchedAt: iso(source.lastFetchedAt),
      lastError: source.lastError,
      availability: source.availability,
    })),
    counters: dashboard.counters,
    queue: dashboard.queue
      ? { ...dashboard.queue, counts: { ...dashboard.queue.counts, nextPublicationAt: iso(dashboard.queue.counts.nextPublicationAt) } }
      : null,
    stock: dashboard.stock,
    executions: dashboard.executions.map((execution) => ({ ...execution, startedAt: iso(execution.startedAt), finishedAt: iso(execution.finishedAt) })),
    events: dashboard.events.map((event) => ({ ...event, createdAt: iso(event.createdAt) })),
    performance: dashboard.performance,
    usage: dashboard.usage,
    pending: dashboard.pending,
  };
}

export function serializeOverview(overview: Awaited<ReturnType<typeof listRadarsOverview>>) {
  return {
    totals: { ...overview.totals, nextRunAt: iso(overview.totals.nextRunAt), nextPublicationAt: iso(overview.totals.nextPublicationAt) },
    radars: overview.rows.map((row) => ({
      ...serializeRadar(row.radar),
      counters: row.counters,
      nextPublicationAt: iso(row.queueCounts.nextPublicationAt),
    })),
  };
}

export type RadarDto = ReturnType<typeof serializeRadar>;
export type CandidateDto = ReturnType<typeof serializeCandidate>;
export type RadarDashboardDto = ReturnType<typeof serializeDashboard>;
export type RadarOverviewDto = ReturnType<typeof serializeOverview>;
