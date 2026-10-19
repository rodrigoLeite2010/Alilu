import "server-only";
import { getDb } from "@/lib/db/client";
import type { YoutubeAvailability, YoutubeImportStatus } from "../types";

export interface YoutubeImportRecord {
  id: string;
  userId: string;
  videoId: string;
  urlKind: string;
  originalUrl: string;
  normalizedUrl: string;
  status: YoutubeImportStatus;
  availability: YoutubeAvailability;
  metadataSource: "data_api" | "oembed" | "none";
  title: string | null;
  channelTitle: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  youtubeDurationSeconds: number | null;
  embeddable: boolean;
  madeForKids: boolean | null;
  regionRestricted: boolean;
  metadataFetchedAt: Date | null;
  errorCode: string | null;
  fileUrl: string | null;
  storagePath: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  hasAudio: boolean | null;
  durationMismatch: boolean;
  authorizedAt: Date;
  createdAt: Date;
  completedAt: Date | null;
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const bool = (value: unknown) => (value === null || value === undefined ? null : Boolean(value));
const date = (value: unknown) => (value ? new Date(value as string) : null);

function map(row: Record<string, unknown>): YoutubeImportRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    videoId: row.video_id as string,
    urlKind: row.url_kind as string,
    originalUrl: row.original_url as string,
    normalizedUrl: row.normalized_url as string,
    status: row.status as YoutubeImportStatus,
    availability: row.availability as YoutubeAvailability,
    metadataSource: row.metadata_source as YoutubeImportRecord["metadataSource"],
    title: (row.title as string | null) ?? null,
    channelTitle: (row.channel_title as string | null) ?? null,
    channelId: (row.channel_id as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    youtubeDurationSeconds: num(row.youtube_duration_seconds),
    embeddable: Boolean(row.embeddable),
    madeForKids: bool(row.made_for_kids),
    regionRestricted: Boolean(row.region_restricted),
    metadataFetchedAt: date(row.metadata_fetched_at),
    errorCode: (row.error_code as string | null) ?? null,
    fileUrl: (row.file_url as string | null) ?? null,
    storagePath: (row.storage_path as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    fileSizeBytes: num(row.file_size_bytes),
    durationSeconds: num(row.duration_seconds),
    width: num(row.width),
    height: num(row.height),
    videoCodec: (row.video_codec as string | null) ?? null,
    hasAudio: bool(row.has_audio),
    durationMismatch: Boolean(row.duration_mismatch),
    authorizedAt: new Date(row.authorized_at as string),
    createdAt: new Date(row.created_at as string),
    completedAt: date(row.completed_at),
  };
}

export interface NewYoutubeImport {
  userId: string;
  videoId: string;
  urlKind: string;
  originalUrl: string;
  normalizedUrl: string;
  availability: YoutubeAvailability;
  metadataSource: YoutubeImportRecord["metadataSource"];
  title: string | null;
  channelTitle: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  youtubeDurationSeconds: number | null;
  embeddable: boolean;
  madeForKids: boolean | null;
  regionRestricted: boolean;
  metadataFetchedAt: Date | null;
  errorCode: string | null;
  authorizedAt: Date;
}

export async function insertYoutubeImport(input: NewYoutubeImport): Promise<YoutubeImportRecord> {
  const db = getDb();
  const rows = await db`
    insert into youtube_video_imports (
      user_id, video_id, url_kind, original_url, normalized_url, status, availability, metadata_source,
      title, channel_title, channel_id, thumbnail_url, youtube_duration_seconds, embeddable, made_for_kids,
      region_restricted, metadata_fetched_at, error_code, authorized_at
    ) values (
      ${input.userId}, ${input.videoId}, ${input.urlKind}, ${input.originalUrl.slice(0, 2048)}, ${input.normalizedUrl}, 'ANALYZED',
      ${input.availability}, ${input.metadataSource}, ${input.title}, ${input.channelTitle}, ${input.channelId}, ${input.thumbnailUrl},
      ${input.youtubeDurationSeconds === null ? null : Math.round(input.youtubeDurationSeconds)}, ${input.embeddable}, ${input.madeForKids},
      ${input.regionRestricted}, ${input.metadataFetchedAt ? input.metadataFetchedAt.toISOString() : null}, ${input.errorCode},
      ${input.authorizedAt.toISOString()}
    )
    returning *
  `;
  return map(rows[0]);
}

export interface CompletedFile {
  fileUrl: string;
  storagePath: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  width: number;
  height: number;
  videoCodec: string | null;
  hasAudio: boolean;
  durationMismatch: boolean;
  completedAt: Date;
}

/**
 * ANALYZED → COMPLETED atômico, só do próprio usuário. Devolve null se o
 * registro já tinha arquivo (dois envios simultâneos não sobrescrevem um ao outro).
 */
export async function completeYoutubeImport(id: string, userId: string, file: CompletedFile): Promise<YoutubeImportRecord | null> {
  const db = getDb();
  const rows = await db`
    update youtube_video_imports set
      status = 'COMPLETED',
      file_url = ${file.fileUrl},
      storage_path = ${file.storagePath},
      content_type = ${file.contentType},
      file_size_bytes = ${file.fileSizeBytes},
      duration_seconds = ${file.durationSeconds},
      width = ${file.width},
      height = ${file.height},
      video_codec = ${file.videoCodec},
      has_audio = ${file.hasAudio},
      duration_mismatch = ${file.durationMismatch},
      completed_at = ${file.completedAt.toISOString()}
    where id = ${id} and user_id = ${userId} and status = 'ANALYZED' and file_url is null
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}

export async function getYoutubeImportForUser(id: string, userId: string): Promise<YoutubeImportRecord | null> {
  const db = getDb();
  const rows = await db`select * from youtube_video_imports where id = ${id} and user_id = ${userId}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function findCompletedYoutubeImport(userId: string, videoId: string): Promise<YoutubeImportRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from youtube_video_imports
    where user_id = ${userId} and video_id = ${videoId} and status = 'COMPLETED'
    order by completed_at desc limit 1
  `;
  return rows[0] ? map(rows[0]) : null;
}

/**
 * Registra uma consulta e devolve quantas existem desde `since` (já contando
 * esta). Inserir ANTES de contar evita que pedidos simultâneos passem do
 * limite juntos; a tabela é separada, então excluir importações não devolve cota.
 */
export async function recordYoutubeAnalysis(userId: string, at: Date): Promise<void> {
  const db = getDb();
  await db`insert into youtube_import_usage (user_id, created_at) values (${userId}, ${at.toISOString()})`;
}

/** Consultas feitas desde `since` (base do limite diário e do limite por minuto). */
export async function countYoutubeAnalysesSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as total from youtube_import_usage
    where user_id = ${userId} and created_at >= ${since.toISOString()}
  `;
  return Number(rows[0]?.total ?? 0);
}

export async function listYoutubeImportsForUser(userId: string, limit = 20): Promise<YoutubeImportRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from youtube_video_imports
    where user_id = ${userId} and status in ('COMPLETED', 'EXPIRED')
    order by coalesce(completed_at, created_at) desc limit ${limit}
  `;
  return rows.map(map);
}

export async function deleteYoutubeImport(id: string, userId: string): Promise<YoutubeImportRecord | null> {
  const db = getDb();
  const rows = await db`delete from youtube_video_imports where id = ${id} and user_id = ${userId} returning *`;
  return rows[0] ? map(rows[0]) : null;
}
