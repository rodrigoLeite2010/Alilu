import "server-only";
import { getDb } from "@/lib/db/client";
import type { RadarSettings, SourceInput } from "@/lib/viral-radar/config";
import type { ScoreResult } from "@/lib/viral-radar/score";
import { normalizeCriteria } from "@/lib/viral-radar/config";
import { normalizeWeights } from "@/lib/viral-radar/score";
import type {
  AuthorizationStatus,
  AuthorizationType,
  CandidatePlatform,
  CandidateRoute,
  CandidateStatus,
  CaptionMode,
  CaptionStyle,
  ExecutionStatus,
  ExecutionTrigger,
  LicenseScope,
  PriorityMode,
  RadarSourceType,
  RadarStatus,
  SourceLicense,
} from "@/lib/viral-radar/types";

/**
 * Acesso ao banco do Radar Viral. Toda leitura feita a partir de uma ação
 * do usuário é filtrada por `user_id`; as funções sem `userId` são usadas
 * só pelo cron (servidor).
 */

type Row = Record<string, unknown>;
const toDate = (value: unknown): Date | null => (value === null || value === undefined ? null : new Date(value as string));
const toNum = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const json = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

// ───────────────────────────── Radares ─────────────────────────────

export interface RadarRecord extends RadarSettings {
  id: string;
  userId: string;
  status: RadarStatus;
  pauseReason: string | null;
  queueId: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatusMessage: string | null;
  consecutiveFailures: number;
  backoffUntil: Date | null;
  lastRefillAttemptAt: Date | null;
  emptyRefillStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

function safeWeights(value: unknown) {
  try {
    return normalizeWeights(json<Record<string, unknown> | null>(value, null));
  } catch {
    return normalizeWeights(null);
  }
}

function mapRadar(row: Row): RadarRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    category: row.category as string,
    theme: row.theme as string,
    keywords: (row.keywords as string[] | null) ?? [],
    hashtags: (row.hashtags as string[] | null) ?? [],
    language: row.language as string,
    region: row.region as string,
    status: row.status as RadarStatus,
    pauseReason: (row.pause_reason as string | null) ?? null,
    frequencyMinutes: Number(row.frequency_minutes),
    criteria: normalizeCriteria(json(row.criteria, {})),
    scoreWeights: safeWeights(row.score_weights),
    autoMode: Boolean(row.auto_mode),
    supervisedMode: Boolean(row.supervised_mode),
    queueId: (row.queue_id as string | null) ?? null,
    queueMin: Number(row.queue_min),
    queueTarget: Number(row.queue_target),
    priorityMode: row.priority_mode as PriorityMode,
    captionMode: row.caption_mode as CaptionMode,
    captionStyle: row.caption_style as CaptionStyle,
    aiClassification: Boolean(row.ai_classification),
    aiDailyCap: Number(row.ai_daily_cap),
    nextRunAt: toDate(row.next_run_at),
    lastRunAt: toDate(row.last_run_at),
    lastSuccessAt: toDate(row.last_success_at),
    lastStatusMessage: (row.last_status_message as string | null) ?? null,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    backoffUntil: toDate(row.backoff_until),
    lastRefillAttemptAt: toDate(row.last_refill_attempt_at),
    emptyRefillStreak: Number(row.empty_refill_streak ?? 0),
    createdAt: toDate(row.created_at)!,
    updatedAt: toDate(row.updated_at)!,
  };
}

export async function countRadarsForUser(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db`select count(*)::int as n from viral_radars where user_id = ${userId} and status <> 'ARCHIVED'`;
  return Number(rows[0]?.n ?? 0);
}

export async function insertRadar(userId: string, settings: RadarSettings, queueId: string, nextRunAt: Date): Promise<string> {
  const db = getDb();
  const rows = await db`
    insert into viral_radars (
      user_id, name, category, theme, keywords, hashtags, language, region, frequency_minutes, criteria, score_weights,
      auto_mode, supervised_mode, queue_id, queue_min, queue_target, priority_mode, caption_mode, caption_style,
      ai_classification, ai_daily_cap, next_run_at
    ) values (
      ${userId}, ${settings.name}, ${settings.category}, ${settings.theme}, ${settings.keywords}::text[], ${settings.hashtags}::text[],
      ${settings.language}, ${settings.region}, ${settings.frequencyMinutes}, ${JSON.stringify(settings.criteria)}::jsonb,
      ${JSON.stringify(settings.scoreWeights)}::jsonb, ${settings.autoMode}, ${settings.supervisedMode}, ${queueId},
      ${settings.queueMin}, ${settings.queueTarget}, ${settings.priorityMode}, ${settings.captionMode}, ${settings.captionStyle},
      ${settings.aiClassification}, ${settings.aiDailyCap}, ${nextRunAt.toISOString()}
    ) returning id
  `;
  return rows[0].id as string;
}

export async function updateRadarSettings(id: string, userId: string, settings: RadarSettings): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_radars set
      name = ${settings.name}, category = ${settings.category}, theme = ${settings.theme},
      keywords = ${settings.keywords}::text[], hashtags = ${settings.hashtags}::text[], language = ${settings.language}, region = ${settings.region},
      next_run_at = case when frequency_minutes <> ${settings.frequencyMinutes} and last_run_at is not null
        then last_run_at + (${settings.frequencyMinutes} * interval '1 minute') else next_run_at end,
      frequency_minutes = ${settings.frequencyMinutes}, criteria = ${JSON.stringify(settings.criteria)}::jsonb,
      score_weights = ${JSON.stringify(settings.scoreWeights)}::jsonb, auto_mode = ${settings.autoMode}, supervised_mode = ${settings.supervisedMode},
      queue_min = ${settings.queueMin}, queue_target = ${settings.queueTarget}, priority_mode = ${settings.priorityMode},
      caption_mode = ${settings.captionMode}, caption_style = ${settings.captionStyle}, ai_classification = ${settings.aiClassification},
      ai_daily_cap = ${settings.aiDailyCap}, updated_at = now()
    where id = ${id} and user_id = ${userId} and status <> 'ARCHIVED'
    returning id
  `;
  return rows.length > 0;
}

export async function getRadarForUser(id: string, userId: string): Promise<RadarRecord | null> {
  const db = getDb();
  const rows = await db`select * from viral_radars where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapRadar(rows[0]) : null;
}

export async function getRadarById(id: string): Promise<RadarRecord | null> {
  const db = getDb();
  const rows = await db`select * from viral_radars where id = ${id}`;
  return rows[0] ? mapRadar(rows[0]) : null;
}

export async function listRadarsForUser(userId: string): Promise<RadarRecord[]> {
  const db = getDb();
  const rows = await db`select * from viral_radars where user_id = ${userId} and status <> 'ARCHIVED' order by created_at desc`;
  return rows.map(mapRadar);
}

export async function setRadarStatus(id: string, userId: string, status: RadarStatus, reason: string | null, from: RadarStatus[]): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_radars set status = ${status}, pause_reason = ${reason},
      next_run_at = case when ${status} = 'ACTIVE' then least(coalesce(next_run_at, now()), now()) else next_run_at end,
      backoff_until = case when ${status} = 'ACTIVE' then null else backoff_until end,
      updated_at = now()
    where id = ${id} and user_id = ${userId} and status = any(${from}::text[])
    returning id
  `;
  return rows.length > 0;
}

/** Pausa automática (ex.: fila ligada arquivada). */
export async function pauseRadarBySystem(id: string, reason: string): Promise<void> {
  const db = getDb();
  await db`update viral_radars set status = 'PAUSED', pause_reason = ${reason}, updated_at = now() where id = ${id} and status = 'ACTIVE'`;
}

/**
 * CLAIM ATÔMICO dos radares a executar (FOR UPDATE SKIP LOCKED): ativos,
 * sem lock válido, fora do backoff, e
 *   - com a próxima execução vencida (SCHEDULE), ou
 *   - com a fila abaixo do mínimo e fora da espera de reabastecimento (REFILL).
 * Dois crons simultâneos nunca pegam o mesmo radar.
 */
export async function claimDueRadars(now: Date, limit: number, lockToken: string, ttlSeconds: number): Promise<Array<{ radar: RadarRecord; trigger: ExecutionTrigger }>> {
  const db = getDb();
  const rows = await db`
    with stock as (
      select r.id,
        (select count(*) from video_queue_items i
          where i.queue_id = r.queue_id and i.status in ('READY', 'PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING')) as available
      from viral_radars r
      where r.status = 'ACTIVE'
    ),
    due as (
      select r.id,
        case when r.next_run_at is null or r.next_run_at <= ${now.toISOString()}::timestamptz then 'SCHEDULE' else 'REFILL' end as run_trigger
      from viral_radars r
      join stock s on s.id = r.id
      where r.status = 'ACTIVE'
        and r.queue_id is not null
        and (r.run_lock_expires_at is null or r.run_lock_expires_at < ${now.toISOString()}::timestamptz)
        and (r.backoff_until is null or r.backoff_until <= ${now.toISOString()}::timestamptz)
        and (
          r.next_run_at is null or r.next_run_at <= ${now.toISOString()}::timestamptz
          or (
            s.available < r.queue_min
            and (r.last_refill_attempt_at is null or r.last_refill_attempt_at <=
              ${now.toISOString()}::timestamptz - (least(r.frequency_minutes, 30 * power(2, least(r.empty_refill_streak, 10))::int) * interval '1 minute'))
          )
        )
      order by r.next_run_at asc nulls first
      limit ${limit}
      for update of r skip locked
    )
    update viral_radars r set run_lock_token = ${lockToken},
      run_lock_expires_at = ${now.toISOString()}::timestamptz + (${ttlSeconds} * interval '1 second')
    from due
    where r.id = due.id
    returning r.*, due.run_trigger
  `;
  return rows.map((row) => ({ radar: mapRadar(row), trigger: row.run_trigger as ExecutionTrigger }));
}

/** Execução manual ("Executar agora"): mesmo lock do cron (nunca duas execuções do mesmo radar). */
export async function claimRadarForManualRun(id: string, userId: string, now: Date, lockToken: string, ttlSeconds: number): Promise<RadarRecord | null> {
  const db = getDb();
  const rows = await db`
    update viral_radars set run_lock_token = ${lockToken},
      run_lock_expires_at = ${now.toISOString()}::timestamptz + (${ttlSeconds} * interval '1 second')
    where id = ${id} and user_id = ${userId} and status <> 'ARCHIVED' and queue_id is not null
      and (run_lock_expires_at is null or run_lock_expires_at < ${now.toISOString()}::timestamptz)
    returning *
  `;
  return rows[0] ? mapRadar(rows[0]) : null;
}

export interface FinishRunPatch {
  nextRunAt: Date | null;
  success: boolean;
  backoffUntil: Date | null;
  statusMessage: string;
  refillAttempted: boolean;
  /** Reabastecimento que não encontrou nada aproveitável. */
  refillEmpty: boolean;
  /** Execução agendada (SCHEDULE/MANUAL) avança next_run_at; REFILL não mexe. */
  advanceSchedule: boolean;
}

export async function releaseRadarLock(id: string, lockToken: string, now: Date, patch: FinishRunPatch): Promise<void> {
  const db = getDb();
  await db`
    update viral_radars set
      run_lock_token = null, run_lock_expires_at = null,
      last_run_at = ${now.toISOString()},
      last_success_at = case when ${patch.success} then ${now.toISOString()}::timestamptz else last_success_at end,
      consecutive_failures = case when ${patch.success} then 0 else consecutive_failures + 1 end,
      backoff_until = ${patch.backoffUntil ? patch.backoffUntil.toISOString() : null},
      next_run_at = case when ${patch.advanceSchedule} then ${patch.nextRunAt ? patch.nextRunAt.toISOString() : null}::timestamptz else next_run_at end,
      last_status_message = ${patch.statusMessage.slice(0, 500)},
      last_refill_attempt_at = case when ${patch.refillAttempted} then ${now.toISOString()}::timestamptz else last_refill_attempt_at end,
      empty_refill_streak = case when not ${patch.refillAttempted} then empty_refill_streak when ${patch.refillEmpty} then empty_refill_streak + 1 else 0 end,
      updated_at = now()
    where id = ${id} and run_lock_token = ${lockToken}
  `;
}

export async function archiveRadar(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_radars set status = 'ARCHIVED', run_lock_token = null, run_lock_expires_at = null, updated_at = now()
    where id = ${id} and user_id = ${userId} and status <> 'ARCHIVED' returning id
  `;
  return rows.length > 0;
}

export async function findRadarByQueue(queueId: string): Promise<{ id: string } | null> {
  const db = getDb();
  const rows = await db`select id from viral_radars where queue_id = ${queueId} and status <> 'ARCHIVED' limit 1`;
  return rows[0] ? { id: rows[0].id as string } : null;
}

// ───────────────────────────── Fontes ─────────────────────────────

export interface SourceRecord extends SourceInput {
  id: string;
  radarId: string;
  userId: string;
  licenseDeclaredAt: Date | null;
  lastFetchedAt: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
  createdAt: Date;
}

function mapSource(row: Row): SourceRecord {
  return {
    id: row.id as string,
    radarId: row.radar_id as string,
    userId: row.user_id as string,
    type: row.type as RadarSourceType,
    label: (row.label as string) ?? "",
    enabled: Boolean(row.enabled),
    config: json(row.config, {}),
    license: row.license as SourceLicense,
    licenseScope: json<LicenseScope>(row.license_scope, { edit: false, republish: false, commercial: false }),
    licenseNote: (row.license_note as string | null) ?? null,
    licenseEvidenceUrl: (row.license_evidence_url as string | null) ?? null,
    licenseDeclaredAt: toDate(row.license_declared_at),
    trustedForFacts: Boolean(row.trusted_for_facts),
    lastFetchedAt: toDate(row.last_fetched_at),
    lastError: (row.last_error as string | null) ?? null,
    consecutiveErrors: Number(row.consecutive_errors ?? 0),
    createdAt: toDate(row.created_at)!,
  };
}

export async function insertSource(radarId: string, userId: string, source: SourceInput, now: Date): Promise<string> {
  const db = getDb();
  const declaredAt = source.license === "NONE" ? null : now.toISOString();
  const rows = await db`
    insert into viral_radar_sources (
      radar_id, user_id, type, label, enabled, config, license, license_scope, license_note, license_evidence_url,
      license_declared_at, trusted_for_facts
    )
    select r.id, r.user_id, ${source.type}, ${source.label}, ${source.enabled}, ${JSON.stringify(source.config)}::jsonb, ${source.license},
      ${JSON.stringify(source.licenseScope)}::jsonb, ${source.licenseNote}, ${source.licenseEvidenceUrl}, ${declaredAt}::timestamptz, ${source.trustedForFacts}
    from viral_radars r where r.id = ${radarId} and r.user_id = ${userId}
    returning id
  `;
  if (!rows[0]) throw new Error("radar not found");
  return rows[0].id as string;
}

export async function updateSource(id: string, userId: string, source: SourceInput, now: Date): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_radar_sources set
      type = ${source.type}, label = ${source.label}, enabled = ${source.enabled}, config = ${JSON.stringify(source.config)}::jsonb,
      license_declared_at = case
        when ${source.license} = 'NONE' then null
        when license = ${source.license} and license_scope = ${JSON.stringify(source.licenseScope)}::jsonb and license_declared_at is not null then license_declared_at
        else ${now.toISOString()}::timestamptz end,
      license = ${source.license}, license_scope = ${JSON.stringify(source.licenseScope)}::jsonb,
      license_note = ${source.licenseNote}, license_evidence_url = ${source.licenseEvidenceUrl},
      trusted_for_facts = ${source.trustedForFacts}, consecutive_errors = 0, last_error = null, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteSource(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`delete from viral_radar_sources where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function getSourceForUser(id: string, userId: string): Promise<SourceRecord | null> {
  const db = getDb();
  const rows = await db`select * from viral_radar_sources where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapSource(rows[0]) : null;
}

export async function listSources(radarId: string): Promise<SourceRecord[]> {
  const db = getDb();
  const rows = await db`select * from viral_radar_sources where radar_id = ${radarId} order by created_at asc`;
  return rows.map(mapSource);
}

export async function recordSourceFetch(id: string, error: string | null): Promise<void> {
  const db = getDb();
  await db`
    update viral_radar_sources set last_fetched_at = now(), last_error = ${error ? error.slice(0, 300) : null},
      consecutive_errors = case when ${error === null} then 0 else consecutive_errors + 1 end, updated_at = now()
    where id = ${id}
  `;
}

// ──────────────────────────── Candidatos ────────────────────────────

export interface CandidateRecord {
  id: string;
  radarId: string;
  userId: string;
  sourceId: string | null;
  platform: CandidatePlatform;
  externalId: string;
  url: string;
  normalizedUrl: string;
  mediaUrl: string | null;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorId: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  metricsObservedAt: Date | null;
  score: number | null;
  scoreComponents: ScoreResult["components"] | null;
  scoreVersion: string | null;
  scoreReason: string | null;
  scoredAt: Date | null;
  authorizationStatus: AuthorizationStatus;
  authorizationType: AuthorizationType | null;
  authorizationScope: LicenseScope | null;
  authorizationNote: string | null;
  authorizedAt: Date | null;
  status: CandidateStatus;
  route: CandidateRoute | null;
  filterReason: string | null;
  queueItemId: string | null;
  aiAnalysis: Record<string, unknown> | null;
  aiAnalyzedAt: Date | null;
  brief: Record<string, unknown> | null;
  briefGeneratedAt: Date | null;
  captionMeta: Record<string, unknown> | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function mapCandidate(row: Row): CandidateRecord {
  return {
    id: row.id as string,
    radarId: row.radar_id as string,
    userId: row.user_id as string,
    sourceId: (row.source_id as string | null) ?? null,
    platform: row.platform as CandidatePlatform,
    externalId: row.external_id as string,
    url: row.url as string,
    normalizedUrl: row.normalized_url as string,
    mediaUrl: (row.media_url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? null,
    authorId: (row.author_id as string | null) ?? null,
    publishedAt: toDate(row.published_at),
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    durationSeconds: toNum(row.duration_seconds),
    views: toNum(row.views),
    likes: toNum(row.likes),
    comments: toNum(row.comments),
    metricsObservedAt: toDate(row.metrics_observed_at),
    score: toNum(row.score),
    scoreComponents: json(row.score_components, null),
    scoreVersion: (row.score_version as string | null) ?? null,
    scoreReason: (row.score_reason as string | null) ?? null,
    scoredAt: toDate(row.scored_at),
    authorizationStatus: row.authorization_status as AuthorizationStatus,
    authorizationType: (row.authorization_type as AuthorizationType | null) ?? null,
    authorizationScope: json(row.authorization_scope, null),
    authorizationNote: (row.authorization_note as string | null) ?? null,
    authorizedAt: toDate(row.authorized_at),
    status: row.status as CandidateStatus,
    route: (row.route as CandidateRoute | null) ?? null,
    filterReason: (row.filter_reason as string | null) ?? null,
    queueItemId: (row.queue_item_id as string | null) ?? null,
    aiAnalysis: json(row.ai_analysis, null),
    aiAnalyzedAt: toDate(row.ai_analyzed_at),
    brief: json(row.brief, null),
    briefGeneratedAt: toDate(row.brief_generated_at),
    captionMeta: json(row.caption_meta, null),
    firstSeenAt: toDate(row.first_seen_at)!,
    lastSeenAt: toDate(row.last_seen_at)!,
    createdAt: toDate(row.created_at)!,
    updatedAt: toDate(row.updated_at)!,
  };
}

export interface UpsertCandidateInput {
  radarId: string;
  userId: string;
  sourceId: string | null;
  platform: CandidatePlatform;
  externalId: string;
  url: string;
  normalizedUrl: string;
  mediaUrl: string | null;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorId: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  authorization: { status: AuthorizationStatus; type: "OWN" | "LICENSED" | null; scope: LicenseScope | null; note: string; authorizedAt: Date | null };
  now: Date;
}

/**
 * Uma linha por identidade de origem (plataforma + ID externo) em cada
 * radar: o mesmo vídeo encontrado por várias palavras-chave/fontes vira UM
 * candidato. Aprovação manual nunca é sobrescrita pela fonte.
 */
export async function upsertCandidate(input: UpsertCandidateInput): Promise<{ candidate: CandidateRecord; isNew: boolean }> {
  const db = getDb();
  const auth = input.authorization;
  const rows = await db`
    insert into viral_candidates (
      radar_id, user_id, source_id, platform, external_id, url, normalized_url, media_url, title, description, author_name, author_id,
      published_at, thumbnail_url, duration_seconds, authorization_status, authorization_type, authorization_scope, authorization_note,
      authorized_at, first_seen_at, last_seen_at
    ) values (
      ${input.radarId}, ${input.userId}, ${input.sourceId}, ${input.platform}, ${input.externalId}, ${input.url}, ${input.normalizedUrl},
      ${input.mediaUrl}, ${input.title}, ${input.description}, ${input.authorName}, ${input.authorId},
      ${input.publishedAt ? input.publishedAt.toISOString() : null}, ${input.thumbnailUrl}, ${input.durationSeconds},
      ${auth.status}, ${auth.type}, ${auth.scope ? JSON.stringify(auth.scope) : null}::jsonb, ${auth.note},
      ${auth.authorizedAt ? auth.authorizedAt.toISOString() : null}, ${input.now.toISOString()}, ${input.now.toISOString()}
    )
    on conflict (radar_id, platform, external_id) do update set
      last_seen_at = excluded.last_seen_at,
      title = coalesce(excluded.title, viral_candidates.title),
      description = coalesce(excluded.description, viral_candidates.description),
      author_name = coalesce(excluded.author_name, viral_candidates.author_name),
      thumbnail_url = coalesce(excluded.thumbnail_url, viral_candidates.thumbnail_url),
      media_url = coalesce(excluded.media_url, viral_candidates.media_url),
      duration_seconds = coalesce(excluded.duration_seconds, viral_candidates.duration_seconds),
      published_at = coalesce(viral_candidates.published_at, excluded.published_at),
      -- Mantém a autorização mais forte entre fontes diferentes (ex.: canal próprio x pesquisa ampla); aprovação manual nunca é sobrescrita.
      source_id = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then coalesce(excluded.source_id, viral_candidates.source_id) else viral_candidates.source_id end,
      authorization_status = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then excluded.authorization_status else viral_candidates.authorization_status end,
      authorization_type = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then excluded.authorization_type else viral_candidates.authorization_type end,
      authorization_scope = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then excluded.authorization_scope else viral_candidates.authorization_scope end,
      authorization_note = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then excluded.authorization_note else viral_candidates.authorization_note end,
      authorized_at = case when (viral_candidates.authorization_type is distinct from 'MANUAL_APPROVAL' and (viral_candidates.source_id is null or viral_candidates.source_id = excluded.source_id or (case excluded.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end) >= (case viral_candidates.authorization_status when 'AUTHORIZED' then 2 when 'PENDING_REVIEW' then 1 else 0 end))) then excluded.authorized_at else viral_candidates.authorized_at end,
      status = case when viral_candidates.status = 'UNAVAILABLE' then 'DISCOVERED' else viral_candidates.status end,
      updated_at = now()
    returning *, (xmax = 0) as inserted
  `;
  return { candidate: mapCandidate(rows[0]), isNew: Boolean(rows[0].inserted) };
}

/** Grava uma observação real de métricas (ignora repetição idêntica em menos de 10 min). */
export async function insertSnapshot(
  candidateId: string,
  observation: { observedAt: Date; views: number | null; likes: number | null; comments: number | null },
  provider: string,
): Promise<boolean> {
  if (observation.views === null && observation.likes === null && observation.comments === null) return false;
  const db = getDb();
  const rows = await db`
    insert into viral_metric_snapshots (candidate_id, observed_at, views, likes, comments, provider)
    select ${candidateId}, ${observation.observedAt.toISOString()}, ${observation.views}, ${observation.likes}, ${observation.comments}, ${provider}
    where not exists (
      select 1 from viral_metric_snapshots s
      where s.candidate_id = ${candidateId}
        and s.observed_at > ${observation.observedAt.toISOString()}::timestamptz - interval '10 minutes'
    )
    returning id
  `;
  if (rows.length > 0) {
    await db`
      update viral_candidates set
        views = coalesce(${observation.views}, views), likes = coalesce(${observation.likes}, likes), comments = coalesce(${observation.comments}, comments),
        metrics_observed_at = ${observation.observedAt.toISOString()}, updated_at = now()
      where id = ${candidateId}
    `;
  }
  return rows.length > 0;
}

export interface SnapshotRow {
  candidateId: string;
  observedAt: Date;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export async function listSnapshots(candidateIds: string[], perCandidate = 10): Promise<Map<string, SnapshotRow[]>> {
  const map = new Map<string, SnapshotRow[]>();
  if (candidateIds.length === 0) return map;
  const db = getDb();
  const rows = await db`
    select candidate_id, observed_at, views, likes, comments from (
      select s.*, row_number() over (partition by candidate_id order by observed_at desc) as rn
      from viral_metric_snapshots s where candidate_id = any(${candidateIds}::uuid[])
    ) t where rn <= ${perCandidate}
    order by observed_at desc
  `;
  for (const row of rows) {
    const id = row.candidate_id as string;
    const list = map.get(id) ?? [];
    list.push({ candidateId: id, observedAt: toDate(row.observed_at)!, views: toNum(row.views), likes: toNum(row.likes), comments: toNum(row.comments) });
    map.set(id, list);
  }
  return map;
}

/** Candidatos ainda "em jogo" no radar (para pontuar e selecionar). */
export async function listOpenCandidates(radarId: string, limit = 500): Promise<CandidateRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from viral_candidates
    where radar_id = ${radarId} and status in ('DISCOVERED', 'CLASSIFIED', 'FILTERED', 'AWAITING_AUTHORIZATION', 'ELIGIBLE', 'REFERENCE')
    order by last_seen_at desc
    limit ${limit}
  `;
  return rows.map(mapCandidate);
}

/** IDs do YouTube ainda acompanhados (para nova observação de métricas). */
export async function listTrackedYoutubeIds(radarId: string, maxAgeHours: number, limit: number): Promise<Array<{ id: string; externalId: string }>> {
  const db = getDb();
  const rows = await db`
    select id, external_id from viral_candidates
    where radar_id = ${radarId} and platform = 'YOUTUBE'
      and status in ('DISCOVERED', 'CLASSIFIED', 'FILTERED', 'AWAITING_AUTHORIZATION', 'ELIGIBLE', 'REFERENCE')
      and (published_at is null or published_at > now() - (${maxAgeHours} * interval '1 hour'))
    order by score desc nulls last, last_seen_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({ id: row.id as string, externalId: row.external_id as string }));
}

export async function saveCandidateScore(
  candidateId: string,
  result: ScoreResult,
  patch: { status: CandidateStatus; route: CandidateRoute | null; filterReason: string | null },
): Promise<void> {
  const db = getDb();
  await db`
    update viral_candidates set
      score = ${result.score}, score_components = ${JSON.stringify(result.components)}::jsonb, score_version = ${result.version},
      score_reason = ${result.reason.slice(0, 1000)}, scored_at = now(),
      status = case when status in ('QUEUED', 'IGNORED', 'UNAVAILABLE') then status else ${patch.status} end,
      route = case when status in ('QUEUED', 'IGNORED', 'UNAVAILABLE') then route else ${patch.route} end,
      filter_reason = ${patch.filterReason}, updated_at = now()
    where id = ${candidateId}
  `;
}

export async function markCandidateUnavailable(candidateId: string, reason: string): Promise<void> {
  const db = getDb();
  await db`
    update viral_candidates set status = 'UNAVAILABLE', filter_reason = ${reason}, updated_at = now()
    where id = ${candidateId} and status not in ('QUEUED', 'IGNORED')
  `;
}

/** Transição para QUEUED só a partir de ELIGIBLE (idempotente: uma segunda chamada não faz nada). */
export async function markCandidateQueued(candidateId: string, queueItemId: string, captionMeta: Record<string, unknown> | null): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_candidates set status = 'QUEUED', route = 'A', queue_item_id = ${queueItemId},
      caption_meta = ${captionMeta ? JSON.stringify(captionMeta) : null}::jsonb, updated_at = now()
    where id = ${candidateId} and status = 'ELIGIBLE'
    returning id
  `;
  return rows.length > 0;
}

export async function getCandidateForUser(id: string, userId: string): Promise<CandidateRecord | null> {
  const db = getDb();
  const rows = await db`select * from viral_candidates where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapCandidate(rows[0]) : null;
}

export async function getCandidateById(id: string): Promise<CandidateRecord | null> {
  const db = getDb();
  const rows = await db`select * from viral_candidates where id = ${id}`;
  return rows[0] ? mapCandidate(rows[0]) : null;
}

export async function setCandidateStatus(id: string, userId: string, status: CandidateStatus, route: CandidateRoute | null, from: CandidateStatus[]): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_candidates set status = ${status}, route = ${route}, updated_at = now()
    where id = ${id} and user_id = ${userId} and status = any(${from}::text[])
    returning id
  `;
  return rows.length > 0;
}

export async function approveCandidate(id: string, userId: string, scope: LicenseScope, note: string, now: Date): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update viral_candidates set authorization_status = 'AUTHORIZED', authorization_type = 'MANUAL_APPROVAL',
      authorization_scope = ${JSON.stringify(scope)}::jsonb, authorization_note = ${note}, authorized_at = ${now.toISOString()},
      status = 'ELIGIBLE', route = 'A', filter_reason = null, updated_at = now()
    where id = ${id} and user_id = ${userId} and status in ('AWAITING_AUTHORIZATION', 'REFERENCE', 'FILTERED', 'CLASSIFIED', 'DISCOVERED', 'ELIGIBLE', 'IGNORED')
    returning id
  `;
  return rows.length > 0;
}

export async function saveCandidateAi(id: string, analysis: Record<string, unknown>): Promise<void> {
  const db = getDb();
  await db`update viral_candidates set ai_analysis = ${JSON.stringify(analysis)}::jsonb, ai_analyzed_at = now(), updated_at = now() where id = ${id}`;
}

export async function saveCandidateBrief(id: string, userId: string, brief: Record<string, unknown>): Promise<void> {
  const db = getDb();
  await db`
    update viral_candidates set brief = ${JSON.stringify(brief)}::jsonb, brief_generated_at = now(),
      route = case when status = 'QUEUED' then route else 'B' end,
      status = case when status in ('QUEUED') then status else 'REFERENCE' end, updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

/**
 * URLs já usadas na MESMA conta do Instagram (qualquer fila/radar do
 * usuário, exceto itens cancelados): nunca republica automaticamente no
 * mesmo destino. Outra conta = outro destino, controlado separadamente.
 */
export async function findUsedUrlsForAccount(userId: string, instagramAccountId: string, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const db = getDb();
  const rows = await db`
    select distinct i.normalized_url from video_queue_items i
    join video_queues q on q.id = i.queue_id
    where i.user_id = ${userId} and q.instagram_account_id = ${instagramAccountId} and i.status <> 'CANCELLED'
      and i.normalized_url = any(${urls}::text[])
  `;
  return new Set(rows.map((row) => row.normalized_url as string));
}

export interface CandidateListFilter {
  status?: string | null;
  route?: string | null;
  limit: number;
  offset: number;
}

export interface CandidateWithPipeline extends CandidateRecord {
  itemStatus: string | null;
  itemMessage: string | null;
  postStatus: string | null;
  scheduledAtUtc: Date | null;
  queueStatus: string | null;
}

export async function listCandidatesForUser(radarId: string, userId: string, filter: CandidateListFilter): Promise<{ rows: CandidateWithPipeline[]; total: number }> {
  const db = getDb();
  const status = filter.status ?? null;
  const route = filter.route ?? null;
  const rows = await db`
    select c.*, i.status as item_status, i.status_message as item_message, i.scheduled_at_utc as item_scheduled_at,
      p.status as post_status, q.status as queue_status, count(*) over () as total_count
    from viral_candidates c
    left join video_queue_items i on i.id = c.queue_item_id
    left join video_queues q on q.id = i.queue_id
    left join instagram_posts p on p.id = i.post_id
    where c.radar_id = ${radarId} and c.user_id = ${userId}
      and (${status}::text is null or c.status = ${status}::text)
      and (${route}::text is null or c.route = ${route}::text)
    order by (c.status = 'QUEUED') asc, c.score desc nulls last, c.last_seen_at desc
    limit ${filter.limit} offset ${filter.offset}
  `;
  return {
    total: Number(rows[0]?.total_count ?? 0),
    rows: rows.map((row) => ({
      ...mapCandidate(row),
      itemStatus: (row.item_status as string | null) ?? null,
      itemMessage: (row.item_message as string | null) ?? null,
      postStatus: (row.post_status as string | null) ?? null,
      scheduledAtUtc: toDate(row.item_scheduled_at),
      queueStatus: (row.queue_status as string | null) ?? null,
    })),
  };
}

export interface RadarCounters {
  discoveredToday: number;
  classified: number;
  authorized: number;
  awaiting: number;
  references: number;
  queued: number;
  imported: number;
  ready: number;
  scheduled: number;
  published: number;
  errors: number;
  waitingFile: number;
}

export async function countRadarCandidates(radarId: string, since: Date): Promise<RadarCounters> {
  const db = getDb();
  const rows = await db`
    select
      count(*) filter (where c.first_seen_at >= ${since.toISOString()}::timestamptz) as discovered_today,
      count(*) filter (where c.score is not null) as classified,
      count(*) filter (where c.authorization_status = 'AUTHORIZED') as authorized,
      count(*) filter (where c.status = 'AWAITING_AUTHORIZATION') as awaiting,
      count(*) filter (where c.status = 'REFERENCE') as refs,
      count(*) filter (where c.status = 'QUEUED') as queued,
      count(*) filter (where i.status in ('READY', 'SCHEDULED', 'PUBLISHED')) as imported,
      count(*) filter (where i.status = 'READY') as ready,
      count(*) filter (where i.status = 'SCHEDULED') as scheduled,
      count(*) filter (where i.status = 'PUBLISHED') as published,
      count(*) filter (where i.status = 'ERROR' or p.status in ('FAILED', 'NEEDS_REVIEW')
        or exists (select 1 from social_publication_destinations d where d.post_id = p.id and d.status in ('FAILED', 'NEEDS_REVIEW'))) as errors,
      count(*) filter (where i.status = 'WAITING_FILE') as waiting_file
    from viral_candidates c
    left join video_queue_items i on i.id = c.queue_item_id
    left join instagram_posts p on p.id = i.post_id
    where c.radar_id = ${radarId}
  `;
  const row = rows[0] ?? {};
  return {
    discoveredToday: Number(row.discovered_today ?? 0),
    classified: Number(row.classified ?? 0),
    authorized: Number(row.authorized ?? 0),
    awaiting: Number(row.awaiting ?? 0),
    references: Number(row.refs ?? 0),
    queued: Number(row.queued ?? 0),
    imported: Number(row.imported ?? 0),
    ready: Number(row.ready ?? 0),
    scheduled: Number(row.scheduled ?? 0),
    published: Number(row.published ?? 0),
    errors: Number(row.errors ?? 0),
    waitingFile: Number(row.waiting_file ?? 0),
  };
}

/** Estoque da fila ligada (prontos, em processamento, agendados) — base do reabastecimento. */
export async function getQueueStock(queueId: string): Promise<{ ready: number; inPipeline: number; scheduled: number; waitingFile: number }> {
  const db = getDb();
  const rows = await db`
    select
      count(*) filter (where status = 'READY') as ready,
      count(*) filter (where status in ('PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING')) as in_pipeline,
      count(*) filter (where status = 'SCHEDULED') as scheduled,
      count(*) filter (where status = 'WAITING_FILE') as waiting_file
    from video_queue_items where queue_id = ${queueId}
  `;
  const row = rows[0] ?? {};
  return { ready: Number(row.ready ?? 0), inPipeline: Number(row.in_pipeline ?? 0), scheduled: Number(row.scheduled ?? 0), waitingFile: Number(row.waiting_file ?? 0) };
}

/** Ordena só os itens ainda sem horário (o que já está agendado/publicado nunca muda). */
export async function listUnscheduledQueueItemsWithScore(queueId: string): Promise<Array<{ id: string; position: number; createdAt: Date; score: number | null }>> {
  const db = getDb();
  const rows = await db`
    select i.id, i.position, i.created_at, c.score from video_queue_items i
    left join viral_candidates c on c.queue_item_id = i.id
    where i.queue_id = ${queueId} and i.status in ('PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING', 'READY', 'WAITING_FILE')
    order by i.position asc
  `;
  return rows.map((row) => ({ id: row.id as string, position: Number(row.position), createdAt: toDate(row.created_at)!, score: toNum(row.score) }));
}

export async function setUnscheduledPositions(queueId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = getDb();
  await db`
    update video_queue_items i set position = base.max_pos + ord.idx::int, updated_at = now()
    from (select coalesce(max(position), 0) as max_pos from video_queue_items where queue_id = ${queueId} and status in ('SCHEDULED', 'PUBLISHED')) base,
      unnest(${orderedIds}::uuid[]) with ordinality as ord(id, idx)
    where i.id = ord.id and i.queue_id = ${queueId} and i.status in ('PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING', 'READY', 'WAITING_FILE')
  `;
}

export async function setQueueItemContent(itemId: string, content: { title: string | null; caption: string | null; facebookCaption: string | null }): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set title = ${content.title}, caption = ${content.caption}, facebook_caption = ${content.facebookCaption}, updated_at = now()
    where id = ${itemId} and status not in ('PUBLISHED', 'CANCELLED', 'SCHEDULED')
  `;
}

// ──────────────────────────── Execuções ────────────────────────────

export async function insertExecution(radarId: string, userId: string, trigger: ExecutionTrigger): Promise<string> {
  const db = getDb();
  const rows = await db`insert into viral_radar_executions (radar_id, user_id, trigger) values (${radarId}, ${userId}, ${trigger}) returning id`;
  return rows[0].id as string;
}

export interface ExecutionStats {
  discovered: number;
  newCandidates: number;
  refreshed: number;
  scored: number;
  queued: number;
  awaiting: number;
  references: number;
  quotaUnits: number;
  aiCalls: number;
  errors: Array<{ source: string; code: string; message: string }>;
}

export async function finishExecution(id: string, status: ExecutionStatus, stats: ExecutionStats, message: string): Promise<void> {
  const db = getDb();
  await db`
    update viral_radar_executions set status = ${status}, finished_at = now(), discovered = ${stats.discovered}, new_candidates = ${stats.newCandidates},
      refreshed = ${stats.refreshed}, scored = ${stats.scored}, queued = ${stats.queued}, awaiting = ${stats.awaiting},
      references_count = ${stats.references}, quota_units = ${stats.quotaUnits}, ai_calls = ${stats.aiCalls},
      errors = ${JSON.stringify(stats.errors.slice(0, 20))}::jsonb, message = ${message.slice(0, 500)}
    where id = ${id} and status = 'RUNNING'
  `;
}

/** Execuções que ficaram RUNNING (worker morreu) viram ABANDONED — limpeza de jobs abandonados. */
export async function abandonStaleExecutions(olderThanMinutes: number): Promise<number> {
  const db = getDb();
  const rows = await db`
    update viral_radar_executions set status = 'ABANDONED', finished_at = now(), message = 'Execução interrompida (worker reiniciado ou tempo esgotado).'
    where status = 'RUNNING' and started_at < now() - (${olderThanMinutes} * interval '1 minute')
    returning id
  `;
  return rows.length;
}

export interface ExecutionRecord {
  id: string;
  trigger: ExecutionTrigger;
  status: ExecutionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  discovered: number;
  newCandidates: number;
  refreshed: number;
  scored: number;
  queued: number;
  awaiting: number;
  references: number;
  quotaUnits: number;
  aiCalls: number;
  errors: Array<{ source: string; code: string; message: string }>;
  message: string | null;
}

export async function listExecutions(radarId: string, userId: string, limit = 30): Promise<ExecutionRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from viral_radar_executions where radar_id = ${radarId} and user_id = ${userId} order by started_at desc limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    trigger: row.trigger as ExecutionTrigger,
    status: row.status as ExecutionStatus,
    startedAt: toDate(row.started_at)!,
    finishedAt: toDate(row.finished_at),
    discovered: Number(row.discovered),
    newCandidates: Number(row.new_candidates),
    refreshed: Number(row.refreshed),
    scored: Number(row.scored),
    queued: Number(row.queued),
    awaiting: Number(row.awaiting),
    references: Number(row.references_count),
    quotaUnits: Number(row.quota_units),
    aiCalls: Number(row.ai_calls),
    errors: json(row.errors, []),
    message: (row.message as string | null) ?? null,
  }));
}

export async function sumUsageSince(radarId: string, since: Date): Promise<{ quotaUnits: number; aiCalls: number }> {
  const db = getDb();
  const rows = await db`
    select coalesce(sum(quota_units), 0) as units, coalesce(sum(ai_calls), 0) as ai from viral_radar_executions
    where radar_id = ${radarId} and started_at >= ${since.toISOString()}::timestamptz
  `;
  return { quotaUnits: Number(rows[0]?.units ?? 0), aiCalls: Number(rows[0]?.ai ?? 0) };
}

// ───────────────────────────── Eventos ─────────────────────────────

export async function insertRadarEvent(radarId: string, candidateId: string | null, event: string, message: string | null = null): Promise<void> {
  const db = getDb();
  await db`insert into viral_radar_events (radar_id, candidate_id, event, message) values (${radarId}, ${candidateId}, ${event}, ${message ? message.slice(0, 500) : null})`;
}

export async function countRadarEventsSince(radarId: string, events: string[], since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as n from viral_radar_events where radar_id = ${radarId} and event = any(${events}::text[]) and created_at >= ${since.toISOString()}::timestamptz
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function listRadarEvents(radarId: string, userId: string, limit = 100) {
  const db = getDb();
  const rows = await db`
    select e.id, e.candidate_id, e.event, e.message, e.created_at, c.title as candidate_title
    from viral_radar_events e
    join viral_radars r on r.id = e.radar_id
    left join viral_candidates c on c.id = e.candidate_id
    where e.radar_id = ${radarId} and r.user_id = ${userId}
    order by e.created_at desc limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    candidateId: (row.candidate_id as string | null) ?? null,
    candidateTitle: (row.candidate_title as string | null) ?? null,
    event: row.event as string,
    message: (row.message as string | null) ?? null,
    createdAt: toDate(row.created_at)!,
  }));
}

// ───────────────────────── Cota e cache ─────────────────────────

/** Reserva atômica de unidades de cota do dia (UTC). false = teto diário atingido. */
export async function reserveProviderUnits(provider: string, day: string, units: number, dailyCap: number): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    insert into viral_provider_usage (provider, usage_date, units)
    select ${provider}, ${day}::date, ${units} where ${units} <= ${dailyCap}
    on conflict (provider, usage_date) do update set units = viral_provider_usage.units + excluded.units
      where viral_provider_usage.units + excluded.units <= ${dailyCap}
    returning units
  `;
  return rows.length > 0;
}

export async function getProviderUsage(provider: string, day: string): Promise<number> {
  const db = getDb();
  const rows = await db`select units from viral_provider_usage where provider = ${provider} and usage_date = ${day}::date`;
  return Number(rows[0]?.units ?? 0);
}

export async function readCache<T>(key: string, now: Date): Promise<T | null> {
  const db = getDb();
  const rows = await db`select payload from viral_query_cache where cache_key = ${key} and expires_at > ${now.toISOString()}::timestamptz`;
  return rows[0] ? json<T | null>(rows[0].payload, null) : null;
}

export async function writeCache(key: string, payload: unknown, expiresAt: Date): Promise<void> {
  const db = getDb();
  await db`
    insert into viral_query_cache (cache_key, payload, expires_at) values (${key}, ${JSON.stringify(payload)}::jsonb, ${expiresAt.toISOString()})
    on conflict (cache_key) do update set payload = excluded.payload, expires_at = excluded.expires_at, created_at = now()
  `;
}

export async function purgeExpiredCache(now: Date): Promise<void> {
  const db = getDb();
  await db`delete from viral_query_cache where expires_at < ${now.toISOString()}::timestamptz - interval '1 day'`;
}

// ─────────────────────── Monitoramento de resultados ───────────────────────

export interface PublishedForMonitoring {
  radarId: string;
  userId: string;
  queueItemId: string;
  postId: string;
  igMediaId: string | null;
  instagramAccountId: string;
  publishedAt: Date | null;
  facebook: Array<{ externalId: string; pageRef: string | null }>;
  lastObservedAt: Date | null;
}

/** Publicações do radar (até 30 dias) cuja última coleta tem mais de `minHours`. */
export async function listPublishedForMonitoring(minHours: number, limit: number): Promise<PublishedForMonitoring[]> {
  const db = getDb();
  const rows = await db`
    select r.id as radar_id, r.user_id, i.id as item_id, p.id as post_id, p.meta_media_id, p.instagram_account_id, p.published_at,
      (select max(observed_at) from viral_post_metrics m where m.queue_item_id = i.id) as last_observed,
      (select coalesce(json_agg(json_build_object('externalId', d.external_publication_id, 'pageRef', d.facebook_page_ref)), '[]'::json)
        from social_publication_destinations d where d.post_id = p.id and d.status = 'PUBLISHED' and d.external_publication_id is not null) as fb
    from viral_candidates c
    join viral_radars r on r.id = c.radar_id and r.status <> 'ARCHIVED'
    join video_queue_items i on i.id = c.queue_item_id
    join instagram_posts p on p.id = i.post_id
    where (p.status = 'PUBLISHED' or exists (select 1 from social_publication_destinations d2 where d2.post_id = p.id and d2.status = 'PUBLISHED'))
      and coalesce(p.published_at, i.published_at, p.updated_at) > now() - interval '30 days'
      and not exists (
        select 1 from viral_post_metrics m where m.queue_item_id = i.id and m.observed_at > now() - (${minHours} * interval '1 hour')
      )
    order by last_observed asc nulls first
    limit ${limit}
  `;
  return rows.map((row) => ({
    radarId: row.radar_id as string,
    userId: row.user_id as string,
    queueItemId: row.item_id as string,
    postId: row.post_id as string,
    igMediaId: (row.meta_media_id as string | null) ?? null,
    instagramAccountId: row.instagram_account_id as string,
    publishedAt: toDate(row.published_at),
    facebook: json<Array<{ externalId: string; pageRef: string | null }>>(row.fb, []),
    lastObservedAt: toDate(row.last_observed),
  }));
}

export async function insertPostMetrics(input: {
  userId: string;
  radarId: string;
  queueItemId: string;
  postId: string;
  platform: "instagram" | "facebook";
  externalId: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  unavailable: string[];
}): Promise<void> {
  const db = getDb();
  await db`
    insert into viral_post_metrics (user_id, radar_id, queue_item_id, post_id, platform, external_id, views, reach, likes, comments, shares, saves, unavailable)
    values (${input.userId}, ${input.radarId}, ${input.queueItemId}, ${input.postId}, ${input.platform}, ${input.externalId}, ${input.views},
      ${input.reach}, ${input.likes}, ${input.comments}, ${input.shares}, ${input.saves}, ${input.unavailable}::text[])
  `;
}

export interface PerformanceRow {
  queueItemId: string;
  platform: string;
  title: string | null;
  captionStyle: string | null;
  contentType: string | null;
  publishedAt: Date | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  unavailable: string[];
}

/** Última observação de cada publicação do radar, por plataforma. */
export async function listLatestPostMetrics(radarId: string, userId: string): Promise<PerformanceRow[]> {
  const db = getDb();
  const rows = await db`
    select distinct on (m.queue_item_id, m.platform) m.queue_item_id, m.platform, m.views, m.reach, m.likes, m.comments, m.shares, m.saves,
      m.unavailable, i.title, coalesce(p.published_at, i.published_at) as published_at,
      c.caption_meta->>'style' as caption_style, c.ai_analysis->>'contentType' as content_type
    from viral_post_metrics m
    join video_queue_items i on i.id = m.queue_item_id
    left join instagram_posts p on p.id = m.post_id
    left join viral_candidates c on c.queue_item_id = m.queue_item_id
    where m.radar_id = ${radarId} and m.user_id = ${userId}
    order by m.queue_item_id, m.platform, m.observed_at desc
  `;
  return rows.map((row) => ({
    queueItemId: row.queue_item_id as string,
    platform: row.platform as string,
    title: (row.title as string | null) ?? null,
    captionStyle: (row.caption_style as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    publishedAt: toDate(row.published_at),
    views: toNum(row.views),
    reach: toNum(row.reach),
    likes: toNum(row.likes),
    comments: toNum(row.comments),
    shares: toNum(row.shares),
    saves: toNum(row.saves),
    unavailable: (row.unavailable as string[] | null) ?? [],
  }));
}
