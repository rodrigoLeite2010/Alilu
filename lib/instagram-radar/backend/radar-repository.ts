import "server-only";
import { getDb } from "@/lib/db/client";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import type { RadarScheduleConfig } from "@/lib/instagram-radar/schedule";

/**
 * SQL específico do Radar Instagram. O radar é uma linha de `video_queues`
 * com kind = 'INSTAGRAM_RADAR' — itens, eventos, importação e publicação
 * usam o repositório da Fila de vídeos (lib/video-queue/backend/queue-repository.ts).
 * Toda consulta disparada por usuário filtra por `user_id`.
 */

export const RADAR_KIND = "INSTAGRAM_RADAR";
export const RADAR_CATEGORY = "instagram-radar";
export const RADAR_THEME = "radar";

export type MissingCaptionPolicy = "DEFAULT" | "REVIEW";

export interface InsertRadarInput {
  userId: string;
  name: string;
  instagramAccountId: string;
  schedule: RadarScheduleConfig;
  captionTemplate: string;
  hashtags: string;
  missingCaptionPolicy: MissingCaptionPolicy;
  notReadyPolicy: "WAIT" | "NEXT_READY";
  rightsConfirmedAt: Date;
  /** Horários do dia (derivados de início + intervalo), guardados também em publish_times. */
  publishTimes: string[];
}

export async function insertRadar(input: InsertRadarInput): Promise<string> {
  const db = getDb();
  const s = input.schedule;
  const rows = await db`
    insert into video_queues (
      user_id, name, category, theme, kind, instagram_account_id, publish_to_instagram, facebook_page_ids,
      timezone, start_date, posts_per_day, publish_times, weekdays, min_interval_minutes, allow_same_slot,
      order_mode, not_ready_policy, materialize_ahead_hours, caption_template, facebook_caption_template,
      window_start, window_end, hashtags, missing_caption_policy, rights_confirmed_at
    ) values (
      ${input.userId}, ${input.name}, ${RADAR_CATEGORY}, ${RADAR_THEME}, ${RADAR_KIND}, ${input.instagramAccountId}, true, '{}'::uuid[],
      ${s.timezone}, ${s.startDate}, ${s.postsPerDay}, ${input.publishTimes}::text[], ${s.weekdays}::int[], ${s.intervalMinutes}, false,
      'POSITION', ${input.notReadyPolicy}, 48, ${input.captionTemplate}, null,
      ${s.windowStart}, ${s.windowEnd}, ${input.hashtags}, ${input.missingCaptionPolicy}, ${input.rightsConfirmedAt.toISOString()}
    )
    returning id
  `;
  return rows[0].id as string;
}

export interface UpdateRadarInput {
  name: string;
  schedule: RadarScheduleConfig;
  captionTemplate: string;
  hashtags: string;
  missingCaptionPolicy: MissingCaptionPolicy;
  notReadyPolicy: "WAIT" | "NEXT_READY";
  publishTimes: string[];
}

/** A conta Instagram do radar NUNCA é alterada aqui (outra conta = outro radar). */
export async function updateRadar(id: string, userId: string, input: UpdateRadarInput): Promise<boolean> {
  const db = getDb();
  const s = input.schedule;
  const rows = await db`
    update video_queues set
      name = ${input.name}, timezone = ${s.timezone}, start_date = ${s.startDate}, posts_per_day = ${s.postsPerDay},
      publish_times = ${input.publishTimes}::text[], weekdays = ${s.weekdays}::int[], min_interval_minutes = ${s.intervalMinutes},
      window_start = ${s.windowStart}, window_end = ${s.windowEnd}, not_ready_policy = ${input.notReadyPolicy},
      caption_template = ${input.captionTemplate}, hashtags = ${input.hashtags}, missing_caption_policy = ${input.missingCaptionPolicy},
      updated_at = now()
    where id = ${id} and user_id = ${userId} and kind = ${RADAR_KIND} and status <> 'ARCHIVED'
    returning id
  `;
  return rows.length > 0;
}

/** Limites diários dos radares ATIVOS de uma conta (para o teto combinado da conta). */
export async function listActiveRadarLimitsForAccount(userId: string, instagramAccountId: string): Promise<Array<{ id: string; name: string; postsPerDay: number }>> {
  const db = getDb();
  const rows = await db`
    select id, name, posts_per_day from video_queues
    where user_id = ${userId} and instagram_account_id = ${instagramAccountId} and kind = ${RADAR_KIND} and status = 'ACTIVE'
    order by created_at asc
  `;
  return rows.map((row) => ({ id: row.id as string, name: row.name as string, postsPerDay: Number(row.posts_per_day) }));
}

/** Outros radares (não arquivados) da mesma conta — avisos de coordenação na tela. */
export async function listRadarsForAccount(userId: string, instagramAccountId: string): Promise<Array<{ id: string; name: string; status: string; postsPerDay: number }>> {
  const db = getDb();
  const rows = await db`
    select id, name, status, posts_per_day from video_queues
    where user_id = ${userId} and instagram_account_id = ${instagramAccountId} and kind = ${RADAR_KIND} and status <> 'ARCHIVED'
    order by created_at asc
  `;
  return rows.map((row) => ({ id: row.id as string, name: row.name as string, status: row.status as string, postsPerDay: Number(row.posts_per_day) }));
}

/**
 * TODAS as publicações da conta Instagram (qualquer origem: outros radares,
 * filas de Games, Piloto, manuais) a partir de `from`. `own` = publicação deste radar.
 */
export async function listAccountOccupiedSlots(input: { userId: string; instagramAccountId: string; queueId: string; from: Date }): Promise<Array<{ at: Date; own: boolean }>> {
  const db = getDb();
  const rows = await db`
    select p.scheduled_at_utc as at,
      exists (select 1 from video_queue_items i where i.id = p.video_queue_item_id and i.queue_id = ${input.queueId}) as own
    from instagram_posts p
    where p.user_id = ${input.userId}
      and p.instagram_account_id = ${input.instagramAccountId}
      and p.publish_to_instagram
      and p.scheduled_at_utc is not null and p.scheduled_at_utc >= ${input.from.toISOString()}
      and p.status in ('SCHEDULED', 'PROCESSING', 'PUBLISHED', 'NEEDS_REVIEW')
  `;
  return rows.map((row) => ({ at: new Date(row.at as string), own: Boolean(row.own) }));
}

/**
 * Links (URL normalizada) já agendados/publicados ou em andamento NA MESMA
 * conta Instagram por OUTRA fila/radar do usuário — o mesmo vídeo não vai
 * duas vezes para a mesma conta.
 */
export async function findUrlsAlreadyOnAccount(userId: string, instagramAccountId: string, queueId: string, urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];
  const db = getDb();
  const rows = await db`
    select distinct i.normalized_url from video_queue_items i
    join video_queues q on q.id = i.queue_id
    where i.user_id = ${userId} and q.instagram_account_id = ${instagramAccountId} and q.id <> ${queueId}
      and i.status in ('PENDING', 'VALIDATING', 'IMPORTING', 'PROCESSING', 'READY', 'SCHEDULED', 'PUBLISHED')
      and i.normalized_url = any(${urls}::text[])
  `;
  return rows.map((row) => row.normalized_url as string);
}

/** Token cifrado e provedor de uma conta DO USUÁRIO (só para consultar o perfil na Meta; nunca sai do servidor). */
export async function getAccountCredentialsForProfile(accountId: string, userId: string): Promise<{ accessTokenEncrypted: string | null; authProvider: "instagram_login" | "facebook_login" } | null> {
  const db = getDb();
  const rows = await db`select access_token_encrypted, auth_provider from instagram_accounts where id = ${accountId} and user_id = ${userId}`;
  if (!rows[0]) return null;
  return {
    accessTokenEncrypted: (rows[0].access_token_encrypted as string | null) ?? null,
    authProvider: rows[0].auth_provider === "facebook_login" ? "facebook_login" : "instagram_login",
  };
}

// ───────────────────── Lock de agendamento por conta ─────────────────────

/**
 * Lock por conta Instagram (dois planejadores da mesma conta nunca rodam ao
 * mesmo tempo). Devolve `null` quando a migração 0059 ainda não foi aplicada
 * (filas de Games seguem como antes; radares não existem sem a migração).
 */
export async function acquireAccountScheduleLock(instagramAccountId: string, token: string, ttlSeconds: number): Promise<boolean | null> {
  const db = getDb();
  try {
    const rows = await db`
      insert into instagram_account_schedule_locks (instagram_account_id, lock_token, expires_at)
      values (${instagramAccountId}, ${token}, now() + (${ttlSeconds}::int * interval '1 second'))
      on conflict (instagram_account_id) do update
        set lock_token = excluded.lock_token, expires_at = excluded.expires_at, updated_at = now()
        where instagram_account_schedule_locks.expires_at < now()
      returning lock_token
    `;
    return rows.length > 0 && rows[0].lock_token === token;
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}

export async function releaseAccountScheduleLock(instagramAccountId: string, token: string): Promise<void> {
  const db = getDb();
  try {
    await db`delete from instagram_account_schedule_locks where instagram_account_id = ${instagramAccountId} and lock_token = ${token}`;
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
  }
}

// ───────────────────── Garantia de destino na publicação ─────────────────────

export interface QueueTargetForPost {
  kind: string;
  queueUserId: string;
  queueInstagramAccountId: string;
  facebookPageIds: string[];
}

/**
 * Fila/radar que originou a publicação (via video_queue_item_id). Usado
 * imediatamente antes da API da Meta para conferir que a conta da
 * publicação é EXATAMENTE a conta escolhida na fila/radar.
 */
export async function getQueueTargetForPost(postId: string): Promise<QueueTargetForPost | null> {
  const db = getDb();
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await db`
      select q.kind, q.user_id, q.instagram_account_id, q.facebook_page_ids
      from instagram_posts p
      join video_queue_items i on i.id = p.video_queue_item_id
      join video_queues q on q.id = i.queue_id
      where p.id = ${postId}
    `;
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    rows = await db`
      select 'VIDEO_QUEUE' as kind, q.user_id, q.instagram_account_id, q.facebook_page_ids
      from instagram_posts p
      join video_queue_items i on i.id = p.video_queue_item_id
      join video_queues q on q.id = i.queue_id
      where p.id = ${postId}
    `;
  }
  const row = rows[0];
  if (!row) return null;
  return {
    kind: (row.kind as string) ?? "VIDEO_QUEUE",
    queueUserId: row.user_id as string,
    queueInstagramAccountId: row.instagram_account_id as string,
    facebookPageIds: Array.isArray(row.facebook_page_ids) ? (row.facebook_page_ids as string[]) : [],
  };
}

/** true quando a publicação foi criada por um Radar Instagram (que nunca publica no Facebook). */
export async function isInstagramRadarPost(postId: string): Promise<boolean> {
  const target = await getQueueTargetForPost(postId);
  return target?.kind === RADAR_KIND;
}
