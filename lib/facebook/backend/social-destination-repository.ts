import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Destinos extras de uma publicação (social_publication_destinations) —
 * hoje, Páginas do Facebook. Cada destino tem status, tentativas, lock e
 * ids externos PRÓPRIOS: nada aqui escreve nas colunas do Instagram em
 * instagram_posts (exceto o espelho de status de uma publicação "somente
 * Facebook", em syncFacebookOnlyParentStatus), então uma falha no
 * Facebook nunca reabre/republica o Instagram — e vice-versa.
 *
 * Garantias de duplicidade (mesmo desenho do agendador do Instagram):
 *   - CLAIM ATÔMICO (UPDATE condicional / FOR UPDATE SKIP LOCKED) antes de
 *     qualquer chamada à Meta; toda escrita de resultado exige o lockToken;
 *   - um destino PUBLISHED nunca volta a ser elegível;
 *   - `request_started_at` marca um POST não idempotente sem resultado
 *     confirmado: a camada de publicação reconcilia antes de repetir.
 */

export type DestinationStatus = "SCHEDULED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";
export type DestinationPlatform = "facebook";

export interface DestinationSummary {
  id: string;
  postId: string;
  platform: DestinationPlatform;
  facebookPageRef: string | null;
  externalAccountId: string;
  accountName: string | null;
  captionOverride: string | null;
  status: DestinationStatus;
  externalPublicationId: string | null;
  externalPublicationUrl: string | null;
  attemptsCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  publishedAt: string | null;
  lastErrorSanitized: string | null;
  lastErrorReason: string | null;
}

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

function mapSummary(row: Record<string, unknown>): DestinationSummary {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    platform: row.platform as DestinationPlatform,
    facebookPageRef: (row.facebook_page_ref as string | null) ?? null,
    externalAccountId: row.external_account_id as string,
    accountName: (row.account_name as string | null) ?? null,
    captionOverride: (row.caption_override as string | null) ?? null,
    status: row.status as DestinationStatus,
    externalPublicationId: (row.external_publication_id as string | null) ?? null,
    externalPublicationUrl: (row.external_publication_url as string | null) ?? null,
    attemptsCount: Number(row.attempts_count ?? 0),
    lastAttemptAt: iso(row.last_attempt_at),
    nextAttemptAt: iso(row.next_attempt_at),
    publishedAt: iso(row.published_at),
    lastErrorSanitized: (row.last_error_sanitized as string | null) ?? null,
    lastErrorReason: (row.last_error_reason as string | null) ?? null,
  };
}

export interface FacebookDestinationInput {
  facebookPageRef: string;
  pageId: string;
  pageName: string;
}

/**
 * Define os destinos Facebook de uma publicação (criação ou edição).
 * - páginas novas: inseridas como SCHEDULED;
 * - páginas mantidas: atualiza a legenda; FAILED/CANCELLED voltam a SCHEDULED;
 * - páginas removidas: apagadas SOMENTE se nunca enviaram nada à Meta
 *   (SCHEDULED/FAILED/CANCELLED sem POST pendente). PUBLISHED, PROCESSING e
 *   NEEDS_REVIEW nunca são apagados — o histórico real é preservado.
 */
export async function setFacebookDestinations(
  postId: string,
  userId: string,
  pages: FacebookDestinationInput[],
  captionOverride: string | null,
): Promise<void> {
  const db = getDb();
  const keep = new Set(pages.map((page) => page.pageId));
  const existing = await db`
    select id, external_account_id, status, request_started_at from social_publication_destinations
    where post_id = ${postId} and user_id = ${userId} and platform = 'facebook'
  `;
  for (const row of existing) {
    if (keep.has(row.external_account_id as string)) continue;
    if (["SCHEDULED", "FAILED", "CANCELLED"].includes(row.status as string) && !row.request_started_at) {
      await db`delete from social_publication_destinations where id = ${row.id as string} and user_id = ${userId}
        and status in ('SCHEDULED', 'FAILED', 'CANCELLED') and request_started_at is null`;
    } else if (row.status === "SCHEDULED" || row.status === "FAILED") {
      await db`update social_publication_destinations set status = 'CANCELLED', next_attempt_at = null, release_at = null, updated_at = now()
        where id = ${row.id as string} and user_id = ${userId} and status in ('SCHEDULED', 'FAILED')`;
    }
  }
  const caption = captionOverride && captionOverride.trim() ? captionOverride : null;
  for (const page of pages) {
    await db`
      insert into social_publication_destinations (post_id, user_id, platform, facebook_page_ref, external_account_id, account_name, caption_override)
      values (${postId}, ${userId}, 'facebook', ${page.facebookPageRef}, ${page.pageId}, ${page.pageName}, ${caption})
      on conflict (post_id, platform, external_account_id) do update set
        caption_override = excluded.caption_override,
        facebook_page_ref = excluded.facebook_page_ref,
        account_name = excluded.account_name,
        status = case when social_publication_destinations.status in ('FAILED', 'CANCELLED') then 'SCHEDULED' else social_publication_destinations.status end,
        attempts_count = case when social_publication_destinations.status in ('FAILED', 'CANCELLED') then 0 else social_publication_destinations.attempts_count end,
        next_attempt_at = case when social_publication_destinations.status in ('FAILED', 'CANCELLED') then null else social_publication_destinations.next_attempt_at end,
        updated_at = now()
      where social_publication_destinations.user_id = excluded.user_id
    `;
  }
}

/**
 * Acrescenta destinos Facebook a uma publicação SEM tocar nos existentes
 * (usado pelo Piloto Automático ao criar a publicação). Idempotente: a
 * constraint única (post_id, platform, external_account_id) + "do nothing"
 * garante que uma nova execução/retry nunca cria um segundo destino — e,
 * portanto, nunca uma segunda publicação na mesma Página. Devolve quantos
 * destinos foram realmente criados.
 */
export async function addFacebookDestinationsIfMissing(
  postId: string,
  userId: string,
  pages: FacebookDestinationInput[],
  captionOverride: string | null = null,
): Promise<number> {
  const db = getDb();
  const caption = captionOverride && captionOverride.trim() ? captionOverride : null;
  let created = 0;
  for (const page of pages) {
    const rows = await db`
      insert into social_publication_destinations (post_id, user_id, platform, facebook_page_ref, external_account_id, account_name, caption_override)
      select ${postId}, ${userId}, 'facebook', ${page.facebookPageRef}, ${page.pageId}, ${page.pageName}, ${caption}
      where exists (select 1 from instagram_posts p where p.id = ${postId} and p.user_id = ${userId})
      on conflict (post_id, platform, external_account_id) do nothing
      returning id
    `;
    created += rows.length;
  }
  return created;
}

/** Depois de editar/reagendar a publicação: falhas voltam a SCHEDULED e "publicar agora" anterior é esquecido. */
export async function resetFacebookDestinationsAfterEdit(postId: string, userId: string): Promise<void> {
  const db = getDb();
  await db`
    update social_publication_destinations
    set status = case when status = 'FAILED' then 'SCHEDULED' else status end,
        attempts_count = case when status = 'FAILED' then 0 else attempts_count end,
        last_error_sanitized = case when status = 'FAILED' then null else last_error_sanitized end,
        last_error_reason = case when status = 'FAILED' then null else last_error_reason end,
        -- Fotos/Reel ainda não publicados são descartados: a mídia pode ter mudado.
        external_children_ids = case when status = 'FAILED' then null else external_children_ids end,
        -- Um destino FAILED nunca foi publicado (resultado incerto vira NEEDS_REVIEW).
        external_upload_id = case when status = 'FAILED' then null else external_upload_id end,
        phase = case when status = 'FAILED' then null else phase end,
        next_attempt_at = null, release_at = null, updated_at = now()
    where post_id = ${postId} and user_id = ${userId} and status in ('SCHEDULED', 'FAILED')
  `;
}

export async function cancelFacebookDestinations(postId: string, userId: string): Promise<void> {
  const db = getDb();
  await db`
    update social_publication_destinations set status = 'CANCELLED', next_attempt_at = null, release_at = null, updated_at = now()
    where post_id = ${postId} and user_id = ${userId} and status in ('SCHEDULED', 'FAILED')
  `;
}

export async function hasProcessingDestination(postId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    select 1 from social_publication_destinations
    where post_id = ${postId} and user_id = ${userId} and status = 'PROCESSING' limit 1
  `;
  return rows.length > 0;
}

export async function listDestinationsForUser(userId: string, postIds?: string[]): Promise<DestinationSummary[]> {
  const db = getDb();
  const rows = await db`
    select * from social_publication_destinations where user_id = ${userId}
      and post_id in (
        select id from instagram_posts where user_id = ${userId}
        order by coalesce(scheduled_at_utc, created_at) desc limit 200
      )
    order by created_at asc
  `;
  const filter = postIds ? new Set(postIds) : null;
  return rows.map(mapSummary).filter((row) => !filter || filter.has(row.postId));
}

export async function listDestinationsForPost(postId: string, userId: string): Promise<DestinationSummary[]> {
  const db = getDb();
  const rows = await db`
    select * from social_publication_destinations where post_id = ${postId} and user_id = ${userId}
    order by created_at asc
  `;
  return rows.map(mapSummary);
}

export async function getDestinationForUser(id: string, userId: string): Promise<DestinationSummary | null> {
  const db = getDb();
  const rows = await db`select * from social_publication_destinations where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapSummary(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Claim / lock
// ---------------------------------------------------------------------------

export interface ClaimedDestination {
  id: string;
  postId: string;
  userId: string;
  attemptsCount: number;
  processingStartedAt: string | null;
}

function mapClaimed(row: Record<string, unknown>): ClaimedDestination {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    userId: row.user_id as string,
    attemptsCount: Number(row.attempts_count ?? 0),
    processingStartedAt: iso(row.processing_started_at),
  };
}

/**
 * CLAIM do agendador: próximo destino vencido. Vencido =
 *   (a) SCHEDULED, publicação não cancelada, e: liberado manualmente
 *       (release_at) OU o horário agendado chegou com a publicação fora de
 *       rascunho; respeitando next_attempt_at (backoff/retomada);
 *   (b) PROCESSING sem dono (worker morreu / Reel aguardando a Meta).
 * FOR UPDATE SKIP LOCKED: dois workers nunca pegam o mesmo destino.
 */
export async function claimNextDueDestination(lockToken: string, lockTtlSeconds: number): Promise<ClaimedDestination | null> {
  const db = getDb();
  const rows = await db`
    update social_publication_destinations d
    set status = 'PROCESSING',
        processing_started_at = case when d.status = 'SCHEDULED' then now() else coalesce(d.processing_started_at, now()) end,
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        last_attempt_at = now(), updated_at = now()
    where d.id = (
      select c.id from social_publication_destinations c
      join instagram_posts p on p.id = c.post_id and p.user_id = c.user_id
      where (
          (c.status = 'SCHEDULED' and p.status <> 'CANCELLED' and (
            c.release_at is not null
            or (p.scheduled_at_utc is not null and p.scheduled_at_utc <= now() and p.status <> 'DRAFT')
          ))
          or (c.status = 'PROCESSING' and (c.processing_lock_token is null or c.processing_lock_expires_at < now()))
        )
        and (c.next_attempt_at is null or c.next_attempt_at <= now())
      order by coalesce(c.next_attempt_at, p.scheduled_at_utc, c.updated_at) asc
      limit 1
      for update of c skip locked
    )
    and (
      d.status = 'SCHEDULED'
      or (d.status = 'PROCESSING' and (d.processing_lock_token is null or d.processing_lock_expires_at < now()))
    )
    and (d.next_attempt_at is null or d.next_attempt_at <= now())
    returning d.id, d.post_id, d.user_id, d.attempts_count, d.processing_started_at
  `;
  return rows[0] ? mapClaimed(rows[0]) : null;
}

/**
 * CLAIM manual ("Publicar agora" / "Tentar novamente"): SCHEDULED, FAILED,
 * NEEDS_REVIEW ou PROCESSING sem dono. Nunca PUBLISHED/CANCELLED. A partir
 * de FAILED/NEEDS_REVIEW o contador de tentativas volta a zero; ids
 * externos e request_started_at são PRESERVADOS (reconciliação antes de
 * repetir qualquer POST).
 */
export async function claimDestinationForManualPublish(
  destinationId: string,
  userId: string,
  lockToken: string,
  lockTtlSeconds: number,
): Promise<ClaimedDestination | null> {
  const db = getDb();
  const rows = await db`
    update social_publication_destinations
    set status = 'PROCESSING',
        attempts_count = case when status in ('FAILED', 'NEEDS_REVIEW') then 0 else attempts_count end,
        -- Reel que FALHOU na Meta (nunca publicado): recomeça com um novo envio.
        -- NEEDS_REVIEW mantém o video_id para conferir o estado antes.
        phase = case when status = 'FAILED' and external_upload_id is not null then null else phase end,
        external_upload_id = case when status = 'FAILED' then null else external_upload_id end,
        processing_started_at = case when status = 'PROCESSING' then coalesce(processing_started_at, now()) else now() end,
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        release_at = coalesce(release_at, now()),
        last_attempt_at = now(), next_attempt_at = null, updated_at = now()
    where id = ${destinationId} and user_id = ${userId}
      and (
        status in ('SCHEDULED', 'FAILED', 'NEEDS_REVIEW')
        or (status = 'PROCESSING' and (processing_lock_token is null or processing_lock_expires_at < now()))
      )
      and exists (select 1 from instagram_posts p where p.id = post_id and p.user_id = ${userId} and p.status <> 'CANCELLED')
    returning id, post_id, user_id, attempts_count, processing_started_at
  `;
  return rows[0] ? mapClaimed(rows[0]) : null;
}

export interface DestinationForPublish {
  id: string;
  postId: string;
  userId: string;
  status: DestinationStatus;
  phase: string | null;
  externalUploadId: string | null;
  externalChildrenIds: string[] | null;
  externalPublicationId: string | null;
  requestStartedAt: Date | null;
  pageRef: string | null;
  pageId: string;
  pageStatus: string | null;
  pageTokenEncrypted: string | null;
  caption: string;
  postType: "image" | "carousel" | "reels" | "story";
  items: Array<{ mediaId: string; storageUrl: string; mediaType: "image" | "video"; position: number; fileSizeBytes: number | null; width: number | null; height: number | null; durationSeconds: number | null }>;
}

/**
 * Tudo que a publicação no Facebook precisa, numa consulta. A Página é
 * juntada exigindo o MESMO user_id do destino e da publicação — um destino
 * nunca usa a Página (nem o token) de outro usuário.
 */
export async function getDestinationForPublish(destinationId: string, userId: string): Promise<DestinationForPublish | null> {
  const db = getDb();
  const rows = await db`
    select d.id, d.post_id, d.user_id, d.status, d.phase, d.external_upload_id, d.external_children_ids,
      d.external_publication_id, d.request_started_at, d.facebook_page_ref, d.external_account_id, d.caption_override,
      fp.status as page_status, fp.page_access_token_encrypted, fp.page_id as fp_page_id,
      p.caption, p.post_type,
      pi.media_id, pi.position, m.storage_url, m.media_type, m.file_size_bytes, m.width, m.height, m.duration_seconds
    from social_publication_destinations d
    join instagram_posts p on p.id = d.post_id and p.user_id = d.user_id
    left join facebook_pages fp on fp.id = d.facebook_page_ref and fp.user_id = d.user_id
    left join instagram_post_items pi on pi.post_id = p.id
    left join instagram_media m on m.id = pi.media_id and m.user_id = p.user_id
    where d.id = ${destinationId} and d.user_id = ${userId}
    order by pi.position asc
  `;
  const first = rows[0];
  if (!first) return null;
  const override = (first.caption_override as string | null) ?? null;
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    id: first.id as string,
    postId: first.post_id as string,
    userId: first.user_id as string,
    status: first.status as DestinationStatus,
    phase: (first.phase as string | null) ?? null,
    externalUploadId: (first.external_upload_id as string | null) ?? null,
    externalChildrenIds: Array.isArray(first.external_children_ids) && first.external_children_ids.length ? (first.external_children_ids as string[]) : null,
    externalPublicationId: (first.external_publication_id as string | null) ?? null,
    requestStartedAt: first.request_started_at ? new Date(first.request_started_at as string) : null,
    pageRef: (first.facebook_page_ref as string | null) ?? null,
    // Página conferida pelo id externo gravado no destino: se a linha da
    // Página não bater, o destino é tratado como desconectado.
    pageId: first.external_account_id as string,
    pageStatus: first.fp_page_id === first.external_account_id ? ((first.page_status as string | null) ?? null) : null,
    pageTokenEncrypted: first.fp_page_id === first.external_account_id ? ((first.page_access_token_encrypted as string | null) ?? null) : null,
    caption: override && override.trim() ? override : ((first.caption as string) ?? ""),
    postType: first.post_type as DestinationForPublish["postType"],
    items: rows
      .filter((row) => row.media_id && row.storage_url)
      .map((row) => ({
        mediaId: row.media_id as string,
        storageUrl: row.storage_url as string,
        mediaType: row.media_type as "image" | "video",
        position: Number(row.position),
        fileSizeBytes: num(row.file_size_bytes),
        width: num(row.width),
        height: num(row.height),
        durationSeconds: num(row.duration_seconds),
      })),
  };
}

function toTextArray(values: string[]): string {
  return `{${values.map((id) => `"${id.replace(/["\\]/g, "")}"`).join(",")}}`;
}

export async function saveDestinationProgress(
  id: string,
  lockToken: string,
  patch: { phase?: string | null; externalUploadId?: string | null; externalChildrenIds?: string[] | null },
): Promise<void> {
  const db = getDb();
  const children = patch.externalChildrenIds === undefined ? undefined : patch.externalChildrenIds ? toTextArray(patch.externalChildrenIds) : null;
  await db`
    update social_publication_destinations set
      phase = case when ${patch.phase !== undefined} then ${patch.phase ?? null} else phase end,
      external_upload_id = case when ${patch.externalUploadId !== undefined} then ${patch.externalUploadId ?? null} else external_upload_id end,
      external_children_ids = case when ${children !== undefined} then ${children ?? null}::text[] else external_children_ids end,
      updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}
  `;
}

/** Marca, ANTES de enviar, que um POST não idempotente vai sair. */
export async function markDestinationRequestStarted(id: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db`update social_publication_destinations set request_started_at = now(), updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}`;
}

export async function clearDestinationRequestStarted(id: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db`update social_publication_destinations set request_started_at = null, updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}`;
}

export async function markDestinationPublished(id: string, lockToken: string, externalId: string, externalUrl: string | null): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update social_publication_destinations
    set status = 'PUBLISHED', external_publication_id = ${externalId}, external_publication_url = ${externalUrl},
        published_at = now(), request_started_at = null, last_error_sanitized = null, last_error_reason = null,
        next_attempt_at = null, release_at = null, processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}
    returning id
  `;
  return rows.length > 0;
}

export async function markDestinationFailed(id: string, lockToken: string, message: string, reason: string, status: "FAILED" | "NEEDS_REVIEW" = "FAILED"): Promise<void> {
  const db = getDb();
  await db`
    update social_publication_destinations
    set status = ${status}, last_error_sanitized = ${message}, last_error_reason = ${reason},
        attempts_count = attempts_count + 1, next_attempt_at = null, release_at = null,
        processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}
  `;
}

/** Falha temporária: volta a SCHEDULED com backoff, mantendo ids externos e o marcador de POST pendente. */
export async function scheduleDestinationRetry(id: string, lockToken: string, message: string, reason: string, nextAttemptAt: Date): Promise<void> {
  const db = getDb();
  await db`
    update social_publication_destinations
    set status = 'SCHEDULED', last_error_sanitized = ${message}, last_error_reason = ${reason},
        attempts_count = attempts_count + 1, next_attempt_at = ${nextAttemptAt.toISOString()},
        release_at = coalesce(release_at, now()),
        processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken}
  `;
}

/** Ainda aguardando a Meta (Reel processando / reconciliação): mantém PROCESSING e libera o lock. */
export async function releaseDestinationForResume(id: string, lockToken: string, nextAttemptAt: Date): Promise<void> {
  const db = getDb();
  await db`
    update social_publication_destinations
    set next_attempt_at = ${nextAttemptAt.toISOString()}, processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${id} and processing_lock_token = ${lockToken} and status = 'PROCESSING'
  `;
}

export async function getDestinationStatus(id: string, userId: string): Promise<DestinationStatus | null> {
  const db = getDb();
  const rows = await db`select status from social_publication_destinations where id = ${id} and user_id = ${userId}`;
  return rows[0] ? (rows[0].status as DestinationStatus) : null;
}

export async function recordDestinationAttempt(input: {
  destinationId: string;
  trigger: string;
  outcome: "success" | "failure" | "pending" | "reconciled";
  errorSanitized?: string | null;
  errorReason?: string | null;
  metaCode?: number | null;
  externalId?: string | null;
}): Promise<void> {
  const db = getDb();
  await db`
    insert into social_publication_attempts (destination_id, trigger, outcome, error_sanitized, error_reason, meta_code, external_id)
    values (${input.destinationId}, ${input.trigger}, ${input.outcome}, ${input.errorSanitized ?? null},
      ${input.errorReason ?? null}, ${input.metaCode ?? null}, ${input.externalId ?? null})
  `;
}

export interface DestinationAttempt {
  attemptedAt: string;
  trigger: string | null;
  outcome: string;
  errorSanitized: string | null;
  errorReason: string | null;
}

export async function listDestinationAttempts(destinationId: string, userId: string, limit = 20): Promise<DestinationAttempt[]> {
  const db = getDb();
  const rows = await db`
    select a.attempted_at, a.trigger, a.outcome, a.error_sanitized, a.error_reason
    from social_publication_attempts a
    join social_publication_destinations d on d.id = a.destination_id
    where a.destination_id = ${destinationId} and d.user_id = ${userId}
    order by a.attempted_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    attemptedAt: new Date(row.attempted_at as string).toISOString(),
    trigger: (row.trigger as string | null) ?? null,
    outcome: row.outcome as string,
    errorSanitized: (row.error_sanitized as string | null) ?? null,
    errorReason: (row.error_reason as string | null) ?? null,
  }));
}

/**
 * Publicação "somente Facebook" (publish_to_instagram = false): o status
 * de instagram_posts espelha o dos destinos, para as telas existentes
 * (lista, edição, cancelamento) continuarem funcionando sem mudança.
 * Para publicações com Instagram, NÃO faz nada — o status do post é o do
 * Instagram e nunca é tocado pelo Facebook.
 */
export async function syncFacebookOnlyParentStatus(postId: string): Promise<void> {
  const db = getDb();
  const parent = await db`select status, publish_to_instagram from instagram_posts where id = ${postId}`;
  if (!parent[0] || parent[0].publish_to_instagram !== false || parent[0].status === "CANCELLED") return;
  const dests = await db`select status, last_error_sanitized from social_publication_destinations
    where post_id = ${postId} and status <> 'CANCELLED'`;
  if (dests.length === 0) return;
  const statuses = dests.map((row) => row.status as DestinationStatus);
  let next: string | null = null;
  if (statuses.includes("PROCESSING")) next = "PROCESSING";
  else if (statuses.includes("SCHEDULED")) next = null; // aguardando: mantém o status atual (DRAFT/SCHEDULED)
  else if (statuses.every((status) => status === "PUBLISHED")) next = "PUBLISHED";
  else if (statuses.includes("NEEDS_REVIEW") && !statuses.includes("FAILED")) next = "NEEDS_REVIEW";
  else next = "FAILED";
  if (!next) {
    // Um retry automático pendente após PROCESSING: volta para SCHEDULED para as telas.
    if (parent[0].status === "PROCESSING") {
      await db`update instagram_posts set status = case when scheduled_at_utc is null then 'DRAFT' else 'SCHEDULED' end, updated_at = now()
        where id = ${postId} and publish_to_instagram = false and status = 'PROCESSING'`;
    }
    return;
  }
  const error = next === "FAILED" || next === "NEEDS_REVIEW"
    ? ((dests.find((row) => row.status === "FAILED" || row.status === "NEEDS_REVIEW")?.last_error_sanitized as string | null) ?? null)
    : null;
  await db`
    update instagram_posts
    set status = ${next},
        published_at = case when ${next} = 'PUBLISHED' then coalesce(published_at, now()) else published_at end,
        last_error_sanitized = ${error}, updated_at = now()
    where id = ${postId} and publish_to_instagram = false and status <> 'CANCELLED'
  `;
}
