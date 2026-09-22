import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Acesso ao banco para posts do Instagram (instagram_posts,
 * instagram_post_items, instagram_publish_attempts). Só
 * gravação/consulta — a orquestração da publicação com a Meta fica em
 * instagram-publish-service.ts; a validação de posse (conta/mídia
 * pertencem ao usuário) fica em instagram-post-service.ts.
 *
 * Imagem única e carrossel (2 a 10 imagens) são suportados nesta etapa —
 * ambos usam a mesma tabela instagram_post_items (um item por posição);
 * Reels é uma etapa futura, e vai precisar das próprias regras de vídeo.
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
  /**
   * Quando informado, o post já nasce `SCHEDULED` em vez de `DRAFT` (Fase
   * 3, calendário editorial). Isto só marca a intenção — nada dispara a
   * publicação automaticamente ainda: o disparo de verdade no horário
   * certo depende do endpoint do scheduler (etapa própria, ainda não
   * implementada). Até lá, um post `SCHEDULED` só é publicado se o
   * usuário clicar em "Publicar agora" manualmente.
   */
  scheduledAtUtc?: Date | null;
}

/**
 * Cria um post de imagem única (DRAFT ou, se `scheduledAtUtc` for
 * informado, SCHEDULED), já com o item de mídia associado (posição 0,
 * capa). Duas inserções sequenciais — o driver HTTP usado para consultas
 * do dia a dia (ver lib/db/client.ts) não tem transação multi-statement;
 * no pior caso de falha entre as duas, o post fica sem item e a
 * publicação falha de forma segura ao não achar mídia nenhuma
 * (getPostForPublish retorna null), nunca publicando algo incompleto.
 */
export async function createDraftImagePost(input: CreateDraftImagePostInput): Promise<string> {
  const db = getDb();
  const status = input.scheduledAtUtc ? "SCHEDULED" : "DRAFT";
  const scheduledAtIso = input.scheduledAtUtc ? input.scheduledAtUtc.toISOString() : null;

  const postRows = await db`
    insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status, scheduled_at_utc)
    values (${input.userId}, ${input.instagramAccountId}, 'image', ${input.caption}, ${status}, ${scheduledAtIso})
    returning id
  `;
  const postId = postRows[0].id as string;

  await db`
    insert into instagram_post_items (post_id, media_id, position, is_cover)
    values (${postId}, ${input.mediaId}, 0, true)
  `;

  return postId;
}

export interface CreateDraftCarouselPostInput {
  userId: string;
  instagramAccountId: string;
  /** De 2 a 10 mídias, JÁ na ordem de exibição — a quantidade já foi validada em instagram-post-service.ts (limite da própria Meta para carrossel). */
  mediaIds: string[];
  caption: string;
  /** Mesma semântica de CreateDraftImagePostInput.scheduledAtUtc. */
  scheduledAtUtc?: Date | null;
}

/**
 * Cria um post de carrossel — mesma ideia de createDraftImagePost, mas
 * com um item por mídia informada, na ordem recebida (position 0..n-1;
 * capa = position 0). Inserções sequenciais, uma por item, pelo mesmo
 * motivo (sem transação multi-statement no driver HTTP): no pior caso de
 * falha no meio, o post fica com menos itens do que deveria, e a
 * publicação falha de forma segura na validação de "2 a 10 itens" em
 * publishCarouselPost (instagram-publish-service.ts) — nunca publica um
 * carrossel incompleto.
 */
export async function createDraftCarouselPost(input: CreateDraftCarouselPostInput): Promise<string> {
  const db = getDb();
  const status = input.scheduledAtUtc ? "SCHEDULED" : "DRAFT";
  const scheduledAtIso = input.scheduledAtUtc ? input.scheduledAtUtc.toISOString() : null;

  const postRows = await db`
    insert into instagram_posts (user_id, instagram_account_id, post_type, caption, status, scheduled_at_utc)
    values (${input.userId}, ${input.instagramAccountId}, 'carousel', ${input.caption}, ${status}, ${scheduledAtIso})
    returning id
  `;
  const postId = postRows[0].id as string;

  for (let position = 0; position < input.mediaIds.length; position += 1) {
    await db`
      insert into instagram_post_items (post_id, media_id, position, is_cover)
      values (${postId}, ${input.mediaIds[position]}, ${position}, ${position === 0})
    `;
  }

  return postId;
}

export interface PostForPublishItem {
  mediaId: string;
  storageUrl: string;
  mediaType: "image" | "video";
  position: number;
}

export interface PostForPublish {
  id: string;
  postType: InstagramPostType;
  status: InstagramPostStatus;
  caption: string;
  metaContainerId: string | null;
  igUserId: string;
  accessTokenEncrypted: string;
  /** Todos os itens do post, ordenados por posição (1 para imagem única; 2 a 10 para carrossel). */
  items: PostForPublishItem[];
}

/**
 * Carrega tudo que a publicação precisa numa consulta só: o post, a conta
 * do Instagram associada (token cifrado) e TODOS os itens de mídia, na
 * ordem de exibição — usado tanto por publishImagePost (usa só
 * `items[0]`) quanto por publishCarouselPost (usa a lista inteira).
 * Sempre restrito ao dono (`userId`) — nunca deixa um usuário
 * publicar/consultar o post de outro.
 */
export async function getPostForPublish(postId: string, userId: string): Promise<PostForPublish | null> {
  const db = getDb();
  const rows = await db`
    select
      p.id, p.post_type, p.status, p.caption, p.meta_container_id,
      a.ig_user_id, a.access_token_encrypted,
      pi.media_id, pi.position, m.storage_url as media_storage_url, m.media_type
    from instagram_posts p
    join instagram_accounts a on a.id = p.instagram_account_id
    join instagram_post_items pi on pi.post_id = p.id
    join instagram_media m on m.id = pi.media_id
    where p.id = ${postId} and p.user_id = ${userId}
    order by pi.position asc
  `;
  if (rows.length === 0) return null;

  const first = rows[0];
  return {
    id: first.id as string,
    postType: first.post_type as InstagramPostType,
    status: first.status as InstagramPostStatus,
    caption: (first.caption as string) ?? "",
    metaContainerId: (first.meta_container_id as string | null) ?? null,
    igUserId: first.ig_user_id as string,
    accessTokenEncrypted: first.access_token_encrypted as string,
    items: rows.map((row) => ({
      mediaId: row.media_id as string,
      storageUrl: row.media_storage_url as string,
      mediaType: row.media_type as "image" | "video",
      position: row.position as number,
    })),
  };
}

/** Registra que o post entrou em processamento na Meta, com o id do container criado (imagem: o único container; carrossel: o container PAI). */
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

export interface PostSummary {
  id: string;
  postType: InstagramPostType;
  status: InstagramPostStatus;
  caption: string;
  scheduledAtUtc: string | null;
  publishedAt: string | null;
  createdAt: string;
  lastErrorSanitized: string | null;
  igUsername: string | null;
  mediaStorageUrl: string | null;
  /** Quantidade de itens do post (1 para imagem única; 2 a 10 para carrossel) — usado pela tela do calendário para indicar "Carrossel • N fotos". */
  itemCount: number;
}

/**
 * Lista os posts do usuário para o calendário editorial, com a conta e a
 * mídia de capa já resolvidas (evita N+1 na tela de lista). Ordenado pela
 * data que mais importa para planejamento: agendamento se houver, senão
 * criação — mais recente primeiro. Limitado a 200 por enquanto (sem
 * paginação nesta etapa; o volume esperado de um único usuário não chega
 * perto disso).
 */
export async function listPostsForUser(userId: string): Promise<PostSummary[]> {
  const db = getDb();
  const rows = await db`
    select
      p.id, p.post_type, p.status, p.caption, p.scheduled_at_utc, p.published_at, p.created_at, p.last_error_sanitized,
      a.ig_username,
      m.storage_url as media_storage_url,
      (select count(*) from instagram_post_items pi2 where pi2.post_id = p.id) as item_count
    from instagram_posts p
    join instagram_accounts a on a.id = p.instagram_account_id
    left join instagram_post_items pi on pi.post_id = p.id and pi.position = 0
    left join instagram_media m on m.id = pi.media_id
    where p.user_id = ${userId}
    order by coalesce(p.scheduled_at_utc, p.created_at) desc
    limit 200
  `;
  return rows.map((row) => ({
    id: row.id as string,
    postType: row.post_type as InstagramPostType,
    status: row.status as InstagramPostStatus,
    caption: (row.caption as string) ?? "",
    scheduledAtUtc: row.scheduled_at_utc ? new Date(row.scheduled_at_utc as string).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    lastErrorSanitized: (row.last_error_sanitized as string | null) ?? null,
    igUsername: (row.ig_username as string | null) ?? null,
    mediaStorageUrl: (row.media_storage_url as string | null) ?? null,
    itemCount: Number(row.item_count ?? 1),
  }));
}

/**
 * Cancela um post — só permitido a partir de status que ainda não
 * publicaram nem estão em processamento na Meta (nunca cancela um
 * PROCESSING: poderia deixar a publicação real "órfã", sem post pra
 * registrar o resultado). A lista de status é uma constante fixa do
 * código (nunca entrada do usuário), então vai inline na query — o driver
 * HTTP do Neon (ver lib/db/client.ts) não tem um jeito testado neste
 * projeto de passar um array JS para `= ANY($1)`, e não há necessidade de
 * arriscar isso por uma lista que nunca muda em tempo de execução.
 * Retorna `false` sem lançar quando o post não existe, não é do usuário,
 * ou está num status que não pode ser cancelado — quem chama decide como
 * comunicar isso.
 */
export async function cancelPost(postId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update instagram_posts
    set status = 'CANCELLED', updated_at = now()
    where id = ${postId} and user_id = ${userId}
      and status in ('DRAFT', 'SCHEDULED', 'NEEDS_REVIEW', 'FAILED')
    returning id
  `;
  return rows.length > 0;
}

/**
 * Reagenda (ou remove o agendamento de) um post ainda não publicado.
 * `scheduledAtUtc: null` volta o post para DRAFT (agendamento removido);
 * uma data marca/atualiza SCHEDULED. Só permitido a partir de DRAFT ou
 * SCHEDULED — um post já em PROCESSING/PUBLISHED/CANCELLED não pode ser
 * reagendado. Retorna `false` sem lançar nos mesmos casos de
 * `cancelPost`.
 */
export async function reschedulePost(
  postId: string,
  userId: string,
  scheduledAtUtc: Date | null,
): Promise<boolean> {
  const db = getDb();
  const status = scheduledAtUtc ? "SCHEDULED" : "DRAFT";
  const scheduledAtIso = scheduledAtUtc ? scheduledAtUtc.toISOString() : null;
  const rows = await db`
    update instagram_posts
    set scheduled_at_utc = ${scheduledAtIso}, status = ${status}, updated_at = now()
    where id = ${postId} and user_id = ${userId} and status in ('DRAFT', 'SCHEDULED')
    returning id
  `;
  return rows.length > 0;
}
