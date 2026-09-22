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

/**
 * Busca uma mídia pela URL exata de armazenamento (Vercel Blob), restrita
 * ao dono. Usada pelo fluxo de "publicar teste" (instagram-post-service.ts):
 * o upload client-side do Vercel Blob só devolve a URL do blob para o
 * navegador, não o id gerado por nós — esse id só existe depois que o
 * webhook onUploadCompleted (rota de upload) gravar a linha em
 * instagram_media, de forma assíncrona em relação ao upload em si. Quem
 * chama isso é responsável pelo poll curto (a gravação costuma ser quase
 * imediata, mas não é garantida estar pronta no instante em que o upload
 * do navegador termina).
 */
export async function getInstagramMediaByStorageUrl(
  storageUrl: string,
  userId: string,
): Promise<InstagramMediaRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, user_id, storage_url, media_type, file_size_bytes, original_filename, created_at
    from instagram_media
    where storage_url = ${storageUrl} and user_id = ${userId}
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
