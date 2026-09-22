import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Acesso ao banco para posts do Instagram (instagram_posts,
 * instagram_post_items, instagram_publish_attempts). Só
 * gravação/consulta — a orquestração da publicação com a Meta fica em
 * instagram-publish-service.ts; a validação de posse (conta/mídia
 * pertencem ao usuário) fica em instagram-post-service.ts.
 *
 * Nesta etapa só o fluxo de post de IMAGEM ÚNICA é suportado
 * (createDraftImagePost / getPostForPublish assumem um único item por
 * post); carrossel e Reels são etapas futuras e vão precisar de consultas
 * próprias para múltiplos itens.
 */

export type InstagramPostType = "image" | "carousel" | "reels";
export type InstagramPostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PROCESSING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED"
  | "NEEDS_REVIEW";

export interface CreateDraftImagePostInput {
  userId: string;
  instagramAccountId: string;
  mediaId: string;
  caption: string;
}

/**
 * Cria um post de imagem única em DRAFT, já com o item de mídia associado
 * (posição 0, capa). Duas inserções sequenciais — o driver HTTP usado para
 * consultas do dia a dia (ver lib/db/client.ts) não tem transação
 * multi-statement; no pior caso de falha entre as duas, o post fica DRAFT
 * sem item e a publicação falha de forma segura ao não achar mídia
 * nenhuma (getPostForPublish retorna null), nunca publicando algo
 * incompleto.
 */
export async function createDraftImagePost(input: CreateDraftImagePostInput): Promise<string> {
  const db = getDb();
  const postRows = await db`
    insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status)
    values (${input.userId}, ${input.instagramAccountId}, 'image', ${input.caption}, 'DRAFT')
    returning id
  `;
  const postId = postRows[0].id as string;

  await db`
    insert into instagram_post_items (post_id, media_id, position, is_cover)
    values (${postId}, ${input.mediaId}, 0, true)
  `;

  return postId;
}

export interface PostForPublish {
  id: string;
  postType: InstagramPostType;
  status: InstagramPostStatus;
  caption: string;
  metaContainerId: string | null;
  igUserId: string;
  accessTokenEncrypted: string;
  mediaStorageUrl: string;
  mediaType: "image" | "video";
}

/**
 * Carrega tudo que a publicação precisa numa consulta só: o post, a conta
 * do Instagram associada (token cifrado) e a mídia do item de posição mais
 * baixa — suficiente para imagem única; carrossel vai precisar buscar
 * todos os itens, não só o primeiro. Sempre restrito ao dono (`userId`) —
 * nunca deixa um usuário publicar/consultar o post de outro.
 */
export async function getPostForPublish(postId: string, userId: string): Promise<PostForPublish | null> {
  const db = getDb();
  const rows = await db`
    select
      p.id, p.post_type, p.status, p.caption, p.meta_container_id,
      a.ig_user_id, a.access_token_encrypted,
      m.storage_url as media_storage_url, m.media_type
    from instagram_posts p
    join instagram_accounts a on a.id = p.instagram_account_id
    join instagram_post_items pi on pi.post_id = p.id
    join instagram_media m on m.id = pi.media_id
    where p.id = ${postId} and p.user_id = ${userId}
    order by pi.position asc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    postType: row.post_type as InstagramPostType,
    status: row.status as InstagramPostStatus,
    caption: (row.caption as string) ?? "",
    metaContainerId: (row.meta_container_id as string | null) ?? null,
    igUserId: row.ig_user_id as string,
    accessTokenEncrypted: row.access_token_encrypted as string,
    mediaStorageUrl: row.media_storage_url as string,
    mediaType: row.media_type as "image" | "video",
  };
}

/** Registra que o post entrou em processamento na Meta, com o id do container criado. */
export async function markPostProcessing(postId: string, containerId: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'PROCESSING', meta_container_id = ${containerId}, attempts_count = attempts_count + 1, updated_at = now()
    where id = ${postId}
  `;
}

/** Marca o post como publicado de verdade — só chamar depois que a Meta confirmar o media_publish. */
export async function markPostPublished(postId: string, metaMediaId: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'PUBLISHED', meta_media_id = ${metaMediaId}, published_at = now(), updated_at = now()
    where id = ${postId}
  `;
}

/** Marca o post como falho, com a mensagem já sanitizada (nunca o erro cru/stack). */
export async function markPostFailed(postId: string, sanitizedError: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'FAILED', last_error_sanitized = ${sanitizedError}, updated_at = now()
    where id = ${postId}
  `;
}

export interface RecordPublishAttemptInput {
  postId: string;
  outcome: "success" | "failure" | "pending";
  errorSanitized?: string;
  containerId?: string;
  mediaId?: string;
}

/** Grava uma linha de auditoria por tentativa de publicação — nunca sobrescreve, só acumula. */
export async function recordPublishAttempt(input: RecordPublishAttemptInput): Promise<void> {
  const db = getDb();
  await db`
    insert into instagram_publish_attempts (post_id, outcome, error_sanitized, meta_container_id, meta_media_id)
    values (
      ${input.postId}, ${input.outcome}, ${input.errorSanitized ?? null},
      ${input.containerId ?? null}, ${input.mediaId ?? null}
    )
  `;
}
