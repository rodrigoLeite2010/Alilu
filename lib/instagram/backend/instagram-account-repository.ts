import "server-only";
import { getDb } from "@/lib/db/client";
import type { AccountDefaultMusic, MusicType } from "@/lib/instagram/backend/music-support";

/**
 * Acesso ao banco para contas do Instagram conectadas (instagram_accounts).
 * Só gravação/consulta — a orquestração da troca de tokens com a Meta fica
 * em instagram-oauth-service.ts.
 *
 * `upsertInstagramAccount` depende da constraint única em `ig_user_id`
 * (migração 0002): uma mesma conta profissional só pode ter uma conexão.
 * Uma tentativa por outro usuário é rejeitada e não transfere a linha.
 */

export type InstagramAccountStatus = "connected" | "expired" | "revoked" | "error";

export interface UpsertInstagramAccountInput {
  userId: string;
  igUserId: string;
  igUsername: string | null;
  accessTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string[];
  authProvider?: "instagram_login" | "facebook_login";
  facebookPageId?: string | null;
  facebookUserId?: string | null;
  facebookUserTokenEncrypted?: string | null;
  facebookUserTokenExpiresAt?: Date | null;
}

export interface InstagramAccountRecord {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string | null;
  tokenExpiresAt: Date | null;
  scopes: string | null;
  status: InstagramAccountStatus;
  authProvider: "instagram_login" | "facebook_login";
  connectedAt: Date;
  updatedAt: Date;
  /** Música padrão da conta ("Música padrão para publicações") — ver lib/instagram/backend/music-support.ts. */
  defaultMusic: AccountDefaultMusic;
}

function mapRow(row: Record<string, unknown>): InstagramAccountRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    igUserId: row.ig_user_id as string,
    igUsername: (row.ig_username as string | null) ?? null,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at as string) : null,
    scopes: (row.scopes as string | null) ?? null,
    status: row.status as InstagramAccountStatus,
    authProvider: (row.auth_provider as "instagram_login" | "facebook_login" | undefined) ?? "instagram_login",
    connectedAt: new Date(row.connected_at as string),
    updatedAt: new Date(row.updated_at as string),
    defaultMusic: {
      enabled: Boolean(row.default_music_enabled),
      type: (row.default_music_type as MusicType | null) ?? "None",
      name: (row.default_music_name as string | null) ?? null,
      artist: (row.default_music_artist as string | null) ?? null,
      externalId: (row.default_music_external_id as string | null) ?? null,
      url: (row.default_music_url as string | null) ?? null,
      audioFileUrl: (row.default_audio_file_url as string | null) ?? null,
      audioFileName: (row.default_audio_file_name as string | null) ?? null,
    },
  };
}

/**
 * Insere a conta conectada ou atualiza a conexão do mesmo usuário. Uma
 * identidade Instagram já vinculada a outro usuário nunca é transferida.
 * Nunca guarda o access token em texto
 * puro — `accessTokenEncrypted` já deve vir cifrado (ver encryption.ts).
 */
export async function upsertInstagramAccount(
  input: UpsertInstagramAccountInput,
): Promise<InstagramAccountRecord> {
  const db = getDb();
  const scopesValue = input.scopes.join(",");
  const rows = await db`
    insert into instagram_accounts (
      user_id, ig_user_id, ig_username, access_token_encrypted, token_expires_at, scopes, status,
      auth_provider, facebook_page_id, facebook_user_id, facebook_user_token_encrypted, facebook_user_token_expires_at
    ) values (
      ${input.userId}, ${input.igUserId}, ${input.igUsername}, ${input.accessTokenEncrypted},
      ${input.tokenExpiresAt.toISOString()}, ${scopesValue}, 'connected', ${input.authProvider ?? "instagram_login"},
      ${input.facebookPageId ?? null}, ${input.facebookUserId ?? null}, ${input.facebookUserTokenEncrypted ?? null},
      ${input.facebookUserTokenExpiresAt?.toISOString() ?? null}
    )
    on conflict (ig_user_id) do update set
      ig_username = excluded.ig_username,
      access_token_encrypted = excluded.access_token_encrypted,
      token_expires_at = excluded.token_expires_at,
      scopes = excluded.scopes,
      auth_provider = excluded.auth_provider,
      facebook_page_id = excluded.facebook_page_id,
      facebook_user_id = excluded.facebook_user_id,
      facebook_user_token_encrypted = excluded.facebook_user_token_encrypted,
      facebook_user_token_expires_at = excluded.facebook_user_token_expires_at,
      status = 'connected',
      -- Reconectar uma conta a torna a conta "atual": as telas e as publicações usam
      -- a de connected_at mais recente (getInstagramAccountForUser). Sem isto, reconectar
      -- @alilu.tec com a @pessoal conectada depois continuava mostrando a pessoal.
      connected_at = now(),
      updated_at = now()
    where instagram_accounts.user_id = excluded.user_id
    returning id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
      auth_provider,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
  `;
  if (!rows[0]) throw new Error("Esta conta do Instagram já está vinculada a outro usuário Alilu.");
  return mapRow(rows[0]);
}

/**
 * TODAS as contas do Instagram conectadas do usuário, mais recente
 * primeiro — usado pelo Piloto Automático de Conteúdo (seleção de conta
 * na criação/edição de uma automação, seção 3 do briefing). Diferente de
 * getInstagramAccountForUser (que devolve só a mais recente, usada pelo
 * restante do app hoje), esta função já existe pensando em multi-conta:
 * mesmo com uma única conta real conectada (@alilu.tec), a tela passa a
 * listar "contas disponíveis" em vez de assumir uma única.
 */
export async function listInstagramAccountsForUser(userId: string): Promise<InstagramAccountRecord[]> {
  const db = getDb();
  const rows = await db`
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, auth_provider, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
    from instagram_accounts
    where user_id = ${userId}
    order by connected_at desc
  `;
  return rows.map(mapRow);
}

/** Uma conta específica do usuário (posse validada) — usado ao criar/editar uma automação. */
export async function getInstagramAccountByIdForUser(id: string, userId: string): Promise<InstagramAccountRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, auth_provider, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
    from instagram_accounts
    where id = ${id} and user_id = ${userId}
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Conta "principal" do usuário (multi-conta): a conectada mais recente/escolhida
 * como principal. Contas desconectadas só voltam se não houver nenhuma conectada —
 * assim desconectar @alilu não derruba as telas que publicam na @outra.
 */
export async function getInstagramAccountForUser(userId: string): Promise<InstagramAccountRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, auth_provider, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
    from instagram_accounts
    where user_id = ${userId}
    order by (status = 'connected') desc, connected_at desc
    limit 1
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * "Usar como principal": a conta principal é a de connected_at mais recente
 * (ver getInstagramAccountForUser), então basta trazê-la para agora. Só para
 * contas conectadas do próprio usuário.
 */
export async function setPrimaryInstagramAccount(accountId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update instagram_accounts set connected_at = now(), updated_at = now()
    where id = ${accountId} and user_id = ${userId} and status = 'connected'
    returning id
  `;
  return rows.length > 0;
}

export interface UpdateAccountDefaultMusicInput {
  enabled: boolean;
  type: MusicType;
  name: string | null;
  artist: string | null;
  externalId: string | null;
  url: string | null;
  audioFileUrl: string | null;
  audioFileName: string | null;
}

/**
 * Grava a configuração de "Música padrão para publicações" da conta —
 * restrito ao dono (`userId`), igual às demais funções deste arquivo.
 * Passar `enabled: false` (ou `type: "None"`) não apaga os outros campos
 * sozinho — quem quer limpar tudo usa `removeInstagramAccountDefaultMusic`
 * (botão "Remover música padrão" da tela de contas).
 */
export async function updateInstagramAccountDefaultMusic(
  accountId: string,
  userId: string,
  input: UpdateAccountDefaultMusicInput,
): Promise<InstagramAccountRecord | null> {
  const db = getDb();
  const rows = await db`
    update instagram_accounts
    set default_music_enabled = ${input.enabled},
        default_music_type = ${input.type},
        default_music_name = ${input.name},
        default_music_artist = ${input.artist},
        default_music_external_id = ${input.externalId},
        default_music_url = ${input.url},
        default_audio_file_url = ${input.audioFileUrl},
        default_audio_file_name = ${input.audioFileName},
        updated_at = now()
    where id = ${accountId} and user_id = ${userId}
    returning id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, auth_provider, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/** "Remover música padrão": volta a conta para o estado sem nenhuma música configurada. */
export async function removeInstagramAccountDefaultMusic(
  accountId: string,
  userId: string,
): Promise<InstagramAccountRecord | null> {
  return updateInstagramAccountDefaultMusic(accountId, userId, {
    enabled: false,
    type: "None",
    name: null,
    artist: null,
    externalId: null,
    url: null,
    audioFileUrl: null,
    audioFileName: null,
  });
}

/** Contas com token perto de vencer (≤ 15 dias), com ≥ 24 h desde a última gravação — regra da Meta para renovar. */
export async function listAccountsNeedingTokenRefresh(
  now: Date,
  limit: number,
): Promise<Array<{ id: string; userId: string; accessTokenEncrypted: string; authProvider: "instagram_login" | "facebook_login"; facebookPageId: string | null; facebookUserTokenEncrypted: string | null }>> {
  const db = getDb();
  const rows = await db`
    select id, user_id, access_token_encrypted, auth_provider, facebook_page_id, facebook_user_token_encrypted from instagram_accounts
    where status = 'connected' and access_token_encrypted <> ''
      and token_expires_at is not null
      and token_expires_at > ${now.toISOString()}
      and token_expires_at < ${new Date(now.getTime() + 15 * 86_400_000).toISOString()}
      and updated_at < ${new Date(now.getTime() - 24 * 3600_000).toISOString()}
    order by token_expires_at
    limit ${limit}
  `;
  return rows.map((row) => ({ id: row.id as string, userId: row.user_id as string, accessTokenEncrypted: row.access_token_encrypted as string,
    authProvider: (row.auth_provider as "instagram_login" | "facebook_login") ?? "instagram_login", facebookPageId: row.facebook_page_id as string | null,
    facebookUserTokenEncrypted: row.facebook_user_token_encrypted as string | null }));
}

export async function updateInstagramAccountToken(id: string, accessTokenEncrypted: string, tokenExpiresAt: Date, facebookUserTokenEncrypted?: string | null, facebookUserTokenExpiresAt?: Date | null): Promise<void> {
  const db = getDb();
  await db`
    update instagram_accounts set access_token_encrypted = ${accessTokenEncrypted}, token_expires_at = ${tokenExpiresAt.toISOString()},
      facebook_user_token_encrypted = coalesce(${facebookUserTokenEncrypted ?? null}, facebook_user_token_encrypted),
      facebook_user_token_expires_at = coalesce(${facebookUserTokenExpiresAt?.toISOString() ?? null}, facebook_user_token_expires_at),
      status = 'connected', updated_at = now()
    where id = ${id}
  `;
}

export async function setInstagramAccountStatus(id: string, status: InstagramAccountStatus): Promise<void> {
  const db = getDb();
  await db`update instagram_accounts set status = ${status}, updated_at = now() where id = ${id}`;
}

/** Token já vencido → "expired" (a tela pede para reconectar). Devolve quantas contas mudaram. */
export async function markExpiredInstagramAccounts(now: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    update instagram_accounts set status = 'expired', updated_at = now()
    where status = 'connected' and token_expires_at is not null and token_expires_at <= ${now.toISOString()}
    returning id
  `;
  return rows.length;
}

/**
 * "Desconectar Instagram": apaga o token (nunca fica guardado depois que a
 * pessoa desconecta) e marca a conta como revogada. A linha continua
 * existindo porque publicações e automações antigas apontam para ela;
 * reconectar a mesma conta reaproveita a linha (upsert por ig_user_id).
 */
export async function disconnectInstagramAccountsForUser(userId: string, accountId?: string | null): Promise<number> {
  const db = getDb();
  const rows = accountId
    ? await db`
        update instagram_accounts set status = 'revoked', access_token_encrypted = '', facebook_user_token_encrypted = null, token_expires_at = null, facebook_user_token_expires_at = null, updated_at = now()
        where user_id = ${userId} and id = ${accountId} returning id
      `
    : await db`
        update instagram_accounts set status = 'revoked', access_token_encrypted = '', facebook_user_token_encrypted = null, token_expires_at = null, facebook_user_token_expires_at = null, updated_at = now()
        where user_id = ${userId} and status <> 'revoked' returning id
      `;
  return rows.length;
}
