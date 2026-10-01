import "server-only";
import { getDb } from "@/lib/db/client";
import type { AiVideoAspectRatio, AiVideoGenerationStatus, AiVideoTier } from "../types";
import type { AiVideoOverlay } from "../overlays";

/** Status em que a geração ainda está andando (cron/tela avançam). */
const ACTIVE_STATUSES = "CREDIT_RESERVED,SUBMITTED,QUEUED,PROCESSING,AI_COMPLETED,POST_PROCESSING";

/** Acesso a ai_video_generations — sempre restrito ao dono nas leituras do usuário. */

export interface AiVideoGenerationRecord {
  id: string;
  userId: string;
  idempotencyKey: string;
  tier: AiVideoTier;
  provider: string;
  providerModel: string;
  prompt: string;
  inputImageUrl: string;
  durationSeconds: number;
  aspectRatio: AiVideoAspectRatio;
  resolution: string;
  creditCost: number;
  status: AiVideoGenerationStatus;
  externalTaskId: string | null;
  providerEstimatedCostUsd: number;
  providerActualCostUsd: number | null;
  providerCharged: boolean;
  exchangeRateReference: number;
  estimatedCostBrl: number;
  revenueAllocatedBrl: number;
  grossProfitBrl: number | null;
  storageVideoUrl: string | null;
  /** URL temporária do provedor (só preenchida quando o vídeo ficou pronto). */
  outputVideoUrl: string | null;
  errorKind: "USER_ERROR" | "TECHNICAL_ERROR" | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  nextCheckAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  submittedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  /** Textos/logos aplicados depois da IA (pós-processamento). */
  preserveText: boolean;
  overlays: AiVideoOverlay[];
  parentGenerationId: string | null;
  pricingKind: "FULL" | "RETRY_DISCOUNT";
  /** Preço cheio de referência (na regeneração com desconto, creditCost < listCreditCost). */
  listCreditCost: number | null;
  postprocessAttempts: number;
  userFeedback: "LIKED" | null;
}

const date = (value: unknown) => (value ? new Date(value as string) : null);
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function mapGeneration(row: Record<string, unknown>): AiVideoGenerationRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    idempotencyKey: row.idempotency_key as string,
    tier: row.tier as AiVideoTier,
    provider: row.provider as string,
    providerModel: row.provider_model as string,
    prompt: row.prompt as string,
    inputImageUrl: row.input_image_url as string,
    durationSeconds: Number(row.duration_seconds),
    aspectRatio: row.aspect_ratio as AiVideoAspectRatio,
    resolution: row.resolution as string,
    creditCost: Number(row.credit_cost),
    status: row.status as AiVideoGenerationStatus,
    externalTaskId: (row.external_task_id as string | null) ?? null,
    providerEstimatedCostUsd: Number(row.provider_estimated_cost_usd),
    providerActualCostUsd: numOrNull(row.provider_actual_cost_usd),
    providerCharged: Boolean(row.provider_charged),
    exchangeRateReference: Number(row.exchange_rate_reference),
    estimatedCostBrl: Number(row.estimated_cost_brl),
    revenueAllocatedBrl: Number(row.revenue_allocated_brl),
    grossProfitBrl: numOrNull(row.gross_profit_brl),
    storageVideoUrl: (row.storage_video_url as string | null) ?? null,
    outputVideoUrl: (row.output_video_url as string | null) ?? null,
    errorKind: (row.error_kind as "USER_ERROR" | "TECHNICAL_ERROR" | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    attempts: Number(row.attempts ?? 0),
    nextCheckAt: date(row.next_check_at),
    expiresAt: date(row.expires_at),
    createdAt: new Date(row.created_at as string),
    submittedAt: date(row.submitted_at),
    startedAt: date(row.started_at),
    completedAt: date(row.completed_at),
    preserveText: Boolean(row.preserve_text),
    overlays: parseJsonArray<AiVideoOverlay>(row.overlays),
    parentGenerationId: (row.parent_generation_id as string | null) ?? null,
    pricingKind: row.pricing_kind === "RETRY_DISCOUNT" ? "RETRY_DISCOUNT" : "FULL",
    listCreditCost: numOrNull(row.list_credit_cost),
    postprocessAttempts: Number(row.postprocess_attempts ?? 0),
    userFeedback: row.user_feedback === "LIKED" ? "LIKED" : null,
  };
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export interface InsertGenerationInput {
  userId: string;
  idempotencyKey: string;
  tier: AiVideoTier;
  provider: string;
  providerModel: string;
  prompt: string;
  inputImageUrl: string;
  durationSeconds: number;
  aspectRatio: AiVideoAspectRatio;
  resolution: string;
  creditCost: number;
  status: Extract<AiVideoGenerationStatus, "CREATED" | "PRICE_GUARD_BLOCKED">;
  providerEstimatedCostUsd: number;
  exchangeRateReference: number;
  estimatedCostBrl: number;
  revenueAllocatedBrl: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  preserveText?: boolean;
  overlays?: AiVideoOverlay[];
  parentGenerationId?: string | null;
  pricingKind?: "FULL" | "RETRY_DISCOUNT";
  listCreditCost?: number | null;
}

/** Insere a geração — idempotente por (user_id, idempotency_key): devolve `created: false` com a linha que já existia. */
export async function insertGenerationOnce(input: InsertGenerationInput): Promise<{ created: boolean; generation: AiVideoGenerationRecord }> {
  const db = getDb();
  const rows = await db`
    insert into ai_video_generations (
      user_id, idempotency_key, tier, provider, provider_model, prompt, input_image_url, duration_seconds,
      aspect_ratio, resolution, credit_cost, status, provider_estimated_cost_usd, exchange_rate_reference,
      estimated_cost_brl, revenue_allocated_brl, error_code, error_message,
      preserve_text, overlays, parent_generation_id, pricing_kind, list_credit_cost
    ) values (
      ${input.userId}, ${input.idempotencyKey}, ${input.tier}, ${input.provider}, ${input.providerModel}, ${input.prompt},
      ${input.inputImageUrl}, ${input.durationSeconds}, ${input.aspectRatio}, ${input.resolution}, ${input.creditCost},
      ${input.status}, ${input.providerEstimatedCostUsd}, ${input.exchangeRateReference}, ${input.estimatedCostBrl},
      ${input.revenueAllocatedBrl}, ${input.errorCode ?? null}, ${input.errorMessage ?? null},
      ${input.preserveText ?? false}, ${JSON.stringify(input.overlays ?? [])}::jsonb, ${input.parentGenerationId ?? null},
      ${input.pricingKind ?? "FULL"}, ${input.listCreditCost ?? null}
    )
    on conflict (user_id, idempotency_key) do nothing
    returning *
  `;
  if (rows[0]) return { created: true, generation: mapGeneration(rows[0]) };
  const existing = await findGenerationByIdempotencyKey(input.userId, input.idempotencyKey);
  return { created: false, generation: existing! };
}

export async function findGenerationByIdempotencyKey(userId: string, key: string): Promise<AiVideoGenerationRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_video_generations where user_id = ${userId} and idempotency_key = ${key}`;
  return rows[0] ? mapGeneration(rows[0]) : null;
}

export async function deleteGeneration(id: string): Promise<void> {
  const db = getDb();
  await db`delete from ai_video_generations where id = ${id} and status = 'CREATED'`;
}

export async function getGenerationById(id: string): Promise<AiVideoGenerationRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_video_generations where id = ${id}`;
  return rows[0] ? mapGeneration(rows[0]) : null;
}

export async function getGenerationForUser(id: string, userId: string): Promise<AiVideoGenerationRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_video_generations where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapGeneration(rows[0]) : null;
}

export async function listGenerationsForUser(userId: string, limit = 20): Promise<AiVideoGenerationRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from ai_video_generations where user_id = ${userId} and status <> 'PRICE_GUARD_BLOCKED'
    order by created_at desc limit ${limit}
  `;
  return rows.map(mapGeneration);
}

export async function countGenerationsSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from ai_video_generations
    where user_id = ${userId} and created_at >= ${since.toISOString()} and status <> 'PRICE_GUARD_BLOCKED'
  `;
  return Number(rows[0]?.total ?? 0);
}

/** Quantas gerações do usuário estão em andamento agora (reservadas → finalizando). */
export async function countActiveGenerations(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from ai_video_generations
    where user_id = ${userId} and status = any(string_to_array(${ACTIVE_STATUSES}, ','))
  `;
  return Number(rows[0]?.total ?? 0);
}

export async function countModerationFailuresSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from ai_video_generations
    where user_id = ${userId} and created_at >= ${since.toISOString()} and error_code = 'MODERATION'
  `;
  return Number(rows[0]?.total ?? 0);
}

/** Gasto estimado com o provedor desde `since` — gerações enviadas, em andamento, concluídas ou falhas cobradas. */
export async function sumProviderSpendUsdSince(since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select coalesce(sum(coalesce(provider_actual_cost_usd, provider_estimated_cost_usd)), 0) as total
    from ai_video_generations
    where created_at >= ${since.toISOString()}
      and (status = any(string_to_array(${ACTIVE_STATUSES + ",COMPLETED,EXPIRED"}, ',')) or provider_charged)
  `;
  return Number(rows[0]?.total ?? 0);
}

export const GENERATION_LOCK_TTL_SECONDS = 4 * 60;

/** Claim atômico de UMA geração para avançá-la (cron ou consulta da tela) — nunca processada por dois ao mesmo tempo. */
export async function claimGeneration(id: string, lockToken: string, now: Date): Promise<AiVideoGenerationRecord | null> {
  const db = getDb();
  const rows = await db`
    update ai_video_generations
    set processing_lock_token = ${lockToken},
        processing_lock_expires_at = ${new Date(now.getTime() + GENERATION_LOCK_TTL_SECONDS * 1000).toISOString()}
    where id = (
      select id from ai_video_generations
      where id = ${id}
        and status = any(string_to_array(${ACTIVE_STATUSES}, ','))
        and (next_check_at is null or next_check_at <= ${now.toISOString()})
        and (processing_lock_token is null or processing_lock_expires_at < ${now.toISOString()})
      for update skip locked
    )
    returning *
  `;
  return rows[0] ? mapGeneration(rows[0]) : null;
}

/** Ids das gerações em andamento prontas para consulta (cron). */
export async function listDueGenerationIds(now: Date, limit: number): Promise<string[]> {
  const db = getDb();
  const rows = await db`
    select id from ai_video_generations
    where status = any(string_to_array(${ACTIVE_STATUSES}, ','))
      and (next_check_at is null or next_check_at <= ${now.toISOString()})
      and (processing_lock_token is null or processing_lock_expires_at < ${now.toISOString()})
    order by next_check_at nulls first, created_at
    limit ${limit}
  `;
  return rows.map((row) => row.id as string);
}

export interface GenerationPatch {
  status?: AiVideoGenerationStatus;
  externalTaskId?: string | null;
  attempts?: number;
  nextCheckAt?: Date | null;
  submittedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  storageVideoUrl?: string | null;
  outputVideoUrl?: string | null;
  providerActualCostUsd?: number | null;
  providerCharged?: boolean;
  grossProfitBrl?: number | null;
  errorKind?: "USER_ERROR" | "TECHNICAL_ERROR" | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  expiresAt?: Date | null;
  postprocessAttempts?: number;
}

/**
 * Atualiza a geração. Com `lockToken`, só aplica se o lock ainda é deste
 * processo e o libera (fim do passo); sem, aplica direto (uso interno,
 * logo após criar). Mesmo padrão "lê atual → resolve undefined → UPDATE" do projeto.
 */
export async function updateGeneration(id: string, patch: GenerationPatch, lockToken: string | null): Promise<boolean> {
  const current = await getGenerationById(id);
  if (!current) return false;
  const db = getDb();
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  const iso = (value: Date | null) => (value ? value.toISOString() : null);
  const rows = await db`
    update ai_video_generations set
      status = ${pick(patch.status, current.status)},
      external_task_id = ${pick(patch.externalTaskId, current.externalTaskId)},
      attempts = ${pick(patch.attempts, current.attempts)},
      next_check_at = ${iso(pick(patch.nextCheckAt, current.nextCheckAt))},
      submitted_at = ${iso(pick(patch.submittedAt, current.submittedAt))},
      started_at = ${iso(pick(patch.startedAt, current.startedAt))},
      completed_at = ${iso(pick(patch.completedAt, current.completedAt))},
      storage_video_url = ${pick(patch.storageVideoUrl, current.storageVideoUrl)},
      output_video_url = coalesce(${patch.outputVideoUrl ?? null}, output_video_url),
      provider_actual_cost_usd = ${pick(patch.providerActualCostUsd, current.providerActualCostUsd)},
      provider_charged = ${pick(patch.providerCharged, current.providerCharged)},
      gross_profit_brl = ${pick(patch.grossProfitBrl, current.grossProfitBrl)},
      error_kind = ${pick(patch.errorKind, current.errorKind)},
      error_code = ${pick(patch.errorCode, current.errorCode)},
      error_message = ${pick(patch.errorMessage, current.errorMessage)},
      expires_at = ${iso(pick(patch.expiresAt, current.expiresAt))},
      postprocess_attempts = ${pick(patch.postprocessAttempts, current.postprocessAttempts)},
      processing_lock_token = null,
      processing_lock_expires_at = null
    where id = ${id}
      and (${lockToken}::text is null or processing_lock_token = ${lockToken})
    returning id
  `;
  return rows.length > 0;
}

/** Vídeos vencidos ainda guardados no Blob (retenção). */
export async function listExpiredStoredGenerations(now: Date, limit: number): Promise<AiVideoGenerationRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from ai_video_generations
    where storage_video_url is not null and expires_at is not null and expires_at <= ${now.toISOString()}
    order by expires_at limit ${limit}
  `;
  return rows.map(mapGeneration);
}

export async function userHasPaidPurchase(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`select 1 from ai_credit_purchases where user_id = ${userId} and status = 'PAID' limit 1`;
  return rows.length > 0;
}

/** Rascunho da tela (para voltar do checkout sem perder imagem/prompt/configurações). */
export interface AiVideoDraft {
  inputImageUrl: string | null;
  prompt: string;
  tier: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  preserveText: boolean | null;
  overlays: AiVideoOverlay[] | null;
}

export async function getDraft(userId: string): Promise<AiVideoDraft | null> {
  const db = getDb();
  const rows = await db`select * from ai_video_drafts where user_id = ${userId}`;
  const row = rows[0];
  if (!row) return null;
  return {
    inputImageUrl: (row.input_image_url as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? "",
    tier: (row.tier as string | null) ?? null,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    aspectRatio: (row.aspect_ratio as string | null) ?? null,
    preserveText: row.preserve_text === null || row.preserve_text === undefined ? null : Boolean(row.preserve_text),
    overlays: row.overlays === null || row.overlays === undefined ? null : parseJsonArray<AiVideoOverlay>(row.overlays),
  };
}

export async function saveDraft(userId: string, draft: AiVideoDraft): Promise<void> {
  const db = getDb();
  await db`
    insert into ai_video_drafts (user_id, input_image_url, prompt, tier, duration_seconds, aspect_ratio, preserve_text, overlays, updated_at)
    values (${userId}, ${draft.inputImageUrl}, ${draft.prompt}, ${draft.tier}, ${draft.durationSeconds}, ${draft.aspectRatio},
      ${draft.preserveText}, ${draft.overlays === null ? null : JSON.stringify(draft.overlays)}::jsonb, now())
    on conflict (user_id) do update set
      input_image_url = excluded.input_image_url, prompt = excluded.prompt, tier = excluded.tier,
      duration_seconds = excluded.duration_seconds, aspect_ratio = excluded.aspect_ratio,
      preserve_text = excluded.preserve_text, overlays = excluded.overlays, updated_at = now()
  `;
}

export async function clearDraft(userId: string): Promise<void> {
  const db = getDb();
  await db`delete from ai_video_drafts where user_id = ${userId}`;
}

/** Quantas regenerações com desconto já saíram deste vídeo (exceto as que não chegaram a reservar). */
export async function countRetriesOf(parentGenerationId: string): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from ai_video_generations
    where parent_generation_id = ${parentGenerationId} and pricing_kind = 'RETRY_DISCOUNT'
      and status not in ('CREATED', 'PRICE_GUARD_BLOCKED')
  `;
  return Number(rows[0]?.total ?? 0);
}

export async function markGenerationLiked(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update ai_video_generations set user_feedback = 'LIKED'
    where id = ${id} and user_id = ${userId} and status in ('COMPLETED', 'EXPIRED')
    returning id
  `;
  return rows.length > 0;
}

/** Troca só o status (para a tela mostrar a etapa) SEM liberar o lock do passo em andamento. */
export async function setGenerationStatusKeepingLock(id: string, status: AiVideoGenerationStatus, lockToken: string): Promise<void> {
  const db = getDb();
  await db`update ai_video_generations set status = ${status} where id = ${id} and processing_lock_token = ${lockToken}`;
}
