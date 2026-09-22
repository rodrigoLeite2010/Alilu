import "server-only";
import { encryptSecret } from "@/lib/instagram/backend/encryption";
import {
  buildInstagramAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  InstagramGraphApiError,
} from "@/lib/instagram/backend/meta-graph-client";
import {
  getInstagramAccountForUser,
  upsertInstagramAccount,
  type InstagramAccountRecord,
} from "@/lib/instagram/backend/instagram-account-repository";

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

export class InstagramOAuthExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramOAuthExchangeError";
  }
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
    console.error("[instagram-oauth-service] falha na troca do código por token de curta duração", error);
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram (troca do código de autorização falhou).",
    );
  }

  let longLived;
  try {
    longLived = await exchangeForLongLivedToken({
      appSecret,
      shortLivedAccessToken: shortLived.accessToken,
    });
  } catch (error) {
    console.error("[instagram-oauth-service] falha ao obter o token de longa duração", error);
    throw new InstagramOAuthExchangeError(
      "Não foi possível concluir a conexão com o Instagram (obtenção do token de longa duração falhou).",
    );
  }

  let profile = { igUserId: shortLived.igUserId, username: null as string | null };
  try {
    profile = await fetchInstagramProfile(longLived.accessToken);
  } catch (error) {
    // Já temos um token válido — não falha a conexão inteira por causa
    // disso, só ficamos sem o @username por ora (fallback ao ig_user_id).
    console.error(
      "[instagram-oauth-service] falha ao buscar o perfil (conexão prossegue sem username)",
      error instanceof InstagramGraphApiError ? error.message : error,
    );
  }

  const tokenExpiresAt = new Date(Date.now() + longLived.expiresInSeconds * 1000);
  const accessTokenEncrypted = encryptSecret(longLived.accessToken);

  return upsertInstagramAccount({
    userId: input.userId,
    igUserId: profile.igUserId,
    igUsername: profile.username,
    accessTokenEncrypted,
    tokenExpiresAt,
    scopes: shortLived.permissions,
  });
}

export { getInstagramAccountForUser };
