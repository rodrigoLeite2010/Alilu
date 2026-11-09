import "server-only";
import { getDb } from "@/lib/db/client";
import type { SplitBottomMediaKind } from "./split-bottom-config";

/** Banco da mídia fixa do Split Screen. Toda consulta filtra por user_id (o dono nunca vem do frontend). */

export interface SplitBottomMediaRecord {
  id: string;
  userId: string;
  instagramAccountId: string;
  kind: SplitBottomMediaKind;
  storageUrl: string;
  storageKey: string;
  contentType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  hasAudio: boolean;
}

function mapRow(row: Record<string, unknown>): SplitBottomMediaRecord {
  const duration = row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds);
  return {
    id: row.id as string,
    userId: row.user_id as string,
    instagramAccountId: row.instagram_account_id as string,
    kind: row.media_kind === "IMAGE" ? "IMAGE" : "VIDEO",
    storageUrl: row.storage_url as string,
    storageKey: row.storage_key as string,
    contentType: row.content_type as string,
    fileSizeBytes: Number(row.file_size_bytes),
    width: Number(row.width),
    height: Number(row.height),
    durationSeconds: Number.isFinite(duration) ? duration : null,
    hasAudio: Boolean(row.has_audio),
  };
}

export async function listSplitBottomMedia(userId: string): Promise<SplitBottomMediaRecord[]> {
  const db = getDb();
  const rows = await db`select * from split_screen_bottom_media where user_id = ${userId}`;
  return rows.map(mapRow);
}

export async function getSplitBottomMedia(userId: string, instagramAccountId: string): Promise<SplitBottomMediaRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(instagramAccountId)) return null;
  const db = getDb();
  const [row] = await db`
    select * from split_screen_bottom_media
    where user_id = ${userId} and instagram_account_id = ${instagramAccountId}
  `;
  return row ? mapRow(row) : null;
}

export type UpsertSplitBottomMediaInput = Omit<SplitBottomMediaRecord, "id">;

/** Troca (ou cria) a mídia da conta. Devolve a nova e a anterior (para apagar o arquivo antigo). */
export async function upsertSplitBottomMedia(
  input: UpsertSplitBottomMediaInput,
): Promise<{ media: SplitBottomMediaRecord; previous: SplitBottomMediaRecord | null }> {
  const db = getDb();
  const previous = await getSplitBottomMedia(input.userId, input.instagramAccountId);
  const [row] = await db`
    insert into split_screen_bottom_media (
      user_id, instagram_account_id, media_kind, storage_url, storage_key, content_type,
      file_size_bytes, width, height, duration_seconds, has_audio
    ) values (
      ${input.userId}, ${input.instagramAccountId}, ${input.kind}, ${input.storageUrl}, ${input.storageKey}, ${input.contentType},
      ${input.fileSizeBytes}, ${input.width}, ${input.height}, ${input.durationSeconds}, ${input.hasAudio}
    )
    on conflict (instagram_account_id) do update set
      media_kind = excluded.media_kind,
      storage_url = excluded.storage_url,
      storage_key = excluded.storage_key,
      content_type = excluded.content_type,
      file_size_bytes = excluded.file_size_bytes,
      width = excluded.width,
      height = excluded.height,
      duration_seconds = excluded.duration_seconds,
      has_audio = excluded.has_audio,
      updated_at = now()
    where split_screen_bottom_media.user_id = excluded.user_id
    returning *
  `;
  if (!row) throw new Error("Conta do Instagram inválida.");
  return { media: mapRow(row), previous };
}

export async function deleteSplitBottomMedia(userId: string, instagramAccountId: string): Promise<SplitBottomMediaRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(instagramAccountId)) return null;
  const db = getDb();
  const [row] = await db`
    delete from split_screen_bottom_media
    where user_id = ${userId} and instagram_account_id = ${instagramAccountId}
    returning *
  `;
  return row ? mapRow(row) : null;
}
