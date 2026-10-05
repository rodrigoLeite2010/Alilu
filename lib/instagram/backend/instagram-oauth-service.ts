import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/instagram/backend/encryption";
import {
  buildInstagramAuthorizeUrl,
  describeMetaError,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  InstagramGraphApiError,
  refreshLongLivedToken,
} from "@/lib/instagram/backend/meta-graph-client";
import {
  getInstagramAccountForUser,
  listAccountsNeedingTokenRefresh,
  markExpiredInstagramAccounts,
  setInstagramAccountStatus,
  updateInstagramAccountToken,
  upsertInstagramAccount,
  type InstagramAccountRecord,
} from "@/lib/instagram/backend/instagram-account-repository";
import { INSTAGRAM_PUBLISH_SCOPE } from "@/lib/instagram/backend/instagram-oauth-config";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";
import type { OAuthDeviceHint } from "@/lib/instagram/backend/oauth-device";
import { isLikelyMetaReviewError } from "@/lib/instagram/backend/meta-review";

/**
 * Orquestra a conexão de uma conta do Instagram: credenciais do app →
 * troca de código → token de longa duração → perfil → grava cifrado no
 * banco. As rotas (app/api/instagram/oauth/*) só cuidam de HTTP/cookies;
 * toda a regra de negócio do fluxo mora aqui.
 */

export class InstagramOAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramOAuthConfigError";
  }
}

/** Motivo (código estável) — a rota converte em mensagem amigável; nunca mostra o texto da Meta. */
export type InstagramConnectFailure = "exchange_failed" | "long_lived_failed" | "not_professional" | "missing_publish_permission" | "meta_review";

export class InstagramOAuthExchangeError extends Error {
  readonly reason: InstagramConnectFailure;
  constructor(message: string, reason: InstagramConnectFailure = "exchange_failed") {
    super(message);
    this.name = "InstagramOAuthExchangeError";
    this.reason = reason;
  }
}

/** Contas profissionais (Criador ou Empresa) — as únicas que a API de publicação aceita. */
const PROFESSIONAL_ACCOUNT_TYPES = new Set(["BUSINESS", "MEDIA_CREATOR", "CREATOR"]);

function metaErrorFields(error: unknown) {
  const meta = describeMetaError(error instanceof InstagramGraphApiError ? error.details : null);
  return { errorCode: meta.code, errorSubcode: meta.subcode, errorType: meta.type, errorMessage: meta.message ?? (error as Error)?.message ?? null };
}

export interface InstagramAppCredentials {
  appId: string;
  appSecret: string;
}

/** Lê as credenciais do app da Meta das variáveis de ambiente (só servidor). */
export function loadAppCredentials(): InstagramAppCredentials {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new InstagramOAuthConfigError(
      "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET não configurados. Siga o guia de " +
        "configuração do app da Meta antes de conectar uma conta do Instagram.",
    );
  }
  return { appId, appSecret };
}

/** Monta a URL de autorização para o botão "Conectar Instagram" do painel. */
export function buildAuthorizeUrlForConnect(redirectUri: string, state: string): string {
  const { appId } = loadAppCredentials();
  return buildInstagramAuthorizeUrl({ appId, redirectUri, state });
}

export interface CompleteInstagramConnectionInput {
  userId: string;
  redirectUri: string;
  code: string;
  correlationId?: string | null;
  device?: OAuthDeviceHint;
}

/**
 * Conclui a conexão a partir do código recebido no callback do OAuth:
 * troca por token de curta duração, depois de longa duração (60 dias),
 * tenta buscar o perfil (username) — mas, se essa última chamada falhar,
 * não invalida a conexão inteira, já que o token já é válido; só ficamos
 * sem o username por enquanto, com fallback para o ig_user_id.
 */
export async function completeInstagramConnection(
  input: CompleteInstagramConnectionInput,
): Promise<InstagramAccountRecord> {
  const { appId, appSecret } = loadAppCredentials();

  let shortLived;
  try {
    shortLived = await exchangeCodeForShortLivedToken({
      appId,
      appSecret,
      redirectUri: input.redirectUri,
      code: input.code,
    });
  } catch (error) {
    const meta = metaErrorFields(error);
    await logInstagramOAuth("exchange", "OAUTH_ERROR", { userId: input.userId, correlationId: input.correlationId, outcome: "error", ...meta, ...input.device });
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram.",
      isLikelyMetaReviewError(meta) ? "meta_review" : "exchange_failed",
    );
  }
  await logInstagramOAuth("token", "TOKEN_EXCHANGED", { userId: input.userId, correlationId: input.correlationId, permissions: shortLived.permissions.join(","), ...input.device });

  // Permissão de publicar desmarcada na tela da Meta: sem ela o Alilu não serve para nada.
  if (shortLived.permissions.length > 0 && !shortLived.permissions.includes(INSTAGRAM_PUBLISH_SCOPE)) {
    await logInstagramOAuth("permissions", "OAUTH_ERROR", { userId: input.userId, correlationId: input.correlationId, outcome: "error", error: "missing_publish_permission", ...input.device });
    throw new InstagramOAuthExchangeError("A permissão de publicar não foi concedida.", "missing_publish_permission");
  }

  let longLived;
  try {
    longLived = await exchangeForLongLivedToken({
      appSecret,
      shortLivedAccessToken: shortLived.accessToken,
    });
  } catch (error) {
    const meta = metaErrorFields(error);
    await logInstagramOAuth("long_lived", "OAUTH_ERROR", { userId: input.userId, correlationId: input.correlationId, outcome: "error", ...meta, ...input.device });
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram.",
      isLikelyMetaReviewError(meta) ? "meta_review" : "long_lived_failed",
    );
  }

  let profile: { igUserId: string; username: string | null; accountType?: string | null } = { igUserId: shortLived.igUserId, username: null };
  try {
    profile = await fetchInstagramProfile(longLived.accessToken);
  } catch (error) {
    // Já temos um token válido — não falha a conexão inteira por causa
    // disso, só ficamos sem o @username por ora (fallback ao ig_user_id).
    await logInstagramOAuth("profile", "OAUTH_ERROR", { userId: input.userId, correlationId: input.correlationId, outcome: "error", ...metaErrorFields(error), ...input.device });
  }

  const accountType = profile.accountType?.toUpperCase() ?? null;
  if (accountType && !PROFESSIONAL_ACCOUNT_TYPES.has(accountType)) {
    await logInstagramOAuth("profile", "OAUTH_ERROR", { userId: input.userId, correlationId: input.correlationId, outcome: "error", error: "not_professional", accountType, ...input.device });
    throw new InstagramOAuthExchangeError("A conta do Instagram não é profissional.", "not_professional");
  }
  await logInstagramOAuth("profile", "ACCOUNT_FETCHED", { userId: input.userId, correlationId: input.correlationId, accountType, hasUsername: Boolean(profile.username), ...input.device });
  await logInstagramOAuth("validation", "ACCOUNT_VALIDATED", { userId: input.userId, correlationId: input.correlationId, accountType, ...input.device });

  const tokenExpiresAt = new Date(Date.now() + longLived.expiresInSeconds * 1000);
  const accessTokenEncrypted = encryptSecret(longLived.accessToken);

  const account = await upsertInstagramAccount({
    userId: input.userId,
    igUserId: profile.igUserId,
    igUsername: profile.username,
    accessTokenEncrypted,
    tokenExpiresAt,
    scopes: shortLived.permissions,
  });
  await logInstagramOAuth("save", "CONNECTION_SAVED", { userId: input.userId, correlationId: input.correlationId, outcome: "success", ...input.device });
  return account;
}

export interface TokenRefreshResult {
  refreshed: number;
  failed: number;
  expired: number;
}

/**
 * Renova os tokens de 60 dias antes de vencer (regra da Meta: o token precisa
 * ter ao menos 24 h e ainda estar válido). Roda no cron do agendador. Conta
 * que a Meta recusar (token revogado/expirado) vira "expired" — a tela pede
 * para reconectar e nenhuma publicação tenta usar um token morto.
 */
export async function refreshExpiringInstagramTokens(options: { now?: Date; limit?: number } = {}): Promise<TokenRefreshResult> {
  const now = options.now ?? new Date();
  const result: TokenRefreshResult = { refreshed: 0, failed: 0, expired: await markExpiredInstagramAccounts(now) };
  for (const account of await listAccountsNeedingTokenRefresh(now, options.limit ?? 20)) {
    try {
      const refreshed = await refreshLongLivedToken(decryptSecret(account.accessTokenEncrypted));
      await updateInstagramAccountToken(account.id, encryptSecret(refreshed.accessToken), new Date(now.getTime() + refreshed.expiresInSeconds * 1000));
      result.refreshed += 1;
    } catch (error) {
      result.failed += 1;
      const meta = metaErrorFields(error);
      // 190 = token inválido/expirado/revogado pela pessoa no Instagram.
      if (meta.errorCode === 190) await setInstagramAccountStatus(account.id, "expired");
      await logInstagramOAuth("refresh", "Falha ao renovar token", { userId: account.userId, outcome: "error", ...meta });
    }
  }
  return result;
}

export { getInstagramAccountForUser };
