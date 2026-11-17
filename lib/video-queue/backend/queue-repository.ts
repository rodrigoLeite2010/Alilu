import "server-only";
import { getDb } from "@/lib/db/client";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import { waitingFileMessage, type ParsedQueueLink } from "@/lib/video-queue/links";
import type { QueueScheduleConfig } from "@/lib/video-queue/schedule";
import type {
  VideoQueueItemStatus,
  VideoQueueNotReadyPolicy,
  VideoQueueOrderMode,
  VideoQueueSourceKind,
  VideoQueueStatus,
} from "@/lib/video-queue/types";

/**
 * SQL da Fila de vídeos (video_queues, video_queue_items,
 * video_queue_events). Toda consulta disparada por usuário filtra por
 * `user_id`; as do worker/planejador usam locks com token (nunca
 * sobrescrevem o trabalho de outro worker).
 */

type Row = Record<string, unknown>;

const toDate = (value: unknown): Date | null => (value === null || value === undefined ? null : new Date(value as string));
const toNum = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const toDateOnly = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

export interface VideoQueueRecord {
  id: string;
  userId: string;
  name: string;
  category: string;
  theme: string;
  status: VideoQueueStatus;
  pauseReason: string | null;
  pausedBySystem: boolean;
  instagramAccountId: string;
  publishToInstagram: boolean;
  facebookPageIds: string[];
  schedule: QueueScheduleConfig;
  captionTemplate: string;
  facebookCaptionTemplate: string | null;
  rightsConfirmedAt: Date;
  lastPlannedAt: Date | null;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapQueue(row: Row): VideoQueueRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    category: row.category as string,
    theme: row.theme as string,
    status: row.status as VideoQueueStatus,
    pauseReason: (row.pause_reason as string | null) ?? null,
    pausedBySystem: Boolean(row.paused_by_system),
    instagramAccountId: row.instagram_account_id as string,
    publishToInstagram: row.publish_to_instagram !== false,
    facebookPageIds: Array.isArray(row.facebook_page_ids) ? (row.facebook_page_ids as string[]) : [],
    schedule: {
      timezone: row.timezone as string,
      startDate: toDateOnly(row.start_date),
      postsPerDay: Number(row.posts_per_day),
      publishTimes: Array.isArray(row.publish_times) ? (row.publish_times as string[]) : [],
      weekdays: Array.isArray(row.weekdays) ? (row.weekdays as unknown[]).map(Number) : [],
      minIntervalMinutes: Number(row.min_interval_minutes),
      allowSameSlot: Boolean(row.allow_same_slot),
      orderMode: row.order_mode as VideoQueueOrderMode,
      notReadyPolicy: row.not_ready_policy as VideoQueueNotReadyPolicy,
      materializeAheadHours: Number(row.materialize_ahead_hours),
    },
    captionTemplate: (row.caption_template as string) ?? "",
    facebookCaptionTemplate: (row.facebook_caption_template as string | null) ?? null,
    rightsConfirmedAt: toDate(row.rights_confirmed_at)!,
    lastPlannedAt: toDate(row.last_planned_at),
    activatedAt: toDate(row.activated_at),
    createdAt: toDate(row.created_at)!,
    updatedAt: toDate(row.updated_at)!,
  };
}

export interface VideoQueueItemRecord {
  id: string;
  queueId: string;
  userId: string;
  position: number;
  sourceUrl: string;
  normalizedUrl: string;
  sourceKind: VideoQueueSourceKind;
  status: VideoQueueItemStatus;
  statusMessage: string | null;
  errorCode: string | null;
  attemptsCount: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  instagramImportId: string | null;
  blobUrl: string | null;
  blobPath: string | null;
  thumbnailUrl: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  hasAudio: boolean | null;
  facebookIncompatibleReason: string | null;
  title: string | null;
  caption: string | null;
  facebookCaption: string | null;
  postId: string | null;
  scheduledAtUtc: Date | null;
  facebookNote: string | null;
  authorizedAt: Date;
  importedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapItem(row: Row): VideoQueueItemRecord {
  return {
    id: row.id as string,
    queueId: row.queue_id as string,
    userId: row.user_id as string,
    position: Number(row.position),
    sourceUrl: row.source_url as string,
    normalizedUrl: row.normalized_url as string,
    sourceKind: row.source_kind as VideoQueueSourceKind,
    status: row.status as VideoQueueItemStatus,
    statusMessage: (row.status_message as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    attemptsCount: Number(row.attempts_count ?? 0),
    nextAttemptAt: toDate(row.next_attempt_at),
    lastAttemptAt: toDate(row.last_attempt_at),
    instagramImportId: (row.instagram_import_id as string | null) ?? null,
    blobUrl: (row.blob_url as string | null) ?? null,
    blobPath: (row.blob_path as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    fileSizeBytes: toNum(row.file_size_bytes),
    durationSeconds: toNum(row.duration_seconds),
    width: toNum(row.width),
    height: toNum(row.height),
    videoCodec: (row.video_codec as string | null) ?? null,
    hasAudio: row.has_audio === null || row.has_audio === undefined ? null : Boolean(row.has_audio),
    facebookIncompatibleReason: (row.facebook_incompatible_reason as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    caption: (row.caption as string | null) ?? null,
    facebookCaption: (row.facebook_caption as string | null) ?? null,
    postId: (row.post_id as string | null) ?? null,
    scheduledAtUtc: toDate(row.scheduled_at_utc),
    facebookNote: (row.facebook_note as string | null) ?? null,
    authorizedAt: toDate(row.authorized_at)!,
    importedAt: toDate(row.imported_at),
    publishedAt: toDate(row.published_at),
    createdAt: toDate(row.created_at)!,
    updatedAt: toDate(row.updated_at)!,
  };
}

// ───────────────────────────── Filas ─────────────────────────────

export interface InsertQueueInput {
  userId: string;
  name: string;
  category: string;
  theme: string;
  instagramAccountId: string;
  publishToInstagram: boolean;
  facebookPageIds: string[];
  schedule: QueueScheduleConfig;
  captionTemplate: string;
  facebookCaptionTemplate: string | null;
  rightsConfirmedAt: Date;
}

export async function insertQueue(input: InsertQueueInput): Promise<string> {
  const db = getDb();
  const s = input.schedule;
  const rows = await db`
    insert into video_queues (
      user_id, name, category, theme, instagram_account_id, publish_to_instagram, facebook_page_ids,
      timezone, start_date, posts_per_day, publish_times, weekdays, min_interval_minutes, allow_same_slot,
      order_mode, not_ready_policy, materialize_ahead_hours, caption_template, facebook_caption_template, rights_confirmed_at
    ) values (
      ${input.userId}, ${input.name}, ${input.category}, ${input.theme}, ${input.instagramAccountId}, ${input.publishToInstagram},
      ${input.facebookPageIds}::uuid[], ${s.timezone}, ${s.startDate}, ${s.postsPerDay}, ${s.publishTimes}::text[], ${s.weekdays}::int[],
      ${s.minIntervalMinutes}, ${s.allowSameSlot}, ${s.orderMode}, ${s.notReadyPolicy}, ${s.materializeAheadHours},
      ${input.captionTemplate}, ${input.facebookCaptionTemplate}, ${input.rightsConfirmedAt.toISOString()}
    )
    returning id
  `;
  return rows[0].id as string;
}

export async function getQueueForUser(id: string, userId: string): Promise<VideoQueueRecord | null> {
  const db = getDb();
  const rows = await db`select * from video_queues where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapQueue(rows[0]) : null;
}

export async function getQueueById(id: string): Promise<VideoQueueRecord | null> {
  const db = getDb();
  const rows = await db`select * from video_queues where id = ${id}`;
  return rows[0] ? mapQueue(rows[0]) : null;
}

export interface QueueCounts {
  total: number;
  imported: number;
  pending: number;
  waitingFile: number;
  ready: number;
  scheduled: number;
  published: number;
  errors: number;
  cancelled: number;
  nextPublicationAt: Date | null;
}

function mapCounts(row: Row | undefined): QueueCounts {
  return {
    total: Number(row?.total ?? 0),
    imported: Number(row?.imported ?? 0),
    pending: Number(row?.pending ?? 0),
    waitingFile: Number(row?.waiting_file ?? 0),
    ready: Number(row?.ready ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    published: Number(row?.published ?? 0),
    errors: Number(row?.errors ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    nextPublicationAt: toDate(row?.next_publication_at),
  };
}

/** Contadores do painel (itens cancelados não entram no total de links). */
export async function countItemsByQueue(userId: string, queueId?: string): Promise<Map<string, QueueCounts>> {
  const db = getDb();
  const rows = await db`
    select i.queue_id,
      count(*) filter (where i.status <> 'CANCELLED') as total,
      count(*) filter (where i.status in ('READY', 'SCHEDULED', 'PUBLISHED')) as imported,
      count(*) filter (where i.status in ('PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING', 'WAITING_FILE')) as pending,
      count(*) filter (where i.status = 'WAITING_FILE') as waiting_file,
      count(*) filter (where i.status = 'READY') as ready,
      count(*) filter (where i.status = 'SCHEDULED') as scheduled,
      count(*) filter (where i.status = 'PUBLISHED') as published,
      count(*) filter (
        where i.status = 'ERROR'
           or (i.status = 'SCHEDULED' and (
                p.status in ('FAILED', 'NEEDS_REVIEW')
                or exists (select 1 from social_publication_destinations d where d.post_id = p.id and d.status in ('FAILED', 'NEEDS_REVIEW'))
              ))
      ) as errors,
      count(*) filter (where i.status = 'CANCELLED') as cancelled,
      min(i.scheduled_at_utc) filter (where i.status = 'SCHEDULED' and i.scheduled_at_utc > now() and p.status = 'SCHEDULED') as next_publication_at
    from video_queue_items i
    left join instagram_posts p on p.id = i.post_id
    where i.user_id = ${userId} and (${queueId ?? null}::uuid is null or i.queue_id = ${queueId ?? null}::uuid)
    group by i.queue_id
  `;
  const map = new Map<string, QueueCounts>();
  for (const row of rows) map.set(row.queue_id as string, mapCounts(row));
  return map;
}

export function emptyCounts(): QueueCounts {
  return mapCounts(undefined);
}

export async function listQueuesForUser(userId: string): Promise<VideoQueueRecord[]> {
  const db = getDb();
  const rows = await db`select * from video_queues where user_id = ${userId} and status <> 'ARCHIVED' order by created_at desc`;
  return rows.map(mapQueue);
}

export interface UpdateQueueSettingsInput {
  name: string;
  publishToInstagram: boolean;
  facebookPageIds: string[];
  schedule: QueueScheduleConfig;
  captionTemplate: string;
  facebookCaptionTemplate: string | null;
}

export async function updateQueueSettings(id: string, userId: string, input: UpdateQueueSettingsInput): Promise<boolean> {
  const db = getDb();
  const s = input.schedule;
  const rows = await db`
    update video_queues set
      name = ${input.name}, publish_to_instagram = ${input.publishToInstagram}, facebook_page_ids = ${input.facebookPageIds}::uuid[],
      timezone = ${s.timezone}, start_date = ${s.startDate}, posts_per_day = ${s.postsPerDay}, publish_times = ${s.publishTimes}::text[],
      weekdays = ${s.weekdays}::int[], min_interval_minutes = ${s.minIntervalMinutes}, allow_same_slot = ${s.allowSameSlot},
      order_mode = ${s.orderMode}, not_ready_policy = ${s.notReadyPolicy}, materialize_ahead_hours = ${s.materializeAheadHours},
      caption_template = ${input.captionTemplate}, facebook_caption_template = ${input.facebookCaptionTemplate}, updated_at = now()
    where id = ${id} and user_id = ${userId} and status <> 'ARCHIVED'
    returning id
  `;
  return rows.length > 0;
}

export async function setQueueStatus(
  id: string,
  status: VideoQueueStatus,
  options: { reason?: string | null; bySystem?: boolean; fromStatuses?: VideoQueueStatus[] } = {},
): Promise<boolean> {
  const db = getDb();
  const from = options.fromStatuses ?? ["DRAFT", "ACTIVE", "PAUSED"];
  const rows = await db`
    update video_queues set
      status = ${status},
      pause_reason = ${status === "PAUSED" ? (options.reason ?? null) : null},
      paused_by_system = ${status === "PAUSED" && options.bySystem === true},
      activated_at = case when ${status} = 'ACTIVE' then coalesce(activated_at, now()) else activated_at end,
      updated_at = now()
    where id = ${id} and status = any(${from}::text[])
    returning id
  `;
  return rows.length > 0;
}

/** Lock do planejamento: um planejador por fila de cada vez (cron, ações do usuário). */
export async function acquirePlanningLock(queueId: string, token: string, ttlSeconds: number): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queues set planning_lock_token = ${token},
      planning_lock_expires_at = now() + (${ttlSeconds}::int * interval '1 second')
    where id = ${queueId} and (planning_lock_token is null or planning_lock_expires_at < now())
    returning id
  `;
  return rows.length > 0;
}

export async function releasePlanningLock(queueId: string, token: string, planned = false): Promise<void> {
  const db = getDb();
  await db`
    update video_queues set planning_lock_token = null, planning_lock_expires_at = null,
      last_planned_at = case when ${planned} then now() else last_planned_at end
    where id = ${queueId} and planning_lock_token = ${token}
  `;
}

/** Filas que o cron precisa olhar: ativas (planejar) ou com itens agendados (sincronizar resultado). */
export async function listQueueIdsForCron(limit: number): Promise<string[]> {
  const db = getDb();
  const rows = await db`
    select q.id from video_queues q
    where q.status = 'ACTIVE'
       or exists (select 1 from video_queue_items i where i.queue_id = q.id and i.status = 'SCHEDULED')
    order by q.last_planned_at asc nulls first
    limit ${limit}
  `;
  return rows.map((row) => row.id as string);
}

/** Opções de processamento da fila (padrão neutro nas filas existentes). */
export async function getQueueProcessingOptions(queueId: string): Promise<{
  instagramAccountId: string;
  blockDuplicateFiles: boolean;
  reframeMode: "NONE" | "FIT_9_16";
  maxDurationSeconds: number | null;
} | null> {
  const db = getDb();
  let rows: Row[];
  try {
    rows = await db`select instagram_account_id, block_duplicate_files, reframe_mode, max_duration_seconds from video_queues where id = ${queueId}`;
  } catch (error) {
    // Migração 0056 ainda não aplicada: a fila segue exatamente como antes.
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  const row = rows[0];
  if (!row) return null;
  return {
    instagramAccountId: row.instagram_account_id as string,
    blockDuplicateFiles: Boolean(row.block_duplicate_files),
    reframeMode: row.reframe_mode === "FIT_9_16" ? "FIT_9_16" : "NONE",
    maxDurationSeconds: row.max_duration_seconds === null || row.max_duration_seconds === undefined ? null : Number(row.max_duration_seconds),
  };
}

export async function setQueueProcessingOptions(
  queueId: string,
  userId: string,
  input: { blockDuplicateFiles: boolean; reframeMode: "NONE" | "FIT_9_16"; maxDurationSeconds: number | null },
): Promise<void> {
  const db = getDb();
  await db`
    update video_queues set block_duplicate_files = ${input.blockDuplicateFiles}, reframe_mode = ${input.reframeMode},
      max_duration_seconds = ${input.maxDurationSeconds}, updated_at = now()
    where id = ${queueId} and user_id = ${userId}
  `;
}

/** Mesmo arquivo (hash) já usado na mesma conta do Instagram por outro item ativo/publicado. */
export async function findDuplicateFileForAccount(userId: string, instagramAccountId: string, sha256: string, exceptItemId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db`
    select i.id from video_queue_items i join video_queues q on q.id = i.queue_id
    where i.user_id = ${userId} and i.content_sha256 = ${sha256} and i.id <> ${exceptItemId}
      and q.instagram_account_id = ${instagramAccountId} and i.status in ('READY', 'SCHEDULED', 'PUBLISHED')
    limit 1
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

// ───────────────────────────── Itens ─────────────────────────────

export async function countActiveItems(queueId: string): Promise<number> {
  const db = getDb();
  const rows = await db`select count(*)::int as n from video_queue_items where queue_id = ${queueId} and status <> 'CANCELLED'`;
  return Number(rows[0]?.n ?? 0);
}

/** Insere os links no fim da fila. Link repetido na mesma fila é ignorado (índice único parcial). */
export async function insertItems(
  queueId: string,
  userId: string,
  links: ParsedQueueLink[],
  authorizedAt: Date,
): Promise<{ inserted: VideoQueueItemRecord[]; duplicates: string[] }> {
  if (links.length === 0) return { inserted: [], duplicates: [] };
  const db = getDb();
  const input = links.map((link) => {
    // Plataformas sem download autorizado já nascem aguardando o arquivo.
    const needsFile = link.kind === "YOUTUBE" || link.kind === "TIKTOK" || link.kind === "OTHER_PLATFORM";
    const status = needsFile ? "WAITING_FILE" : "PENDING";
    const message = needsFile ? waitingFileMessage(link.kind, link.platform) : null;
    const code = needsFile ? "AUTHORIZED_FILE_REQUIRED" : null;
    return { sourceUrl: link.sourceUrl, normalizedUrl: link.normalizedUrl, kind: link.kind, status, message, code };
  });
  const rows = await db`
    insert into video_queue_items (queue_id, user_id, position, source_url, normalized_url, source_kind, status, status_message, error_code, authorized_at)
    select q.id, q.user_id, (coalesce(last_item.position, 0) + row_number() over (order by link.ordinality))::int,
      link.data->>'sourceUrl', link.data->>'normalizedUrl', link.data->>'kind', link.data->>'status',
      link.data->>'message', link.data->>'code', ${authorizedAt.toISOString()}::timestamptz
    from video_queues q
    cross join jsonb_array_elements(${JSON.stringify(input)}::jsonb) with ordinality as link(data, ordinality)
    cross join lateral (select max(position) as position from video_queue_items where queue_id = q.id) last_item
    where q.id = ${queueId} and q.user_id = ${userId} and q.status <> 'ARCHIVED'
      and not exists (
        select 1 from video_queue_items i
        where i.queue_id = q.id and i.normalized_url = link.data->>'normalizedUrl' and i.status <> 'CANCELLED'
      )
    order by link.ordinality
    on conflict (queue_id, normalized_url) where status <> 'CANCELLED' do nothing
    returning *
  `;
  const inserted = rows.map(mapItem).sort((a, b) => a.position - b.position);
  const insertedUrls = new Set(inserted.map((item) => item.normalizedUrl));
  const duplicates = links.filter((link) => !insertedUrls.has(link.normalizedUrl)).map((link) => link.sourceUrl);
  return { inserted, duplicates };
}

/** Links já presentes em OUTRAS filas do usuário (aviso de duplicidade entre filas). */
export async function findUrlsInOtherQueues(userId: string, queueId: string, urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];
  const db = getDb();
  const rows = await db`
    select distinct normalized_url from video_queue_items
    where user_id = ${userId} and queue_id <> ${queueId} and status <> 'CANCELLED' and normalized_url = any(${urls}::text[])
  `;
  return rows.map((row) => row.normalized_url as string);
}

export async function listItemsForQueue(queueId: string, userId: string): Promise<VideoQueueItemRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from video_queue_items where queue_id = ${queueId} and user_id = ${userId} order by position asc
  `;
  return rows.map(mapItem);
}

export async function getItemForUser(itemId: string, userId: string): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const rows = await db`select * from video_queue_items where id = ${itemId} and user_id = ${userId}`;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function getItemById(itemId: string): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const rows = await db`select * from video_queue_items where id = ${itemId}`;
  return rows[0] ? mapItem(rows[0]) : null;
}

/** Itens em processamento agora (lock válido) — teto global de concorrência de downloads. */
export async function countInFlightItems(): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as n from video_queue_items
    where status in ('VALIDATING', 'IMPORTING', 'PROCESSING') and processing_lock_expires_at > now()
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * CLAIM ATÔMICO do worker de importação (FOR UPDATE SKIP LOCKED): pega o
 * próximo item PENDENTE vencido, ou um item cujo worker morreu (lock
 * expirado em VALIDATING/IMPORTING/PROCESSING — retomada após reinício).
 * Filas arquivadas não importam.
 */
export async function claimNextItemForImport(
  lockToken: string,
  lockTtlSeconds: number,
  scope: { userId?: string | null; queueId?: string | null; itemId?: string | null } = {},
): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const userId = scope.userId ?? null;
  const queueId = scope.queueId ?? null;
  const itemId = scope.itemId ?? null;
  const rows = await db`
    update video_queue_items i
    set status = 'VALIDATING',
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        attempts_count = i.attempts_count + 1,
        last_attempt_at = now(), updated_at = now()
    where i.id = (
      select c.id from video_queue_items c
      join video_queues q on q.id = c.queue_id
      where q.status <> 'ARCHIVED'
        and (${userId}::uuid is null or c.user_id = ${userId}::uuid)
        and (${queueId}::uuid is null or c.queue_id = ${queueId}::uuid)
        and (${itemId}::uuid is null or c.id = ${itemId}::uuid)
        and (
          (c.status = 'PENDING' and (c.next_attempt_at is null or c.next_attempt_at <= now()))
          or (c.status in ('VALIDATING', 'IMPORTING', 'PROCESSING') and (c.processing_lock_token is null or c.processing_lock_expires_at < now()))
        )
      order by coalesce(c.next_attempt_at, c.created_at) asc, c.position asc
      limit 1
      for update of c skip locked
    )
    and (
      (i.status = 'PENDING' and (i.next_attempt_at is null or i.next_attempt_at <= now()))
      or (i.status in ('VALIDATING', 'IMPORTING', 'PROCESSING') and (i.processing_lock_token is null or i.processing_lock_expires_at < now()))
    )
    returning i.*
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

/** Avança o status (VALIDATING → IMPORTING → PROCESSING) sem soltar o lock. */
export async function setItemStage(itemId: string, lockToken: string, status: "VALIDATING" | "IMPORTING" | "PROCESSING", message: string | null = null): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set status = ${status}, status_message = ${message}, updated_at = now()
    where id = ${itemId} and processing_lock_token = ${lockToken}
    returning id
  `;
  return rows.length > 0;
}

export async function setItemInstagramImport(itemId: string, lockToken: string, importId: string): Promise<void> {
  const db = getDb();
  await db`update video_queue_items set instagram_import_id = ${importId}, updated_at = now() where id = ${itemId} and processing_lock_token = ${lockToken}`;
}

export interface ImportedMediaPatch {
  blobUrl: string;
  blobPath: string;
  thumbnailUrl: string | null;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  hasAudio: boolean | null;
  facebookIncompatibleReason: string | null;
  /** Radar Viral (opcional): hash do arquivo, URL do original quando adaptado e aviso do processamento. */
  contentSha256?: string | null;
  originalBlobUrl?: string | null;
  statusMessage?: string | null;
}

export async function markItemReady(itemId: string, lockToken: string, media: ImportedMediaPatch): Promise<boolean> {
  const db = getDb();
  try {
    const rows = await db`
      update video_queue_items set
        status = 'READY', status_message = ${media.statusMessage ?? null}, error_code = null, next_attempt_at = null,
        content_sha256 = ${media.contentSha256 ?? null}, original_blob_url = ${media.originalBlobUrl ?? null},
        blob_url = ${media.blobUrl}, blob_path = ${media.blobPath}, thumbnail_url = ${media.thumbnailUrl},
        content_type = ${media.contentType}, file_size_bytes = ${media.fileSizeBytes}, duration_seconds = ${media.durationSeconds},
        width = ${media.width}, height = ${media.height}, video_codec = ${media.videoCodec}, has_audio = ${media.hasAudio},
        facebook_incompatible_reason = ${media.facebookIncompatibleReason},
        imported_at = now(), processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
      where id = ${itemId} and processing_lock_token = ${lockToken}
      returning id
    `;
    return rows.length > 0;
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
  }
  // Migração 0056 ainda não aplicada: grava como antes (sem hash/original).
  const rows = await db`
    update video_queue_items set
      status = 'READY', status_message = ${media.statusMessage ?? null}, error_code = null, next_attempt_at = null,
      blob_url = ${media.blobUrl}, blob_path = ${media.blobPath}, thumbnail_url = ${media.thumbnailUrl},
      content_type = ${media.contentType}, file_size_bytes = ${media.fileSizeBytes}, duration_seconds = ${media.durationSeconds},
      width = ${media.width}, height = ${media.height}, video_codec = ${media.videoCodec}, has_audio = ${media.hasAudio},
      facebook_incompatible_reason = ${media.facebookIncompatibleReason},
      imported_at = now(), processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${itemId} and processing_lock_token = ${lockToken}
    returning id
  `;
  return rows.length > 0;
}

/** Resultado sem sucesso: ERROR, WAITING_FILE (precisa do arquivo) ou PENDING com nova tentativa agendada. */
export async function markItemOutcome(
  itemId: string,
  lockToken: string,
  outcome: { status: "ERROR" | "WAITING_FILE" | "PENDING"; message: string; code: string; nextAttemptAt?: Date | null; resetAttempts?: boolean; clearInstagramImport?: boolean },
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set
      status = ${outcome.status}, status_message = ${outcome.message}, error_code = ${outcome.code},
      attempts_count = case when ${outcome.resetAttempts === true} then 0 else attempts_count end,
      instagram_import_id = case when ${outcome.clearInstagramImport === true} then null else instagram_import_id end,
      next_attempt_at = ${outcome.nextAttemptAt ? outcome.nextAttemptAt.toISOString() : null},
      processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${itemId} and processing_lock_token = ${lockToken}
    returning id
  `;
  return rows.length > 0;
}

/** Item que estourou as tentativas ao ser retomado (worker morreu várias vezes). */
export async function failItemWithoutLock(itemId: string, message: string, code: string): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set status = 'ERROR', status_message = ${message}, error_code = ${code},
      processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${itemId} and status in ('VALIDATING', 'IMPORTING', 'PROCESSING')
  `;
}

/** Arquivo enviado pelo usuário: o item volta para a fila de processamento como UPLOAD. */
export async function attachUploadToItem(itemId: string, userId: string, blobUrl: string, blobPath: string): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set
      source_kind = 'UPLOAD', status = 'PENDING', status_message = 'Arquivo enviado. Aguardando validação.', error_code = null,
      blob_url = ${blobUrl}, blob_path = ${blobPath}, attempts_count = 0, next_attempt_at = null, authorized_at = now(), updated_at = now()
    where id = ${itemId} and user_id = ${userId} and status in ('PENDING', 'WAITING_FILE', 'ERROR')
    returning *
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

/** "Reprocessar erros": só itens com ERROR (ou os ids informados) voltam a PENDENTE. */
export async function retryErroredItems(queueId: string, userId: string, itemIds: string[] | null): Promise<number> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set status = 'PENDING', status_message = null, error_code = null,
      attempts_count = 0, next_attempt_at = null, updated_at = now()
    where queue_id = ${queueId} and user_id = ${userId} and status = 'ERROR'
      and (${itemIds === null} or id = any(${itemIds ?? []}::uuid[]))
    returning id
  `;
  return rows.length;
}

export async function updateItemContent(
  itemId: string,
  userId: string,
  patch: { title: string | null; caption: string | null; facebookCaption: string | null },
): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set title = ${patch.title}, caption = ${patch.caption}, facebook_caption = ${patch.facebookCaption}, updated_at = now()
    where id = ${itemId} and user_id = ${userId} and status not in ('PUBLISHED', 'CANCELLED')
    returning *
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

/** Cancela um item que ainda não tem publicação (status fora do agendamento). */
export async function cancelUnscheduledItem(itemId: string, userId: string, message: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set status = 'CANCELLED', status_message = ${message}, next_attempt_at = null, updated_at = now()
    where id = ${itemId} and user_id = ${userId} and post_id is null
      and status in ('PENDING', 'READY', 'WAITING_FILE', 'ERROR')
    returning id
  `;
  return rows.length > 0;
}

export async function deleteItem(itemId: string, userId: string): Promise<VideoQueueItemRecord | null> {
  const db = getDb();
  const rows = await db`
    delete from video_queue_items
    where id = ${itemId} and user_id = ${userId}
      and status in ('PENDING', 'READY', 'WAITING_FILE', 'ERROR', 'CANCELLED') and post_id is null
    returning *
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

/** Reordenação: grava as posições na ordem recebida (ids de outra fila/usuário são ignorados). */
export async function reorderItems(queueId: string, userId: string, orderedIds: string[]): Promise<number> {
  const db = getDb();
  let updated = 0;
  for (let index = 0; index < orderedIds.length; index += 1) {
    const rows = await db`
      update video_queue_items set position = ${index + 1}, updated_at = now()
      where id = ${orderedIds[index]} and queue_id = ${queueId} and user_id = ${userId}
      returning id
    `;
    updated += rows.length;
  }
  return updated;
}

// ─────────────────────────── Planejamento ───────────────────────────

/** Horários já ocupados nas contas de destino (qualquer origem: manual, Piloto, outras filas). */
export async function listOccupiedSlots(input: {
  userId: string;
  queueId: string;
  instagramAccountId: string;
  includeInstagram: boolean;
  facebookPageIds: string[];
  from: Date;
}): Promise<Array<{ at: Date; own: boolean }>> {
  const db = getDb();
  const rows = await db`
    select p.scheduled_at_utc as at,
      exists (select 1 from video_queue_items i where i.id = p.video_queue_item_id and i.queue_id = ${input.queueId}) as own
    from instagram_posts p
    where p.user_id = ${input.userId}
      and p.scheduled_at_utc is not null and p.scheduled_at_utc >= ${input.from.toISOString()}
      and p.status in ('SCHEDULED', 'PROCESSING', 'PUBLISHED', 'NEEDS_REVIEW')
      and (
        (${input.includeInstagram} and p.instagram_account_id = ${input.instagramAccountId} and p.publish_to_instagram)
        or exists (
          select 1 from social_publication_destinations d
          where d.post_id = p.id and d.status not in ('CANCELLED', 'FAILED')
            and d.facebook_page_ref = any(${input.facebookPageIds}::uuid[])
        )
        or exists (select 1 from video_queue_items i where i.id = p.video_queue_item_id and i.queue_id = ${input.queueId})
      )
  `;
  return rows.map((row) => ({ at: new Date(row.at as string), own: Boolean(row.own) }));
}

/** Publicação não cancelada já criada para o item (reconciliação após falha no meio do planejamento). */
export async function findActivePostForItem(itemId: string): Promise<{ id: string; scheduledAtUtc: Date | null; status: string } | null> {
  const db = getDb();
  const rows = await db`
    select id, scheduled_at_utc, status from instagram_posts
    where video_queue_item_id = ${itemId} and status <> 'CANCELLED'
    limit 1
  `;
  return rows[0] ? { id: rows[0].id as string, scheduledAtUtc: toDate(rows[0].scheduled_at_utc), status: rows[0].status as string } : null;
}

export async function markItemScheduled(itemId: string, postId: string, scheduledAt: Date | null, facebookNote: string | null): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queue_items set status = 'SCHEDULED', post_id = ${postId},
      scheduled_at_utc = ${scheduledAt ? scheduledAt.toISOString() : null}, facebook_note = ${facebookNote},
      status_message = null, updated_at = now()
    where id = ${itemId} and status = 'READY'
    returning id
  `;
  return rows.length > 0;
}

export async function markItemPlanningError(itemId: string, message: string, code: string): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set status = 'ERROR', status_message = ${message}, error_code = ${code}, updated_at = now()
    where id = ${itemId} and status = 'READY'
  `;
}

/**
 * Cancela a publicação de um item que AINDA NÃO COMEÇOU: post SCHEDULED,
 * criado pela fila, com mais de 1 min de folga e sem nenhum destino já
 * enviado/em envio. Publicações em andamento ou concluídas nunca são tocadas.
 */
export async function cancelQueuePostIfUntouched(postId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update instagram_posts set status = 'CANCELLED', next_attempt_at = null, updated_at = now()
    where id = ${postId} and user_id = ${userId} and status = 'SCHEDULED'
      and video_queue_item_id is not null
      and scheduled_at_utc > now() + interval '1 minute'
      and not exists (
        select 1 from social_publication_destinations d
        where d.post_id = instagram_posts.id and d.status not in ('SCHEDULED', 'CANCELLED')
      )
    returning id
  `;
  if (rows.length === 0) return false;
  await db`
    update social_publication_destinations set status = 'CANCELLED', updated_at = now()
    where post_id = ${postId} and user_id = ${userId} and status = 'SCHEDULED'
  `;
  return true;
}

/** Depois de cancelar a publicação na replanificação/pausa: o vídeo volta a "Pronto". */
export async function resetItemToReady(itemId: string, postId: string): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set status = 'READY', post_id = null, scheduled_at_utc = null, facebook_note = null, updated_at = now()
    where id = ${itemId} and post_id = ${postId} and status = 'SCHEDULED'
  `;
}

export async function cancelScheduledItem(itemId: string, postId: string | null, message: string): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set status = 'CANCELLED', status_message = ${message}, updated_at = now()
    where id = ${itemId} and status = 'SCHEDULED'
      and ((${postId}::uuid is null and post_id is null) or post_id = ${postId}::uuid)
  `;
}

export interface ScheduledItemState {
  itemId: string;
  postId: string | null;
  postStatus: string | null;
  publishToInstagram: boolean;
  postPublishedAt: Date | null;
  destinationStatuses: string[];
}

/** Itens agendados com o estado atual da publicação e de cada destino Facebook. */
export async function listScheduledItemStates(queueId: string): Promise<ScheduledItemState[]> {
  const db = getDb();
  const rows = await db`
    select i.id as item_id, p.id as post_id, p.status as post_status, p.publish_to_instagram, p.published_at,
      coalesce((select array_agg(d.status) from social_publication_destinations d where d.post_id = p.id), '{}') as dest_statuses
    from video_queue_items i
    left join instagram_posts p on p.id = i.post_id
    where i.queue_id = ${queueId} and i.status = 'SCHEDULED'
  `;
  return rows.map((row) => ({
    itemId: row.item_id as string,
    postId: (row.post_id as string | null) ?? null,
    postStatus: (row.post_status as string | null) ?? null,
    publishToInstagram: row.publish_to_instagram !== false,
    postPublishedAt: toDate(row.published_at),
    destinationStatuses: Array.isArray(row.dest_statuses) ? (row.dest_statuses as string[]) : [],
  }));
}

export async function markItemPublished(itemId: string, publishedAt: Date | null): Promise<void> {
  const db = getDb();
  await db`
    update video_queue_items set status = 'PUBLISHED', published_at = coalesce(${publishedAt ? publishedAt.toISOString() : null}, now()), updated_at = now()
    where id = ${itemId} and status = 'SCHEDULED'
  `;
}

/** Publicações futuras da fila que ainda podem ser canceladas (pausa / replanejamento). */
export async function listFutureScheduledItems(queueId: string): Promise<Array<{ itemId: string; postId: string; userId: string }>> {
  const db = getDb();
  const rows = await db`
    select i.id as item_id, i.post_id, i.user_id from video_queue_items i
    join instagram_posts p on p.id = i.post_id
    where i.queue_id = ${queueId} and i.status = 'SCHEDULED' and p.status = 'SCHEDULED'
      and p.scheduled_at_utc > now() + interval '1 minute'
  `;
  return rows.map((row) => ({ itemId: row.item_id as string, postId: row.post_id as string, userId: row.user_id as string }));
}

// ───────────────────────────── Histórico ─────────────────────────────

export async function insertEvent(queueId: string, itemId: string | null, event: string, message: string | null = null): Promise<void> {
  const db = getDb();
  await db`
    insert into video_queue_events (queue_id, item_id, event, message)
    values (${queueId}, ${itemId}, ${event}, ${message ? message.slice(0, 500) : null})
  `;
}

export interface VideoQueueEventRecord {
  id: string;
  itemId: string | null;
  event: string;
  message: string | null;
  createdAt: Date;
}

export async function listEvents(queueId: string, userId: string, limit = 100): Promise<VideoQueueEventRecord[]> {
  const db = getDb();
  const rows = await db`
    select e.* from video_queue_events e
    join video_queues q on q.id = e.queue_id
    where e.queue_id = ${queueId} and q.user_id = ${userId}
    order by e.created_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    itemId: (row.item_id as string | null) ?? null,
    event: row.event as string,
    message: (row.message as string | null) ?? null,
    createdAt: toDate(row.created_at)!,
  }));
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db`select email from users where id = ${userId}`;
  return (rows[0]?.email as string | undefined) ?? null;
}

export interface QueuePostState {
  id: string;
  status: string;
  lastError: string | null;
  publishedAt: Date | null;
  scheduledAtUtc: Date | null;
  publishToInstagram: boolean;
}

/** Estado das publicações criadas pela fila (painel). */
export async function listPostsForQueue(queueId: string, userId: string): Promise<Map<string, QueuePostState>> {
  const db = getDb();
  const rows = await db`
    select p.id, p.status, p.last_error_sanitized, p.published_at, p.scheduled_at_utc, p.publish_to_instagram
    from instagram_posts p
    join video_queue_items i on i.post_id = p.id
    where i.queue_id = ${queueId} and p.user_id = ${userId}
  `;
  return new Map(
    rows.map((row) => [
      row.id as string,
      {
        id: row.id as string,
        status: row.status as string,
        lastError: (row.last_error_sanitized as string | null) ?? null,
        publishedAt: toDate(row.published_at),
        scheduledAtUtc: toDate(row.scheduled_at_utc),
        publishToInstagram: row.publish_to_instagram !== false,
      },
    ]),
  );
}

export async function archiveQueue(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update video_queues set status = 'ARCHIVED', updated_at = now()
    where id = ${id} and user_id = ${userId} and status <> 'ARCHIVED'
    returning id
  `;
  return rows.length > 0;
}
