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

export type InstagramPostSource = "MANUAL" | "VIRAL_POST";

/** Campos opcionais comuns a todo post criado (origem, template, fuso). */
export interface PostExtraFields {
  /** Origem: editor/compositor manual ou o módulo Posts Virais. Padrão: MANUAL. */
  source?: InstagramPostSource;
  templateId?: string | null;
  /** Estado serializável do editor (sem blob: URLs, sem segredos) — permite reabrir a arte para editar. */
  templateData?: unknown;
  /** Fuso IANA do usuário no momento do agendamento (ex.: America/Sao_Paulo). */
  timezone?: string | null;
}

export interface CreateDraftImagePostInput extends PostExtraFields {
  userId: string;
  instagramAccountId: string;
  mediaId: string;
  caption: string;
  /** Quando informado, o post já nasce `SCHEDULED` (em UTC) em vez de `DRAFT`. */
  scheduledAtUtc?: Date | null;
}

export interface CreateDraftCarouselPostInput extends PostExtraFields {
  userId: string;
  instagramAccountId: string;
  /** De 2 a 10 mídias, JÁ na ordem de exibição — validado em instagram-post-service.ts. */
  mediaIds: string[];
  caption: string;
  scheduledAtUtc?: Date | null;
}

export interface CreateDraftReelPostInput extends PostExtraFields {
  userId: string;
  instagramAccountId: string;
  mediaId: string;
  caption: string;
  scheduledAtUtc?: Date | null;
}

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function serializeTemplateData(templateData: unknown): string | null {
  return templateData === undefined || templateData === null ? null : JSON.stringify(templateData);
}

/**
 * Inserção comum dos três tipos. Post primeiro, itens depois (inserções
 * sequenciais — o driver HTTP não tem transação multi-statement). No pior
 * caso de falha entre elas, o post fica sem itens e a publicação falha de
 * forma segura (getPostForPublish retorna null) — nunca publica algo
 * incompleto.
 */
async function insertPostWithItems(
  base: PostExtraFields & {
    userId: string;
    instagramAccountId: string;
    caption: string;
    scheduledAtUtc?: Date | null;
  },
  postType: InstagramPostType,
  mediaIds: string[],
): Promise<string> {
  const db = getDb();
  const status = base.scheduledAtUtc ? "SCHEDULED" : "DRAFT";
  const scheduledAtIso = base.scheduledAtUtc ? base.scheduledAtUtc.toISOString() : null;
  const source = base.source ?? "MANUAL";
  const timezone = base.timezone || DEFAULT_TIMEZONE;

  const postRows = await db`
    insert into instagram_posts (
      user_id, instagram_account_id, post_type, caption, status, scheduled_at_utc,
      timezone_original, source, template_id, template_data
    )
    values (
      ${base.userId}, ${base.instagramAccountId}, ${postType}, ${base.caption}, ${status}, ${scheduledAtIso},
      ${timezone}, ${source}, ${base.templateId ?? null}, ${serializeTemplateData(base.templateData)}
    )
    returning id
  `;
  const postId = postRows[0].id as string;

  for (let position = 0; position < mediaIds.length; position += 1) {
    await db`
      insert into instagram_post_items (post_id, media_id, position, is_cover)
      values (${postId}, ${mediaIds[position]}, ${position}, ${position === 0})
    `;
  }

  return postId;
}

/** Cria um post de imagem única (DRAFT, ou SCHEDULED se `scheduledAtUtc` for informado). */
export async function createDraftImagePost(input: CreateDraftImagePostInput): Promise<string> {
  return insertPostWithItems(input, "image", [input.mediaId]);
}

/** Cria um rascunho/agendamento de Reel, associado a um único vídeo. */
export async function createDraftReelPost(input: CreateDraftReelPostInput): Promise<string> {
  return insertPostWithItems(input, "reels", [input.mediaId]);
}

/** Cria um carrossel — um item por mídia, na ordem recebida (capa = posição 0). */
export async function createDraftCarouselPost(input: CreateDraftCarouselPostInput): Promise<string> {
  return insertPostWithItems(input, "carousel", input.mediaIds);
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
 * ordem de exibição — usado pela camada única de publicação
 * (instagram-publish-service.ts) para imagem, carrossel e Reel.
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

/**
 * Registra o container criado na Meta (imagem: o único container;
 * carrossel: o container PAI; Reel: o container do vídeo). Só o dono atual
 * do claim (`lockToken`) consegue gravar — um worker cujo claim expirou e
 * foi assumido por outro nunca sobrescreve o estado.
 */
export async function markPostProcessing(postId: string, containerId: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'PROCESSING', meta_container_id = ${containerId}, updated_at = now()
    where id = ${postId} and processing_lock_token = ${lockToken}
  `;
}

/**
 * Marca o post como publicado de verdade — só chamar depois que a Meta
 * confirmar (media_publish devolveu o id, ou o container já consta como
 * PUBLISHED — nesse caso `metaMediaId` pode ser nulo). Libera o claim.
 */
export async function markPostPublished(postId: string, metaMediaId: string | null, lockToken: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'PUBLISHED', meta_media_id = ${metaMediaId}, published_at = now(),
        last_error_sanitized = null, next_attempt_at = null,
        processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${postId} and processing_lock_token = ${lockToken}
  `;
}

/** Falha definitiva, com a mensagem já sanitizada (nunca o erro cru/stack/token). Libera o claim. */
export async function markPostFailed(postId: string, sanitizedError: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'FAILED', last_error_sanitized = ${sanitizedError}, attempts_count = attempts_count + 1,
        next_attempt_at = null, processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${postId} and processing_lock_token = ${lockToken}
  `;
}

/**
 * Falha temporária: devolve o post para SCHEDULED com a próxima tentativa
 * em `nextAttemptAt` (backoff), soma uma tentativa e libera o claim. O
 * container já criado (se houver) é preservado — a próxima tentativa
 * retoma o mesmo container em vez de criar outro (evita duplicidade).
 */
export async function schedulePostRetry(
  postId: string,
  sanitizedError: string,
  nextAttemptAt: Date,
  lockToken: string,
): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set status = 'SCHEDULED', last_error_sanitized = ${sanitizedError}, attempts_count = attempts_count + 1,
        scheduled_at_utc = coalesce(scheduled_at_utc, now()), next_attempt_at = ${nextAttemptAt.toISOString()},
        processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${postId} and processing_lock_token = ${lockToken}
  `;
}

/**
 * O container ainda está processando na Meta (comum em Reels): mantém
 * PROCESSING, libera o claim e marca quando o scheduler pode retomar.
 */
export async function releasePostForResume(postId: string, nextAttemptAt: Date, lockToken: string): Promise<void> {
  const db = getDb();
  await db`
    update instagram_posts
    set next_attempt_at = ${nextAttemptAt.toISOString()},
        processing_lock_token = null, processing_lock_expires_at = null, updated_at = now()
    where id = ${postId} and processing_lock_token = ${lockToken} and status = 'PROCESSING'
  `;
}

export interface ClaimedPost {
  id: string;
  userId: string;
  postType: InstagramPostType;
  scheduledAtUtc: string | null;
  processingStartedAt: string | null;
  attemptsCount: number;
}

function mapClaimedRow(row: Record<string, unknown>): ClaimedPost {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    postType: row.post_type as InstagramPostType,
    scheduledAtUtc: row.scheduled_at_utc ? new Date(row.scheduled_at_utc as string).toISOString() : null,
    processingStartedAt: row.processing_started_at
      ? new Date(row.processing_started_at as string).toISOString()
      : null,
    attemptsCount: Number(row.attempts_count ?? 0),
  };
}

/**
 * CLAIM ATÔMICO para publicação manual ("Publicar agora" / "Tentar
 * novamente"). Um único UPDATE condicional: o Postgres garante que, se
 * duas requisições (ou uma requisição e o scheduler) tentarem ao mesmo
 * tempo, só UMA encontra a linha ainda elegível — a outra recebe zero
 * linhas e não publica. Elegível: DRAFT, SCHEDULED, FAILED, ou PROCESSING
 * sem dono (claim expirado / retomada de container em processamento).
 * A partir de FAILED ("Tentar novamente") o container antigo é descartado
 * e o contador de tentativas volta a zero.
 */
export async function claimPostForManualPublish(
  postId: string,
  userId: string,
  lockToken: string,
  lockTtlSeconds: number,
): Promise<ClaimedPost | null> {
  const db = getDb();
  const rows = await db`
    update instagram_posts
    set status = 'PROCESSING',
        meta_container_id = case when status = 'FAILED' then null else meta_container_id end,
        last_error_sanitized = case when status = 'FAILED' then null else last_error_sanitized end,
        attempts_count = case when status = 'FAILED' then 0 else attempts_count end,
        processing_started_at = case when status = 'PROCESSING' then coalesce(processing_started_at, now()) else now() end,
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        last_attempt_at = now(), next_attempt_at = null, updated_at = now()
    where id = ${postId} and user_id = ${userId}
      and (
        status in ('DRAFT', 'SCHEDULED', 'FAILED')
        or (status = 'PROCESSING' and (processing_lock_token is null or processing_lock_expires_at < now()))
      )
    returning id, user_id, post_type, scheduled_at_utc, processing_started_at, attempts_count
  `;
  return rows[0] ? mapClaimedRow(rows[0]) : null;
}

/**
 * CLAIM ATÔMICO do scheduler: pega a próxima publicação vencida (ou um
 * processamento a retomar) com `FOR UPDATE SKIP LOCKED` — duas instâncias
 * do scheduler rodando juntas nunca pegam a mesma linha — e já a marca
 * PROCESSING com um lock próprio, tudo num único statement. A condição é
 * repetida no UPDATE externo para o caso de a linha mudar entre a
 * subconsulta e a escrita (cancelamento/edição concorrente): se deixou de
 * ser elegível, nada é alterado e nada é publicado.
 */
export async function claimNextDuePost(lockToken: string, lockTtlSeconds: number): Promise<ClaimedPost | null> {
  const db = getDb();
  const rows = await db`
    update instagram_posts p
    set status = 'PROCESSING',
        processing_started_at = case when p.status = 'SCHEDULED' then now() else coalesce(p.processing_started_at, now()) end,
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        last_attempt_at = now(), updated_at = now()
    where p.id = (
      select c.id from instagram_posts c
      where (
          (c.status = 'SCHEDULED' and c.scheduled_at_utc <= now())
          or (c.status = 'PROCESSING' and (c.processing_lock_token is null or c.processing_lock_expires_at < now()))
        )
        and (c.next_attempt_at is null or c.next_attempt_at <= now())
      order by coalesce(c.next_attempt_at, c.scheduled_at_utc, c.updated_at) asc
      limit 1
      for update skip locked
    )
    and (
      (p.status = 'SCHEDULED' and p.scheduled_at_utc <= now())
      or (p.status = 'PROCESSING' and (p.processing_lock_token is null or p.processing_lock_expires_at < now()))
    )
    and (p.next_attempt_at is null or p.next_attempt_at <= now())
    returning p.id, p.user_id, p.post_type, p.scheduled_at_utc, p.processing_started_at, p.attempts_count
  `;
  return rows[0] ? mapClaimedRow(rows[0]) : null;
}

/** Status atual (restrito ao dono) — usado para responder quando um claim não é obtido. */
export async function getPostStatusForUser(postId: string, userId: string): Promise<InstagramPostStatus | null> {
  const db = getDb();
  const rows = await db`
    select status from instagram_posts where id = ${postId} and user_id = ${userId}
  `;
  return rows[0] ? (rows[0].status as InstagramPostStatus) : null;
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
  /** Fuso IANA em que o usuário agendou — a tela exibe o horário nesse fuso. */
  timezone: string;
  source: InstagramPostSource;
  templateId: string | null;
  /** true quando a arte pode ser reaberta no editor (template_data salvo). */
  hasTemplateData: boolean;
  attemptsCount: number;
  nextAttemptAt: string | null;
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
      p.timezone_original, p.source, p.template_id, (p.template_data is not null) as has_template_data,
      p.attempts_count, p.next_attempt_at,
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
    timezone: (row.timezone_original as string | null) || DEFAULT_TIMEZONE,
    source: ((row.source as string | null) ?? "MANUAL") as InstagramPostSource,
    templateId: (row.template_id as string | null) ?? null,
    hasTemplateData: Boolean(row.has_template_data),
    attemptsCount: Number(row.attempts_count ?? 0),
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at as string).toISOString() : null,
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
    set status = 'CANCELLED', next_attempt_at = null, updated_at = now()
    where id = ${postId} and user_id = ${userId}
      and status in ('DRAFT', 'SCHEDULED', 'NEEDS_REVIEW', 'FAILED')
    returning id
  `;
  return rows.length > 0;
}

/**
 * Exclui do histórico do ALILU sem prometer apagar nada no Instagram.
 * PROCESSING fica bloqueado para evitar perder o registro enquanto a Meta
 * ainda pode concluir ou falhar a publicação.
 */
export async function deletePostForUser(postId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    delete from instagram_posts
    where id = ${postId} and user_id = ${userId} and status <> 'PROCESSING'
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
  timezone?: string | null,
): Promise<boolean> {
  const db = getDb();
  const status = scheduledAtUtc ? "SCHEDULED" : "DRAFT";
  const scheduledAtIso = scheduledAtUtc ? scheduledAtUtc.toISOString() : null;
  const rows = await db`
    update instagram_posts
    set scheduled_at_utc = ${scheduledAtIso}, status = ${status},
        timezone_original = coalesce(${timezone ?? null}, timezone_original),
        next_attempt_at = null, attempts_count = 0, updated_at = now()
    where id = ${postId} and user_id = ${userId} and status in ('DRAFT', 'SCHEDULED')
    returning id
  `;
  return rows.length > 0;
}

export interface UpdatePostContentInput {
  caption?: string;
  /** `undefined` = mantém; `null` = sem agendamento (DRAFT); data = SCHEDULED. */
  scheduledAtUtc?: Date | null;
  timezone?: string | null;
  templateId?: string | null;
  templateData?: unknown;
  /** Substitui TODAS as mídias do post (mesma ordem). Posse/tipo já validados no service. */
  mediaIds?: string[];
}

/**
 * Edita uma publicação ainda não enviada (DRAFT, SCHEDULED ou FAILED).
 * PROCESSING/PUBLISHED/CANCELLED são recusados de forma atômica pela
 * própria condição do UPDATE.
 *
 * Quando as mídias mudam, a troca acontece em três passos seguros:
 *   1. UPDATE atômico que "estaciona" o post em DRAFT (fora do alcance do
 *      scheduler) — se falhar a condição de status, nada é alterado;
 *   2. troca dos itens;
 *   3. UPDATE final com o status/agendamento desejado.
 * Se algo quebrar no meio, o post fica em DRAFT — nunca é publicado com
 * mídias pela metade. Qualquer edição descarta o container antigo da Meta
 * (o scheduler sempre publica a versão nova) e zera as tentativas.
 */
export async function updatePostContent(
  postId: string,
  userId: string,
  input: UpdatePostContentInput,
): Promise<{ status: InstagramPostStatus } | null> {
  const db = getDb();

  const parked = await db`
    update instagram_posts
    set status = 'DRAFT', updated_at = now()
    where id = ${postId} and user_id = ${userId} and status in ('DRAFT', 'SCHEDULED', 'FAILED')
    returning scheduled_at_utc, caption, template_id, template_data, timezone_original
  `;
  const current = parked[0];
  if (!current) return null;

  if (input.mediaIds && input.mediaIds.length > 0) {
    await db`delete from instagram_post_items where post_id = ${postId}`;
    for (let position = 0; position < input.mediaIds.length; position += 1) {
      await db`
        insert into instagram_post_items (post_id, media_id, position, is_cover)
        values (${postId}, ${input.mediaIds[position]}, ${position}, ${position === 0})
      `;
    }
  }

  const scheduledAtIso =
    input.scheduledAtUtc === undefined
      ? current.scheduled_at_utc
        ? new Date(current.scheduled_at_utc as string).toISOString()
        : null
      : input.scheduledAtUtc
        ? input.scheduledAtUtc.toISOString()
        : null;
  // Um agendamento vencido (ex.: FAILED editado sem mudar a data) vira rascunho,
  // para nunca disparar sozinho algo que o usuário não reagendou.
  const status: InstagramPostStatus =
    scheduledAtIso && new Date(scheduledAtIso).getTime() > Date.now() ? "SCHEDULED" : "DRAFT";
  const caption = input.caption ?? ((current.caption as string) ?? "");
  const templateId = input.templateId === undefined ? ((current.template_id as string | null) ?? null) : input.templateId;
  const templateData =
    input.templateData === undefined
      ? current.template_data === null || current.template_data === undefined
        ? null
        : typeof current.template_data === "string"
          ? (current.template_data as string)
          : JSON.stringify(current.template_data)
      : serializeTemplateData(input.templateData);
  const timezone = input.timezone || (current.timezone_original as string | null) || DEFAULT_TIMEZONE;

  await db`
    update instagram_posts
    set caption = ${caption}, scheduled_at_utc = ${status === "SCHEDULED" ? scheduledAtIso : null}, status = ${status},
        template_id = ${templateId}, template_data = ${templateData}, timezone_original = ${timezone},
        meta_container_id = null, last_error_sanitized = null, attempts_count = 0, next_attempt_at = null,
        updated_at = now()
    where id = ${postId} and user_id = ${userId} and status = 'DRAFT'
  `;
  return { status };
}

export interface PostDetails {
  id: string;
  postType: InstagramPostType;
  status: InstagramPostStatus;
  caption: string;
  scheduledAtUtc: string | null;
  timezone: string;
  source: InstagramPostSource;
  templateId: string | null;
  templateData: unknown;
  igUsername: string | null;
  items: Array<{ mediaId: string; storageUrl: string; mediaType: "image" | "video"; position: number }>;
}

/** Detalhes para a tela de edição — restrito ao dono, nunca inclui token. */
export async function getPostDetailsForUser(postId: string, userId: string): Promise<PostDetails | null> {
  const db = getDb();
  const rows = await db`
    select
      p.id, p.post_type, p.status, p.caption, p.scheduled_at_utc, p.timezone_original, p.source,
      p.template_id, p.template_data, a.ig_username,
      pi.media_id, pi.position, m.storage_url, m.media_type
    from instagram_posts p
    join instagram_accounts a on a.id = p.instagram_account_id
    left join instagram_post_items pi on pi.post_id = p.id
    left join instagram_media m on m.id = pi.media_id
    where p.id = ${postId} and p.user_id = ${userId}
    order by pi.position asc
  `;
  const first = rows[0];
  if (!first) return null;
  const rawTemplateData = first.template_data;
  return {
    id: first.id as string,
    postType: first.post_type as InstagramPostType,
    status: first.status as InstagramPostStatus,
    caption: (first.caption as string) ?? "",
    scheduledAtUtc: first.scheduled_at_utc ? new Date(first.scheduled_at_utc as string).toISOString() : null,
    timezone: (first.timezone_original as string | null) || DEFAULT_TIMEZONE,
    source: ((first.source as string | null) ?? "MANUAL") as InstagramPostSource,
    templateId: (first.template_id as string | null) ?? null,
    templateData: typeof rawTemplateData === "string" ? JSON.parse(rawTemplateData) : (rawTemplateData ?? null),
    igUsername: (first.ig_username as string | null) ?? null,
    items: rows
      .filter((row) => row.media_id)
      .map((row) => ({
        mediaId: row.media_id as string,
        storageUrl: row.storage_url as string,
        mediaType: row.media_type as "image" | "video",
        position: row.position as number,
      })),
  };
}
