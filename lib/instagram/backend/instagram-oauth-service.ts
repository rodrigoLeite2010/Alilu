import "server-only";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/instagram/backend/encryption";
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
import { listManagedInstagramAccounts, refreshFacebookUserToken } from "@/lib/instagram/backend/facebook-login";

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
export type InstagramConnectFailure =
  | "exchange_failed"
  | "long_lived_failed"
  | "not_professional"
  | "missing_publish_permission"
  | "meta_review"
  | "account_mismatch";

export class InstagramOAuthExchangeError extends Error {
  readonly reason: InstagramConnectFailure;
  constructor(
    message: string,
    reason: InstagramConnectFailure = "exchange_failed",
  ) {
    super(message);
    this.name = "InstagramOAuthExchangeError";
    this.reason = reason;
  }
}

/** Contas profissionais (Criador ou Empresa) — as únicas que a API de publicação aceita. */
const PROFESSIONAL_ACCOUNT_TYPES = new Set([
  "BUSINESS",
  "MEDIA_CREATOR",
  "CREATOR",
]);

function metaErrorFields(error: unknown) {
  const meta = describeMetaError(
    error instanceof InstagramGraphApiError ? error.details : null,
  );
  return {
    errorCode: meta.code,
    errorSubcode: meta.subcode,
    errorType: meta.type,
    errorMessage: meta.message ?? (error as Error)?.message ?? null,
  };
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
export function buildAuthorizeUrlForConnect(
  redirectUri: string,
  state: string,
  options: { forceReauth?: boolean } = {},
): string {
  const { appId } = loadAppCredentials();
  return buildInstagramAuthorizeUrl({
    appId,
    redirectUri,
    state,
    forceReauth: options.forceReauth,
  });
}

export interface CompleteInstagramConnectionInput {
  userId: string;
  redirectUri: string;
  code: string;
  expectedInstagramUserId?: string | null;
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
    await logInstagramOAuth("exchange", "OAUTH_ERROR", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      ...meta,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram.",
      isLikelyMetaReviewError(meta) ? "meta_review" : "exchange_failed",
    );
  }
  await logInstagramOAuth("token", "TOKEN_EXCHANGED", {
    userId: input.userId,
    correlationId: input.correlationId,
    permissions: shortLived.permissions.join(","),
    ...input.device,
  });

  if (
    input.expectedInstagramUserId &&
    shortLived.igUserId !== input.expectedInstagramUserId
  ) {
    await logInstagramOAuth("identity", "AUTHORIZED_ACCOUNT_MISMATCH", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      error: "account_mismatch",
      instagramUserId: shortLived.igUserId,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "A conta autorizada é diferente da conta escolhida.",
      "account_mismatch",
    );
  }

  // ── DIAGNÓSTICO TEMPORÁRIO (conta errada no celular) — REMOVER depois de achar a causa. ──
  // Só identificadores públicos da conta; nunca token, code ou state.
  await logInstagramOAuth("diagnostic", "OAUTH_TOKEN_RECEIVED", {
    userId: input.userId,
    correlationId: input.correlationId,
    currentAliluUserId: input.userId,
    // user_id devolvido pela troca do código (ainda sem username: o perfil é consultado logo abaixo).
    instagramUserId: shortLived.igUserId,
    errorMessage: `OAUTH_TOKEN_RECEIVED ig_user_id=${shortLived.igUserId} alilu_user=${input.userId} tentativa=${input.correlationId ?? "-"}`,
    ...input.device,
  });
  let shortProfile: Awaited<ReturnType<typeof fetchInstagramProfile>> | null =
    null;
  try {
    // Pergunta à Meta "quem é o dono deste token?" assim que ele chega, antes de qualquer gravação no banco.
    const identity = await fetchInstagramProfile(shortLived.accessToken);
    shortProfile = identity;
    await logInstagramOAuth("diagnostic", "OAUTH_IDENTITY_FETCHED", {
      userId: input.userId,
      correlationId: input.correlationId,
      currentAliluUserId: input.userId,
      instagramUserId: identity.igUserId,
      instagramUsername: identity.username,
      accountType: identity.accountType ?? null,
      errorMessage: `OAUTH_IDENTITY_FETCHED ig_user_id=${identity.igUserId} username=@${identity.username ?? "?"} tipo=${identity.accountType ?? "?"} alilu_user=${input.userId} tentativa=${input.correlationId ?? "-"}`,
      ...input.device,
    });
  } catch (error) {
    await logInstagramOAuth("diagnostic", "OAUTH_IDENTITY_FETCHED", {
      userId: input.userId,
      correlationId: input.correlationId,
      currentAliluUserId: input.userId,
      outcome: "error",
      ...metaErrorFields(error),
      ...input.device,
    });
  }
  if (shortProfile && shortProfile.igUserId !== shortLived.igUserId) {
    await logInstagramOAuth("identity", "TOKEN_PROFILE_ID_MISMATCH", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      error: "account_mismatch",
      instagramUserId: shortProfile.igUserId,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "A identidade do token não corresponde ao perfil autorizado.",
      "account_mismatch",
    );
  }

  // Permissão de publicar desmarcada na tela da Meta: sem ela o Alilu não serve para nada.
  if (
    shortLived.permissions.length > 0 &&
    !shortLived.permissions.includes(INSTAGRAM_PUBLISH_SCOPE)
  ) {
    await logInstagramOAuth("permissions", "OAUTH_ERROR", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      error: "missing_publish_permission",
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "A permissão de publicar não foi concedida.",
      "missing_publish_permission",
    );
  }

  let longLived;
  try {
    longLived = await exchangeForLongLivedToken({
      appSecret,
      shortLivedAccessToken: shortLived.accessToken,
    });
  } catch (error) {
    const meta = metaErrorFields(error);
    await logInstagramOAuth("long_lived", "OAUTH_ERROR", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      ...meta,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram.",
      isLikelyMetaReviewError(meta) ? "meta_review" : "long_lived_failed",
    );
  }

  let profile: {
    igUserId: string;
    username: string | null;
    accountType?: string | null;
  } = { igUserId: shortLived.igUserId, username: null };
  try {
    profile = await fetchInstagramProfile(longLived.accessToken);
  } catch (error) {
    // Já temos um token válido — não falha a conexão inteira por causa
    // disso, só ficamos sem o @username por ora (fallback ao ig_user_id).
    await logInstagramOAuth("profile", "OAUTH_ERROR", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      ...metaErrorFields(error),
      ...input.device,
    });
  }

  const accountType = profile.accountType?.toUpperCase() ?? null;
  if (profile.igUserId !== shortLived.igUserId) {
    await logInstagramOAuth("identity", "LONG_TOKEN_PROFILE_ID_MISMATCH", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      error: "account_mismatch",
      instagramUserId: profile.igUserId,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "A identidade do token não corresponde ao perfil autorizado.",
      "account_mismatch",
    );
  }
  if (accountType && !PROFESSIONAL_ACCOUNT_TYPES.has(accountType)) {
    await logInstagramOAuth("profile", "OAUTH_ERROR", {
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: "error",
      error: "not_professional",
      accountType,
      ...input.device,
    });
    throw new InstagramOAuthExchangeError(
      "A conta do Instagram não é profissional.",
      "not_professional",
    );
  }
  await logInstagramOAuth("profile", "ACCOUNT_FETCHED", {
    userId: input.userId,
    correlationId: input.correlationId,
    accountType,
    hasUsername: Boolean(profile.username),
    ...input.device,
  });
  await logInstagramOAuth("validation", "ACCOUNT_VALIDATED", {
    userId: input.userId,
    correlationId: input.correlationId,
    accountType,
    ...input.device,
  });

  const tokenExpiresAt = new Date(
    Date.now() + longLived.expiresInSeconds * 1000,
  );
  const accessTokenEncrypted = encryptSecret(longLived.accessToken);

  const account = await upsertInstagramAccount({
    userId: input.userId,
    igUserId: profile.igUserId,
    igUsername: profile.username,
    accessTokenEncrypted,
    tokenExpiresAt,
    scopes: shortLived.permissions,
  });
  await logInstagramOAuth("save", "CONNECTION_SAVED", {
    userId: input.userId,
    correlationId: input.correlationId,
    outcome: "success",
    ...input.device,
  });

  // ── DIAGNÓSTICO TEMPORÁRIO — REMOVER depois de achar a causa. ──
  // Compara a conta que acabou de ser gravada com a que o Alilu vai mostrar/usar como "a conta" do usuário.
  try {
    const current = await getInstagramAccountForUser(input.userId);
    await logInstagramOAuth("diagnostic", "OAUTH_ACCOUNT_SAVED", {
      userId: input.userId,
      correlationId: input.correlationId,
      currentAliluUserId: input.userId,
      instagramUserId: account.igUserId,
      instagramUsername: account.igUsername,
      currentInstagramUserId: current?.igUserId ?? null,
      currentInstagramUsername: current?.igUsername ?? null,
      savedIsCurrent: current?.id === account.id,
      errorMessage: `OAUTH_ACCOUNT_SAVED gravada=@${account.igUsername ?? "?"}(${account.igUserId}) atual_no_alilu=@${current?.igUsername ?? "?"}(${current?.igUserId ?? "-"}) gravada_e_atual=${current?.id === account.id} alilu_user=${input.userId} tentativa=${input.correlationId ?? "-"}`,
      ...input.device,
    });
  } catch {
    // diagnóstico é melhor esforço
  }
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
export async function refreshExpiringInstagramTokens(
  options: { now?: Date; limit?: number } = {},
): Promise<TokenRefreshResult> {
  const now = options.now ?? new Date();
  const result: TokenRefreshResult = {
    refreshed: 0,
    failed: 0,
    expired: await markExpiredInstagramAccounts(now),
  };
  for (const account of await listAccountsNeedingTokenRefresh(
    now,
    options.limit ?? 20,
  )) {
    try {
      if (account.authProvider === "facebook_login") {
        if (!account.facebookPageId || !account.facebookUserTokenEncrypted) throw new Error("A reconexão Facebook é necessária para renovar esta conta.");
        const refreshedUser = await refreshFacebookUserToken(decryptSecret(account.facebookUserTokenEncrypted));
        const pages = await listManagedInstagramAccounts(refreshedUser.accessToken);
        const page = pages.find((item) => item.pageId === account.facebookPageId);
        if (!page) throw new Error("A Página vinculada não está mais disponível para este usuário Meta.");
        await updateInstagramAccountToken(account.id, encryptSecret(page.pageAccessToken), refreshedUser.expiresAt, encryptSecret(refreshedUser.accessToken), refreshedUser.expiresAt);
        result.refreshed += 1;
        continue;
      }
      const refreshed = await refreshLongLivedToken(
        decryptSecret(account.accessTokenEncrypted),
      );
      await updateInstagramAccountToken(
        account.id,
        encryptSecret(refreshed.accessToken),
        new Date(now.getTime() + refreshed.expiresInSeconds * 1000),
      );
      result.refreshed += 1;
    } catch (error) {
      result.failed += 1;
      const meta = metaErrorFields(error);
      // 190 = token inválido/expirado/revogado pela pessoa no Instagram.
      if (meta.errorCode === 190)
        await setInstagramAccountStatus(account.id, "expired");
      await logInstagramOAuth("refresh", "Falha ao renovar token", {
        userId: account.userId,
        outcome: "error",
        ...meta,
      });
    }
  }
  return result;
}

export { getInstagramAccountForUser };
