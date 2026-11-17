import "server-only";
import { getDb } from "@/lib/db/client";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { INSTAGRAM_OAUTH_SCOPES, getInstagramRedirectUri } from "@/lib/instagram/backend/instagram-oauth-config";
import {
  describeMetaError,
  fetchInstagramProfileDetails,
  fetchPublishedMedia,
  type InstagramApiMode,
  type InstagramProfileDetails,
  type PublishedMediaInfo,
} from "@/lib/instagram/backend/meta-graph-client";
import { CHECKLIST_ORDER, MANUAL_KEYS, computeChecklist, permissionMatrix, type ChecklistKey } from "@/lib/instagram/meta-app-review/checklist";

/**
 * Painel Meta App Review — Instagram (/admin/meta-app-review).
 *
 * NÃO é um fluxo paralelo: conexão = OAuth existente (Instagram Login);
 * publicação = rotas e publicador existentes (/api/instagram/posts e
 * /api/instagram/posts/[id]/publish). Aqui ficam só a sessão de gravação,
 * as consultas REAIS de conferência (GET /me e GET /{media-id}) e o
 * checklist. Nenhum token sai deste módulo.
 */

export class MetaReviewError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 400,
    readonly code = "INVALID",
  ) {
    super(message);
    this.name = "MetaReviewError";
  }
}

type Row = Record<string, unknown>;
const toDate = (value: unknown): Date | null => (value ? new Date(value as string) : null);
const iso = (value: unknown) => toDate(value)?.toISOString() ?? null;
const json = <T>(value: unknown): T | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadSession(userId: string): Promise<Row> {
  const db = getDb();
  const rows = await db`
    insert into meta_app_review_sessions (user_id) values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning *
  `;
  return rows[0];
}

/** Mensagem da Meta (código/subcódigo), sem token. */
function metaErrorText(error: unknown): string {
  const meta = describeMetaError((error as { details?: unknown })?.details);
  const parts = [meta.message ?? (error as Error)?.message ?? "Erro desconhecido", meta.code !== null ? `code ${meta.code}` : null, meta.subcode !== null ? `subcode ${meta.subcode}` : null];
  return parts.filter(Boolean).join(" · ").slice(0, 400);
}

async function loadAccountWithToken(userId: string, accountId: string) {
  const db = getDb();
  const rows = await db`
    select id, ig_user_id, ig_username, status, auth_provider, access_token_encrypted
    from instagram_accounts where id = ${accountId} and user_id = ${userId}
  `;
  return rows[0] ?? null;
}

// ─────────────────────────── Ações ───────────────────────────

export async function startRecordingSession(userId: string, now: Date = new Date()): Promise<void> {
  await loadSession(userId);
  const db = getDb();
  await db`
    update meta_app_review_sessions set started_at = ${now.toISOString()}, manual_checks = '{}'::jsonb, profile = null, profile_checked_at = null,
      profile_error = null, publish_post_id = null, publish_verified = null, publish_verified_at = null, publish_error = null, updated_at = now()
    where user_id = ${userId}
  `;
}

export async function setManualCheck(userId: string, key: string, done: boolean, now: Date = new Date()): Promise<void> {
  if (!MANUAL_KEYS.includes(key as ChecklistKey)) throw new MetaReviewError("Este item é verificado automaticamente pelo sistema e não pode ser marcado à mão.", 400, "NOT_MANUAL");
  await loadSession(userId);
  const db = getDb();
  if (done) {
    await db`
      update meta_app_review_sessions set manual_checks = manual_checks || jsonb_build_object(${key}::text, ${now.toISOString()}::text), updated_at = now()
      where user_id = ${userId}
    `;
  } else {
    await db`update meta_app_review_sessions set manual_checks = manual_checks - ${key}::text, updated_at = now() where user_id = ${userId}`;
  }
}

/** Consulta REAL GET /me (instagram_business_basic) e guarda só os campos devolvidos. */
export async function refreshAccountProfile(
  userId: string,
  accountId: string,
  now: Date = new Date(),
): Promise<{ ok: true; profile: InstagramProfileDetails } | { ok: false; error: string }> {
  if (!UUID.test(accountId)) throw new MetaReviewError("Conta não encontrada.", 404, "NOT_FOUND");
  const account = await loadAccountWithToken(userId, accountId);
  if (!account) throw new MetaReviewError("Conta não encontrada.", 404, "NOT_FOUND");
  await loadSession(userId);
  const db = getDb();
  if (account.status !== "connected" || !account.access_token_encrypted) {
    const error = "A conta não está conectada (token ausente ou expirado). Reconecte pelo botão Connect Instagram.";
    await db`update meta_app_review_sessions set instagram_account_id = ${accountId}, profile = null, profile_checked_at = ${now.toISOString()}, profile_error = ${error}, updated_at = now() where user_id = ${userId}`;
    return { ok: false, error };
  }
  try {
    const profile = await fetchInstagramProfileDetails(decryptSecret(account.access_token_encrypted as string), account.auth_provider as InstagramApiMode);
    await db`
      update meta_app_review_sessions set instagram_account_id = ${accountId}, profile = ${JSON.stringify(profile)}::jsonb,
        profile_checked_at = ${now.toISOString()}, profile_error = null, updated_at = now()
      where user_id = ${userId}
    `;
    return { ok: true, profile };
  } catch (error) {
    const message = metaErrorText(error);
    await db`
      update meta_app_review_sessions set instagram_account_id = ${accountId}, profile = null, profile_checked_at = ${now.toISOString()},
        profile_error = ${message}, updated_at = now()
      where user_id = ${userId}
    `;
    return { ok: false, error: message };
  }
}

/** Registra o Reel de demonstração criado pelas rotas EXISTENTES (precisa ser do próprio admin). */
export async function setDemoPost(userId: string, postId: string): Promise<void> {
  if (!UUID.test(postId)) throw new MetaReviewError("Publicação não encontrada.", 404, "NOT_FOUND");
  const db = getDb();
  const rows = await db`select id, post_type from instagram_posts where id = ${postId} and user_id = ${userId}`;
  if (!rows[0]) throw new MetaReviewError("Publicação não encontrada.", 404, "NOT_FOUND");
  if (rows[0].post_type !== "reels") throw new MetaReviewError("A demonstração usa um Reel.");
  await loadSession(userId);
  await db`
    update meta_app_review_sessions set publish_post_id = ${postId}, publish_verified = null, publish_verified_at = null, publish_error = null, updated_at = now()
    where user_id = ${userId}
  `;
}

/**
 * Confirma a publicação NA API (GET /{media-id}): só depois disso o painel
 * mostra "Reel published successfully." e o link "View on Instagram".
 */
export async function verifyDemoPublication(
  userId: string,
  now: Date = new Date(),
): Promise<{ ok: true; media: PublishedMediaInfo } | { ok: false; error: string }> {
  const session = await loadSession(userId);
  const postId = session.publish_post_id as string | null;
  if (!postId) throw new MetaReviewError("Nenhuma publicação de demonstração nesta sessão.", 409, "NO_POST");
  const db = getDb();
  const rows = await db`
    select p.status, p.meta_media_id, a.access_token_encrypted, a.auth_provider
    from instagram_posts p join instagram_accounts a on a.id = p.instagram_account_id
    where p.id = ${postId} and p.user_id = ${userId}
  `;
  const post = rows[0];
  if (!post) throw new MetaReviewError("Publicação não encontrada.", 404, "NOT_FOUND");
  if (post.status !== "PUBLISHED" || !post.meta_media_id) {
    return { ok: false, error: `A publicação ainda não foi concluída (status ${post.status}).` };
  }
  if (!post.access_token_encrypted) return { ok: false, error: "A conta foi desconectada: reconecte para consultar a publicação." };
  try {
    const media = await fetchPublishedMedia(post.meta_media_id as string, decryptSecret(post.access_token_encrypted as string), post.auth_provider as InstagramApiMode);
    await db`
      update meta_app_review_sessions set publish_verified = ${JSON.stringify(media)}::jsonb, publish_verified_at = ${now.toISOString()}, publish_error = null, updated_at = now()
      where user_id = ${userId}
    `;
    return { ok: true, media };
  } catch (error) {
    const message = metaErrorText(error);
    await db`update meta_app_review_sessions set publish_error = ${message}, updated_at = now() where user_id = ${userId}`;
    return { ok: false, error: message };
  }
}

// ─────────────────────────── Painel ───────────────────────────

export async function getReviewOverview(userId: string) {
  const session = await loadSession(userId);
  const db = getDb();
  const startedAt = toDate(session.started_at)!;

  const accounts = await db`
    select id, ig_user_id, ig_username, status, auth_provider, scopes, token_expires_at, connected_at, updated_at
    from instagram_accounts where user_id = ${userId} order by updated_at desc
  `;
  const events = await db`
    select stage, outcome, message, error_code, error_type, created_at from instagram_oauth_events
    where user_id = ${userId} and created_at >= ${startedAt.toISOString()}::timestamptz - interval '1 day'
    order by created_at desc limit 60
  `;
  const videos = await db`
    select id, storage_url, original_filename, created_at from instagram_media
    where user_id = ${userId} and media_type = 'video' order by created_at desc limit 12
  `;

  const postId = (session.publish_post_id as string | null) ?? null;
  const postRows = postId
    ? await db`
        select p.id, p.caption, p.status, p.published_at, p.meta_media_id, p.last_error_sanitized, p.created_at, p.instagram_account_id,
          exists (select 1 from instagram_post_items pi join instagram_media m on m.id = pi.media_id where pi.post_id = p.id and m.media_type = 'video') as has_video
        from instagram_posts p where p.id = ${postId} and p.user_id = ${userId}
      `
    : [];
  const post = postRows[0] ?? null;

  const selectedId = (session.instagram_account_id as string | null) ?? null;
  const selected =
    accounts.find((row) => row.id === selectedId) ??
    accounts.find((row) => row.status === "connected" && row.auth_provider === "instagram_login") ??
    accounts[0] ??
    null;
  const scopesOf = (row: Row | null) => (row?.scopes ? String(row.scopes).split(",").map((item) => item.trim()).filter(Boolean) : []);

  const profile = json<InstagramProfileDetails>(session.profile);
  const verified = json<PublishedMediaInfo>(session.publish_verified);
  const checklist = computeChecklist({
    sessionStartedAt: startedAt,
    manualChecks: json<Partial<Record<ChecklistKey, string>>>(session.manual_checks) ?? {},
    oauthEvents: events.map((row) => ({ message: (row.message as string | null) ?? null, outcome: row.outcome as string, at: toDate(row.created_at)! })),
    account: selected
      ? { status: selected.status as string, scopes: scopesOf(selected), authProvider: (selected.auth_provider as string) ?? "instagram_login", updatedAt: toDate(selected.updated_at)! }
      : null,
    profileCheckedAt: toDate(session.profile_checked_at),
    profileOk: Boolean(profile) && !session.profile_error && (!selected || profile?.userId === selected.ig_user_id),
    post: post
      ? {
          createdAt: toDate(post.created_at)!,
          caption: (post.caption as string) ?? "",
          hasVideo: Boolean(post.has_video),
          status: post.status as string,
          publishedAt: toDate(post.published_at),
          metaMediaId: (post.meta_media_id as string | null) ?? null,
        }
      : null,
    verifiedAt: toDate(session.publish_verified_at),
    verifiedPermalink: verified?.permalink ?? null,
  });

  const lastErrorEvent = events.find((row) => row.outcome === "error");
  const lastMetaError =
    (session.publish_error as string | null) ??
    (post?.last_error_sanitized as string | null) ??
    (session.profile_error as string | null) ??
    (lastErrorEvent ? [lastErrorEvent.message, lastErrorEvent.error_code, lastErrorEvent.error_type].filter(Boolean).join(" · ") : null);

  let redirectUri: string | null = null;
  try {
    redirectUri = getInstagramRedirectUri();
  } catch {
    redirectUri = null;
  }

  return {
    session: { startedAt: startedAt.toISOString() },
    config: {
      oauthFlow: "Instagram API with Instagram Login (Business Login for Instagram)",
      appId: (process.env.INSTAGRAM_APP_ID ?? "").trim() || null,
      appConfigured: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
      redirectUri,
      requestedScopes: [...INSTAGRAM_OAUTH_SCOPES],
    },
    accounts: accounts.map((row) => ({
      id: row.id as string,
      igUserId: row.ig_user_id as string,
      username: (row.ig_username as string | null) ?? null,
      status: row.status as string,
      authProvider: (row.auth_provider as string) ?? "instagram_login",
      grantedScopes: scopesOf(row),
      tokenExpiresAt: iso(row.token_expires_at),
      updatedAt: iso(row.updated_at),
    })),
    selectedAccountId: (selected?.id as string | undefined) ?? null,
    permissions: permissionMatrix([...INSTAGRAM_OAUTH_SCOPES], selected ? scopesOf(selected) : null),
    profile,
    profileCheckedAt: iso(session.profile_checked_at),
    profileError: (session.profile_error as string | null) ?? null,
    videos: videos.map((row) => ({ id: row.id as string, url: row.storage_url as string, name: (row.original_filename as string | null) ?? null, createdAt: iso(row.created_at) })),
    post: post
      ? {
          id: post.id as string,
          caption: (post.caption as string) ?? "",
          status: post.status as string,
          publishedAt: iso(post.published_at),
          metaMediaId: (post.meta_media_id as string | null) ?? null,
          lastError: (post.last_error_sanitized as string | null) ?? null,
        }
      : null,
    verified,
    verifiedAt: iso(session.publish_verified_at),
    lastMetaError,
    checklist,
    checklistOrder: CHECKLIST_ORDER,
  };
}

export type ReviewOverview = Awaited<ReturnType<typeof getReviewOverview>>;
