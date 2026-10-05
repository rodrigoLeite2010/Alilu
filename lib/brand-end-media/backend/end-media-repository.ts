import "server-only";
import { getDb } from "@/lib/db/client";
import {
  DEFAULT_END_MEDIA_SETTINGS,
  type EndMediaSettingsDto,
  type EndMediaSlot,
} from "../end-media-config";

/**
 * Banco da mídia final padrão. Toda consulta é filtrada por user_id —
 * o usuário só lê/altera a própria configuração (nunca vem do frontend).
 */

export interface EndMediaAssetRecord {
  id: string;
  userId: string;
  slot: EndMediaSlot;
  storageUrl: string;
  storageKey: string;
  contentType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  videoCodec: string | null;
  fps: number | null;
  hasAudio: boolean;
  normalized: Record<string, string>;
  createdAt: Date;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSettings(row: Record<string, unknown> | undefined): EndMediaSettingsDto {
  if (!row) return { ...DEFAULT_END_MEDIA_SETTINGS };
  return {
    carouselEnabled: Boolean(row.carousel_enabled),
    reelEnabled: Boolean(row.reel_enabled),
    reelMediaKind: row.reel_media_kind === "IMAGE" ? "IMAGE" : "VIDEO",
    splitEnabled: Boolean(row.split_enabled),
    imageDurationSeconds: num(row.image_duration_seconds) ?? DEFAULT_END_MEDIA_SETTINGS.imageDurationSeconds,
    maxVideoSeconds: num(row.max_video_seconds),
    keepAudio: Boolean(row.keep_audio),
    fadeSeconds: num(row.fade_seconds) ?? DEFAULT_END_MEDIA_SETTINGS.fadeSeconds,
    applyAutomatically: row.apply_automatically === undefined ? true : Boolean(row.apply_automatically),
  };
}

function mapAsset(row: Record<string, unknown>): EndMediaAssetRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    slot: row.slot as EndMediaSlot,
    storageUrl: row.storage_url as string,
    storageKey: row.storage_key as string,
    contentType: row.content_type as string,
    fileSizeBytes: Number(row.file_size_bytes),
    width: Number(row.width),
    height: Number(row.height),
    durationSeconds: num(row.duration_seconds),
    videoCodec: (row.video_codec as string | null) ?? null,
    fps: num(row.fps),
    hasAudio: Boolean(row.has_audio),
    normalized: (row.normalized as Record<string, string> | null) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}

export async function getEndMediaSettings(userId: string): Promise<EndMediaSettingsDto> {
  const db = getDb();
  const [row] = await db`select * from brand_end_media_settings where user_id = ${userId}`;
  return mapSettings(row);
}

export async function saveEndMediaSettings(userId: string, settings: EndMediaSettingsDto): Promise<EndMediaSettingsDto> {
  const db = getDb();
  const [row] = await db`
    insert into brand_end_media_settings (
      user_id, carousel_enabled, reel_enabled, reel_media_kind, split_enabled,
      image_duration_seconds, max_video_seconds, keep_audio, fade_seconds, apply_automatically, updated_at
    ) values (
      ${userId}, ${settings.carouselEnabled}, ${settings.reelEnabled}, ${settings.reelMediaKind}, ${settings.splitEnabled},
      ${settings.imageDurationSeconds}, ${settings.maxVideoSeconds}, ${settings.keepAudio}, ${settings.fadeSeconds},
      ${settings.applyAutomatically}, now()
    )
    on conflict (user_id) do update set
      carousel_enabled = excluded.carousel_enabled,
      reel_enabled = excluded.reel_enabled,
      reel_media_kind = excluded.reel_media_kind,
      split_enabled = excluded.split_enabled,
      image_duration_seconds = excluded.image_duration_seconds,
      max_video_seconds = excluded.max_video_seconds,
      keep_audio = excluded.keep_audio,
      fade_seconds = excluded.fade_seconds,
      apply_automatically = excluded.apply_automatically,
      updated_at = now()
    returning *
  `;
  return mapSettings(row);
}

export async function listEndMediaAssets(userId: string): Promise<EndMediaAssetRecord[]> {
  const db = getDb();
  const rows = await db`select * from brand_end_media_assets where user_id = ${userId} order by slot`;
  return rows.map(mapAsset);
}

export async function getEndMediaAsset(userId: string, slot: EndMediaSlot): Promise<EndMediaAssetRecord | null> {
  const db = getDb();
  const [row] = await db`select * from brand_end_media_assets where user_id = ${userId} and slot = ${slot}`;
  return row ? mapAsset(row) : null;
}

export interface UpsertEndMediaAssetInput {
  userId: string;
  slot: EndMediaSlot;
  storageUrl: string;
  storageKey: string;
  contentType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  videoCodec: string | null;
  fps: number | null;
  hasAudio: boolean;
}

/** Troca (ou cria) a mídia do slot. Devolve o registro novo e o antigo (para apagar os arquivos antigos). */
export async function upsertEndMediaAsset(
  input: UpsertEndMediaAssetInput,
): Promise<{ asset: EndMediaAssetRecord; previous: EndMediaAssetRecord | null }> {
  const db = getDb();
  const previous = await getEndMediaAsset(input.userId, input.slot);
  const [row] = await db`
    insert into brand_end_media_assets (
      user_id, slot, storage_url, storage_key, content_type, file_size_bytes, width, height,
      duration_seconds, video_codec, fps, has_audio, normalized
    ) values (
      ${input.userId}, ${input.slot}, ${input.storageUrl}, ${input.storageKey}, ${input.contentType}, ${input.fileSizeBytes},
      ${input.width}, ${input.height}, ${input.durationSeconds}, ${input.videoCodec}, ${input.fps}, ${input.hasAudio}, '{}'::jsonb
    )
    on conflict (user_id, slot) do update set
      id = gen_random_uuid(),
      storage_url = excluded.storage_url,
      storage_key = excluded.storage_key,
      content_type = excluded.content_type,
      file_size_bytes = excluded.file_size_bytes,
      width = excluded.width,
      height = excluded.height,
      duration_seconds = excluded.duration_seconds,
      video_codec = excluded.video_codec,
      fps = excluded.fps,
      has_audio = excluded.has_audio,
      normalized = '{}'::jsonb,
      created_at = now()
    returning *
  `;
  return { asset: mapAsset(row), previous };
}

export async function deleteEndMediaAsset(userId: string, slot: EndMediaSlot): Promise<EndMediaAssetRecord | null> {
  const db = getDb();
  const [row] = await db`delete from brand_end_media_assets where user_id = ${userId} and slot = ${slot} returning *`;
  return row ? mapAsset(row) : null;
}

/** Guarda a URL de uma versão pré-normalizada (só se o arquivo do slot ainda for o mesmo). */
export async function saveNormalizedVariant(assetId: string, userId: string, key: string, url: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update brand_end_media_assets
    set normalized = normalized || jsonb_build_object(${key}::text, ${url}::text)
    where id = ${assetId} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

export interface EndMediaRenderRecord {
  id: string;
  userId: string;
  context: "REEL" | "SPLIT_SCREEN" | "AUTOMATION_REEL";
  sourceMediaId: string | null;
  endKey: string;
  endMediaType: "VIDEO" | "IMAGE";
  endMediaUrl: string;
  resultUrl: string;
  resultMediaId: string | null;
}

function mapRender(row: Record<string, unknown>): EndMediaRenderRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    context: row.context as EndMediaRenderRecord["context"],
    sourceMediaId: (row.source_media_id as string | null) ?? null,
    endKey: row.end_key as string,
    endMediaType: row.end_media_type === "IMAGE" ? "IMAGE" : "VIDEO",
    endMediaUrl: row.end_media_url as string,
    resultUrl: row.result_url as string,
    resultMediaId: (row.result_media_id as string | null) ?? null,
  };
}

export async function findCachedRender(userId: string, sourceMediaId: string, endKey: string): Promise<EndMediaRenderRecord | null> {
  const db = getDb();
  const [row] = await db`
    select r.* from brand_end_media_renders r
    join instagram_media m on m.id = r.result_media_id and m.user_id = ${userId}
    where r.user_id = ${userId} and r.source_media_id = ${sourceMediaId} and r.end_key = ${endKey}
    limit 1
  `;
  return row ? mapRender(row) : null;
}

export async function insertRender(input: Omit<EndMediaRenderRecord, "id"> & { processingMs: number | null }): Promise<EndMediaRenderRecord> {
  const db = getDb();
  const [row] = await db`
    insert into brand_end_media_renders (
      user_id, context, source_media_id, end_key, end_media_type, end_media_url, result_url, result_media_id, processing_ms
    ) values (
      ${input.userId}, ${input.context}, ${input.sourceMediaId}, ${input.endKey}, ${input.endMediaType}, ${input.endMediaUrl},
      ${input.resultUrl}, ${input.resultMediaId}, ${input.processingMs}
    )
    on conflict do nothing
    returning *
  `;
  if (row) return mapRender(row);
  // Corrida: outra execução gravou o mesmo cache — devolve o existente.
  const existing = input.sourceMediaId ? await findCachedRender(input.userId, input.sourceMediaId, input.endKey) : null;
  if (!existing) throw new Error("Não foi possível registrar o vídeo com encerramento.");
  return existing;
}

export async function getRenderForUser(renderId: string, userId: string): Promise<EndMediaRenderRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(renderId)) return null;
  const db = getDb();
  const [row] = await db`select * from brand_end_media_renders where id = ${renderId} and user_id = ${userId}`;
  return row ? mapRender(row) : null;
}

export async function getRenderByResultMedia(resultMediaId: string, userId: string): Promise<EndMediaRenderRecord | null> {
  const db = getDb();
  const [row] = await db`
    select * from brand_end_media_renders where result_media_id = ${resultMediaId} and user_id = ${userId}
    order by created_at desc limit 1
  `;
  return row ? mapRender(row) : null;
}

/** Histórico da publicação (o que foi usado NA ÉPOCA). Só grava em post do próprio usuário. */
export async function markPostEndMedia(
  postId: string,
  userId: string,
  info: { applied: boolean; type: "VIDEO" | "IMAGE" | null; urlUsed: string | null; error: string | null },
): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts set
      end_media_applied = ${info.applied},
      end_media_type = ${info.type},
      end_media_url_used = ${info.urlUsed},
      end_media_error = ${info.error}
    where id = ${postId} and user_id = ${userId}
  `;
}

export interface EndMediaEventInput {
  userId: string;
  postId?: string | null;
  context: string;
  mediaType?: string | null;
  assetId?: string | null;
  applied: boolean;
  processingMs?: number | null;
  error?: string | null;
}

/** Log para admin — nunca lança (não pode derrubar a publicação). */
export async function recordEndMediaEvent(input: EndMediaEventInput): Promise<void> {
  try {
    const db = getDb();
    await db`
      insert into end_media_events (user_id, post_id, context, media_type, asset_id, applied, processing_ms, error)
      values (${input.userId}, ${input.postId ?? null}, ${input.context}, ${input.mediaType ?? null}, ${input.assetId ?? null},
        ${input.applied}, ${input.processingMs ?? null}, ${input.error ? String(input.error).slice(0, 500) : null})
    `;
  } catch (error) {
    console.error(JSON.stringify({ scope: "end-media", event: "event_log_failed", message: error instanceof Error ? error.message : String(error) }));
  }
  console.info(JSON.stringify({ scope: "end-media", event: input.applied ? "applied" : "not_applied", ...input, error: input.error ?? null }));
}

export async function listRecentEndMediaEvents(limit = 100): Promise<Array<Record<string, unknown>>> {
  const db = getDb();
  return db`select * from end_media_events order by created_at desc limit ${limit}`;
}

export async function getRunGenerationAttempt(runId: string): Promise<number> {
  const db = getDb();
  const [row] = await db`select generation_attempt from automation_runs where id = ${runId}`;
  return Number(row?.generation_attempt ?? 0);
}
