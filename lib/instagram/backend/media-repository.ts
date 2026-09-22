import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Acesso ao banco para os registros de mídia (instagram_media) — só
 * gravação/consulta, sem regra de negócio (essa fica em media-service.ts
 * e na rota que orquestra o client upload do Vercel Blob).
 */

export type InstagramMediaType = "image" | "video";

export interface InsertInstagramMediaInput {
  userId: string;
  storageUrl: string;
  mediaType: InstagramMediaType;
  fileSizeBytes: number | null;
  originalFilename: string | null;
}

/** Grava a mídia já persistida no Vercel Blob e retorna o id gerado (instagram_media.id). */
export async function insertInstagramMedia(input: InsertInstagramMediaInput): Promise<string> {
  const db = getDb();
  const rows = await db`
    insert into instagram_media (user_id, storage_url, media_type, file_size_bytes, original_filename)
    values (${input.userId}, ${input.storageUrl}, ${input.mediaType}, ${input.fileSizeBytes}, ${input.originalFilename})
    returning id
  `;
  return rows[0].id as string;
}

export interface InstagramMediaRecord {
  id: string;
  userId: string;
  storageUrl: string;
  mediaType: InstagramMediaType;
  fileSizeBytes: number | null;
  originalFilename: string | null;
  createdAt: Date;
}

/**
 * Busca uma mídia por id, restrita ao dono (`userId`) — nunca deixa um
 * usuário ler a URL de armazenamento de mídia de outro usuário. Ainda não
 * usada nesta etapa; será a base para o InstagramService montar
 * posts/carrosséis a partir de mídias já enviadas.
 */
export async function getInstagramMediaById(id: string, userId: string): Promise<InstagramMediaRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, user_id, storage_url, media_type, file_size_bytes, original_filename, created_at
    from instagram_media
    where id = ${id} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    storageUrl: row.storage_url as string,
    mediaType: row.media_type as InstagramMediaType,
    fileSizeBytes: (row.file_size_bytes as number | null) ?? null,
    originalFilename: (row.original_filename as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}
