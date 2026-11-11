import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Páginas do Facebook conectadas (facebook_pages). Toda consulta é
 * restrita ao dono (`userId`); o token cifrado só sai daqui pela função
 * de publicação (getFacebookPageTokenForUser) — nunca em listagens.
 */

export type FacebookPageStatus = "connected" | "needs_reconnect" | "revoked";

export interface FacebookPageRecord {
  id: string;
  userId: string;
  pageId: string;
  pageName: string;
  status: FacebookPageStatus;
  hasToken: boolean;
  tasks: string[];
  scopes: string[];
  linkedIgUserId: string | null;
  linkedIgUsername: string | null;
  instagramAccountId: string | null;
  lastErrorSanitized: string | null;
  lastCheckedAt: string | null;
  connectedAt: string;
}

const csv = (value: unknown) => (typeof value === "string" && value ? value.split(",").filter(Boolean) : []);
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

function mapRow(row: Record<string, unknown>): FacebookPageRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    pageId: row.page_id as string,
    pageName: row.page_name as string,
    status: row.status as FacebookPageStatus,
    hasToken: Boolean(row.has_token),
    tasks: csv(row.tasks),
    scopes: csv(row.scopes),
    linkedIgUserId: (row.linked_ig_user_id as string | null) ?? null,
    linkedIgUsername: (row.linked_ig_username as string | null) ?? null,
    instagramAccountId: (row.instagram_account_id as string | null) ?? null,
    lastErrorSanitized: (row.last_error_sanitized as string | null) ?? null,
    lastCheckedAt: iso(row.last_checked_at),
    connectedAt: iso(row.connected_at) ?? new Date(0).toISOString(),
  };
}

export interface UpsertFacebookPageInput {
  userId: string;
  pageId: string;
  pageName: string;
  pageAccessTokenEncrypted: string;
  facebookUserId: string;
  tasks: string[];
  scopes: string[];
  linkedIgUserId: string | null;
  linkedIgUsername: string | null;
  instagramAccountId: string | null;
}

/** Conecta (ou reconecta) uma Página DO PRÓPRIO usuário. Nunca toca em linhas de outro usuário. */
export async function upsertFacebookPage(input: UpsertFacebookPageInput): Promise<FacebookPageRecord> {
  const db = getDb();
  const rows = await db`
    insert into facebook_pages (
      user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, tasks, scopes,
      linked_ig_user_id, linked_ig_username, instagram_account_id, status, last_error_sanitized, last_checked_at
    ) values (
      ${input.userId}, ${input.pageId}, ${input.pageName}, ${input.pageAccessTokenEncrypted}, ${input.facebookUserId},
      ${input.tasks.join(",")}, ${input.scopes.join(",")}, ${input.linkedIgUserId}, ${input.linkedIgUsername},
      ${input.instagramAccountId}, 'connected', null, now()
    )
    on conflict (user_id, page_id) do update set
      page_name = excluded.page_name,
      page_access_token_encrypted = excluded.page_access_token_encrypted,
      facebook_user_id = excluded.facebook_user_id,
      tasks = excluded.tasks,
      scopes = excluded.scopes,
      linked_ig_user_id = excluded.linked_ig_user_id,
      linked_ig_username = excluded.linked_ig_username,
      instagram_account_id = excluded.instagram_account_id,
      status = 'connected', last_error_sanitized = null, last_checked_at = now(),
      connected_at = now(), updated_at = now()
    returning *, (page_access_token_encrypted is not null) as has_token
  `;
  return mapRow(rows[0]);
}

export async function listFacebookPagesForUser(userId: string): Promise<FacebookPageRecord[]> {
  const db = getDb();
  const rows = await db`
    select *, (page_access_token_encrypted is not null) as has_token
    from facebook_pages where user_id = ${userId}
    order by connected_at desc
  `;
  return rows.map(mapRow);
}

export async function getFacebookPageForUser(id: string, userId: string): Promise<FacebookPageRecord | null> {
  const db = getDb();
  const rows = await db`
    select *, (page_access_token_encrypted is not null) as has_token
    from facebook_pages where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Só para a camada de publicação/verificação (server-side). */
export async function getFacebookPageTokenForUser(id: string, userId: string): Promise<{ page: FacebookPageRecord; tokenEncrypted: string | null } | null> {
  const db = getDb();
  const rows = await db`
    select *, (page_access_token_encrypted is not null) as has_token
    from facebook_pages where id = ${id} and user_id = ${userId}
  `;
  if (!rows[0]) return null;
  return { page: mapRow(rows[0]), tokenEncrypted: (rows[0].page_access_token_encrypted as string | null) ?? null };
}

export async function setFacebookPageStatus(id: string, userId: string, status: FacebookPageStatus, error: string | null): Promise<void> {
  const db = getDb();
  await db`
    update facebook_pages set status = ${status}, last_error_sanitized = ${error}, last_checked_at = now(), updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

export async function updateFacebookPageCheck(id: string, userId: string, input: { pageName: string; linkedIgUserId: string | null; linkedIgUsername: string | null }): Promise<void> {
  const db = getDb();
  await db`
    update facebook_pages set page_name = coalesce(nullif(${input.pageName}, ''), page_name),
      linked_ig_user_id = ${input.linkedIgUserId}, linked_ig_username = ${input.linkedIgUsername},
      status = 'connected', last_error_sanitized = null, last_checked_at = now(), updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

/** Desconecta: apaga o token (irreversível) e marca 'revoked'. Destinos pendentes passam a pedir reconexão. */
export async function disconnectFacebookPage(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update facebook_pages set page_access_token_encrypted = null, status = 'revoked', updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}
