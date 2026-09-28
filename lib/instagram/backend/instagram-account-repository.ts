import "server-only";
import { getDb } from "@/lib/db/client";
import type { AccountDefaultMusic, MusicType } from "@/lib/instagram/backend/music-support";

/**
 * Acesso ao banco para contas do Instagram conectadas (instagram_accounts).
 * Só gravação/consulta — a orquestração da troca de tokens com a Meta fica
 * em instagram-oauth-service.ts.
 *
 * `upsertInstagramAccount` depende da constraint única em `ig_user_id`
 * (migração 0002): uma mesma conta profissional do Instagram só pode estar
 * conectada a um usuário do ALILU por vez — se outro usuário já a tinha
 * conectado, a linha existente é atualizada para o novo dono, em vez de
 * criar uma segunda linha para o mesmo ig_user_id.
 */

export type InstagramAccountStatus = "connected" | "expired" | "revoked" | "error";

const MUSIC_COLUMNS =
  "default_music_enabled, default_music_type, default_music_name, default_music_artist, " +
  "default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name";


export interface UpsertInstagramAccountInput {
  userId: string;
  igUserId: string;
  igUsername: string | null;
  accessTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string[];
}

export interface InstagramAccountRecord {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string | null;
  tokenExpiresAt: Date | null;
  scopes: string | null;
  status: InstagramAccountStatus;
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
 * Insere a conta conectada ou, se `ig_user_id` já existir (de uma conexão
 * anterior, possivelmente de outro usuário), atualiza a linha existente
 * com o novo dono e o novo token. Nunca guarda o access token em texto
 * puro — `accessTokenEncrypted` já deve vir cifrado (ver encryption.ts).
 */
export async function upsertInstagramAccount(
  input: UpsertInstagramAccountInput,
): Promise<InstagramAccountRecord> {
  const db = getDb();
  const scopesValue = input.scopes.join(",");
  const rows = await db`
    insert into instagram_accounts (
      user_id, ig_user_id, ig_username, access_token_encrypted, token_expires_at, scopes, status
    ) values (
      ${input.userId}, ${input.igUserId}, ${input.igUsername}, ${input.accessTokenEncrypted},
      ${input.tokenExpiresAt.toISOString()}, ${scopesValue}, 'connected'
    )
    on conflict (ig_user_id) do update set
      user_id = excluded.user_id,
      ig_username = excluded.ig_username,
      access_token_encrypted = excluded.access_token_encrypted,
      token_expires_at = excluded.token_expires_at,
      scopes = excluded.scopes,
      status = 'connected',
      updated_at = now()
    returning id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
  `;
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
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
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
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
    from instagram_accounts
    where id = ${id} and user_id = ${userId}
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/** Conta conectada mais recente do usuário (um usuário pode, em tese, ter mais de uma no futuro). */
export async function getInstagramAccountForUser(userId: string): Promise<InstagramAccountRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
      default_music_enabled, default_music_type, default_music_name, default_music_artist,
      default_music_external_id, default_music_url, default_audio_file_url, default_audio_file_name
    from instagram_accounts
    where user_id = ${userId}
    order by connected_at desc
    limit 1
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
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
    returning id, user_id, ig_user_id, ig_username, token_expires_at, scopes, status, connected_at, updated_at,
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
