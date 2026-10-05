import "server-only";
import { getDb } from "@/lib/db/client";
import type { InstagramImportStatus } from "../url";
import type { InstagramMediaItem } from "./providers/provider";

/** Um item de carrossel já guardado no Blob do Alilu (ver migração 0027). */
export interface ImportedCarouselItem {
  index: number;
  mediaType: "VIDEO" | "IMAGE";
  fileUrl: string;
  storagePath: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
}

export interface InstagramImportRecord {
  id: string;
  userId: string;
  originalUrl: string;
  normalizedUrl: string;
  urlKind: string;
  shortcode: string | null;
  status: InstagramImportStatus;
  provider: string;
  providerRequestId: string | null;
  resolvedItems: InstagramMediaItem[];
  selectedIndex: number | null;
  mediaType: "VIDEO" | "IMAGE" | null;
  thumbnailUrl: string | null;
  importedFileUrl: string | null;
  storagePath: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  hasAudio: boolean | null;
  providerCostUsd: number;
  errorCode: string | null;
  errorMessage: string | null;
  executionMs: number | null;
  /** Carrossel: todos os itens importados, na ordem. Vazio para importação de item único. */
  importedItems: ImportedCarouselItem[];
  createdAt: Date;
  completedAt: Date | null;
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function items(value: unknown): InstagramMediaItem[] {
  if (Array.isArray(value)) return value as InstagramMediaItem[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function map(row: Record<string, unknown>): InstagramImportRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    originalUrl: row.original_url as string,
    normalizedUrl: row.normalized_url as string,
    urlKind: row.url_kind as string,
    shortcode: (row.shortcode as string | null) ?? null,
    status: row.status as InstagramImportStatus,
    provider: row.provider as string,
    providerRequestId: (row.provider_request_id as string | null) ?? null,
    resolvedItems: items(row.resolved_items),
    selectedIndex: num(row.selected_index),
    mediaType: (row.media_type as "VIDEO" | "IMAGE" | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    importedFileUrl: (row.imported_file_url as string | null) ?? null,
    storagePath: (row.storage_path as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    fileSizeBytes: num(row.file_size_bytes),
    durationSeconds: num(row.duration_seconds),
    width: num(row.width),
    height: num(row.height),
    videoCodec: (row.video_codec as string | null) ?? null,
    hasAudio: row.has_audio === null || row.has_audio === undefined ? null : Boolean(row.has_audio),
    providerCostUsd: Number(row.provider_cost_usd ?? 0),
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    executionMs: num(row.execution_ms),
    importedItems: (items(row.imported_items) as unknown as ImportedCarouselItem[]).sort((a, b) => a.index - b.index),
    createdAt: new Date(row.created_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
  };
}

export interface InstagramImportSettings {
  maxImportsPerDay: number;
  maxImportedVideoSizeMb: number;
  maxImportedDurationMinutes: number;
  providerCostUsd: number;
}

export async function getImportSettings(): Promise<InstagramImportSettings> {
  const db = getDb();
  const rows = await db`select * from instagram_import_settings where id = 1`;
  const row = rows[0] ?? {};
  return {
    maxImportsPerDay: Number(row.max_imports_per_day ?? 20),
    maxImportedVideoSizeMb: Number(row.max_imported_video_size_mb ?? 100),
    maxImportedDurationMinutes: Number(row.max_imported_duration_minutes ?? 10),
    providerCostUsd: Number(row.provider_cost_usd ?? 0.0012),
  };
}

export async function updateImportSettings(settings: InstagramImportSettings): Promise<void> {
  const db = getDb();
  await db`
    insert into instagram_import_settings (id, max_imports_per_day, max_imported_video_size_mb, max_imported_duration_minutes, provider_cost_usd, updated_at)
    values (1, ${settings.maxImportsPerDay}, ${settings.maxImportedVideoSizeMb}, ${settings.maxImportedDurationMinutes}, ${settings.providerCostUsd}, now())
    on conflict (id) do update set
      max_imports_per_day = excluded.max_imports_per_day,
      max_imported_video_size_mb = excluded.max_imported_video_size_mb,
      max_imported_duration_minutes = excluded.max_imported_duration_minutes,
      provider_cost_usd = excluded.provider_cost_usd,
      updated_at = now()
  `;
}

export async function insertImport(input: {
  userId: string;
  originalUrl: string;
  normalizedUrl: string;
  urlKind: string;
  shortcode: string | null;
  status: InstagramImportStatus;
  provider: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  authorizedAt: Date;
}): Promise<InstagramImportRecord> {
  const db = getDb();
  const rows = await db`
    insert into instagram_media_imports (user_id, original_url, normalized_url, url_kind, shortcode, status, provider, error_code, error_message, authorized_at)
    values (${input.userId}, ${input.originalUrl.slice(0, 2048)}, ${input.normalizedUrl}, ${input.urlKind}, ${input.shortcode}, ${input.status},
      ${input.provider}, ${input.errorCode ?? null}, ${input.errorMessage ?? null}, ${input.authorizedAt.toISOString()})
    returning *
  `;
  return map(rows[0]);
}

export interface ImportPatch {
  status?: InstagramImportStatus;
  providerRequestId?: string | null;
  resolvedItems?: InstagramMediaItem[];
  selectedIndex?: number | null;
  mediaType?: "VIDEO" | "IMAGE" | null;
  thumbnailUrl?: string | null;
  importedFileUrl?: string | null;
  storagePath?: string | null;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  videoCodec?: string | null;
  hasAudio?: boolean | null;
  providerCostUsd?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  executionMs?: number | null;
  completedAt?: Date | null;
  importedItems?: ImportedCarouselItem[];
}

export async function updateImport(id: string, patch: ImportPatch): Promise<InstagramImportRecord | null> {
  const current = await getImportById(id);
  if (!current) return null;
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  const completedAt = pick(patch.completedAt, current.completedAt);
  const db = getDb();
  const rows = await db`
    update instagram_media_imports set
      status = ${pick(patch.status, current.status)},
      provider_request_id = ${pick(patch.providerRequestId, current.providerRequestId)},
      resolved_items = ${JSON.stringify(pick(patch.resolvedItems, current.resolvedItems))}::jsonb,
      selected_index = ${pick(patch.selectedIndex, current.selectedIndex)},
      media_type = ${pick(patch.mediaType, current.mediaType)},
      thumbnail_url = ${pick(patch.thumbnailUrl, current.thumbnailUrl)},
      imported_file_url = ${pick(patch.importedFileUrl, current.importedFileUrl)},
      storage_path = ${pick(patch.storagePath, current.storagePath)},
      content_type = ${pick(patch.contentType, current.contentType)},
      file_size_bytes = ${pick(patch.fileSizeBytes, current.fileSizeBytes)},
      duration_seconds = ${pick(patch.durationSeconds, current.durationSeconds)},
      width = ${pick(patch.width, current.width)},
      height = ${pick(patch.height, current.height)},
      video_codec = ${pick(patch.videoCodec, current.videoCodec)},
      has_audio = ${pick(patch.hasAudio, current.hasAudio)},
      provider_cost_usd = ${pick(patch.providerCostUsd, current.providerCostUsd)},
      error_code = ${pick(patch.errorCode, current.errorCode)},
      error_message = ${pick(patch.errorMessage, current.errorMessage)},
      execution_ms = ${pick(patch.executionMs, current.executionMs)},
      imported_items = ${JSON.stringify(pick(patch.importedItems, current.importedItems))}::jsonb,
      completed_at = ${completedAt ? completedAt.toISOString() : null}
    where id = ${id}
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}

/** READY → IMPORTING atômico: dois cliques em "Importar" nunca baixam duas vezes. */
export async function claimForImport(id: string, userId: string, selectedIndex: number): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`
    update instagram_media_imports set status = 'IMPORTING', selected_index = ${selectedIndex}
    where id = ${id} and user_id = ${userId} and status = 'READY'
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}

export async function getImportById(id: string): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`select * from instagram_media_imports where id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function getImportForUser(id: string, userId: string): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`select * from instagram_media_imports where id = ${id} and user_id = ${userId}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function findCompletedImport(userId: string, normalizedUrl: string): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from instagram_media_imports
    where user_id = ${userId} and normalized_url = ${normalizedUrl} and status = 'COMPLETED'
    order by completed_at desc limit 1
  `;
  return rows[0] ? map(rows[0]) : null;
}

/** Consultas ao provedor hoje (contam para o limite diário; links inválidos não contam). */
export async function countProviderCallsSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from instagram_media_imports
    where user_id = ${userId} and created_at >= ${since.toISOString()} and provider <> 'manual' and status <> 'INVALID_URL'
  `;
  return Number(rows[0]?.total ?? 0);
}

export async function listImportsForUser(userId: string, limit = 50): Promise<InstagramImportRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from instagram_media_imports
    where user_id = ${userId} and status not in ('INVALID_URL', 'PENDING')
    order by created_at desc limit ${limit}
  `;
  return rows.map(map);
}

export async function deleteImport(id: string, userId: string): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`delete from instagram_media_imports where id = ${id} and user_id = ${userId} returning *`;
  return rows[0] ? map(rows[0]) : null;
}

export async function importStatsSince(since: Date): Promise<{ total: number; completed: number; failed: number; costUsd: number; bytes: number }> {
  const db = getDb();
  const [row] = await db`
    select count(*) filter (where status <> 'INVALID_URL')::int as total,
      count(*) filter (where status = 'COMPLETED')::int as completed,
      count(*) filter (where status in ('FAILED', 'PRIVATE_CONTENT', 'UNSUPPORTED'))::int as failed,
      coalesce(sum(provider_cost_usd), 0) as cost,
      coalesce(sum(file_size_bytes) filter (where status = 'COMPLETED'), 0) as bytes
    from instagram_media_imports where created_at >= ${since.toISOString()}
  `;
  return { total: Number(row.total), completed: Number(row.completed), failed: Number(row.failed), costUsd: Number(row.cost), bytes: Number(row.bytes) };
}

/**
 * Acrescenta um item importado do carrossel, de forma atômica e sem
 * duplicar o mesmo índice (dois cliques/abas não guardam duas vezes).
 * Devolve null se o índice já existia (ou a importação não é do usuário).
 */
export async function appendImportedCarouselItem(id: string, userId: string, item: ImportedCarouselItem): Promise<InstagramImportRecord | null> {
  const db = getDb();
  const rows = await db`
    update instagram_media_imports
    set imported_items = imported_items || ${JSON.stringify([item])}::jsonb
    where id = ${id} and user_id = ${userId} and status = 'READY'
      and not (imported_items @> ${JSON.stringify([{ index: item.index }])}::jsonb)
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}
