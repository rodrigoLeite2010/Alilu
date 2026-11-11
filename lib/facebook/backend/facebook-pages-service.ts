import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/instagram/backend/encryption";
import { exchangeFacebookCode, getGrantedFacebookPermissions } from "@/lib/instagram/backend/facebook-login";
import {
  createFacebookOAuthAttempt,
  deleteFacebookOAuthAttempt,
  getFacebookOAuthAttempt,
  getFacebookOAuthAttemptByState,
  saveFacebookOAuthUserToken,
} from "@/lib/instagram/backend/facebook-oauth-pending";
import { generateOAuthCorrelationId, generateOAuthState, sanitizeOAuthReturnPath, verifySignedOAuthState } from "@/lib/instagram/backend/oauth-state";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";
import { getPageWithToken, listManagedFacebookPages } from "@/lib/facebook/backend/facebook-graph-client";
import {
  FACEBOOK_PAGES_PERMISSIONS,
  buildFacebookPagesAuthorizeUrl,
  facebookPagesCredentials,
  facebookPagesRedirectUri,
  missingFacebookPagesPermissions,
} from "@/lib/facebook/backend/facebook-pages-oauth";
import { classifyFacebookError, needsPageReconnect } from "@/lib/facebook/backend/facebook-publish-errors";
import {
  getFacebookPageTokenForUser,
  setFacebookPageStatus,
  updateFacebookPageCheck,
  upsertFacebookPage,
  type FacebookPageRecord,
} from "@/lib/facebook/backend/facebook-page-repository";

/**
 * Orquestra a conexão de Páginas do Facebook:
 *   start    → state assinado + preso ao usuário (HMAC) e guardado só como
 *              hash, com purpose = 'facebook_pages' (CSRF);
 *   callback → confere state + sessão do MESMO usuário, troca o code pelo
 *              token de usuário (longa duração), confere as permissões e
 *              guarda o token cifrado na tentativa (nunca no navegador);
 *   select   → o usuário ESCOLHE explicitamente as Páginas; o servidor
 *              re-consulta a Meta com o token da tentativa e só aceita
 *              Páginas que a Meta confirma para aquele login, com tarefa
 *              de criação de conteúdo. Nenhuma Página é escolhida sozinha.
 */

export class FacebookPagesFlowError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) {
    super(message);
    this.name = "FacebookPagesFlowError";
  }
}

export async function startFacebookPagesConnect(userId: string, requestUrl: string, returnTo: string | null): Promise<string> {
  const { appId, configId } = facebookPagesCredentials();
  const redirectUri = facebookPagesRedirectUri(requestUrl);
  const state = generateOAuthState(userId, new Date(), null);
  const correlationId = generateOAuthCorrelationId();
  await createFacebookOAuthAttempt({ userId, correlationId, state, returnTo: sanitizeOAuthReturnPath(returnTo), purpose: "facebook_pages" });
  const authorizeUrl = buildFacebookPagesAuthorizeUrl({ appId, configId, redirectUri, state });
  await logInstagramOAuth("facebook_start", "FACEBOOK_PAGES_OAUTH_START", { userId, correlationId, provider: "facebook_login", redirectUri, authorizationHost: new URL(authorizeUrl).host });
  return authorizeUrl;
}

/** Devolve o id da tentativa (para a tela de seleção) ou lança FacebookPagesFlowError com um código de mensagem. */
export async function handleFacebookPagesCallback(input: { userId: string; state: string | null; code: string | null; hasError: boolean; requestUrl: string }): Promise<string> {
  if (!input.state || verifySignedOAuthState(input.state, input.userId) !== "ok") {
    throw new FacebookPagesFlowError("Tentativa expirada.", "tentativa-oauth-expirada");
  }
  const attempt = await getFacebookOAuthAttemptByState(input.state, input.userId, "facebook_pages");
  if (!attempt) throw new FacebookPagesFlowError("Tentativa expirada.", "tentativa-oauth-expirada");
  await logInstagramOAuth("facebook_callback", "FACEBOOK_PAGES_OAUTH_CALLBACK", { userId: input.userId, correlationId: attempt.correlationId, provider: "facebook_login", hasCode: Boolean(input.code), hasError: input.hasError });
  if (input.hasError || !input.code) throw new FacebookPagesFlowError("Autorização cancelada.", "autorizacao-meta-cancelada");
  try {
    const { appId, appSecret } = facebookPagesCredentials();
    const token = await exchangeFacebookCode(input.code.replace(/#_$/, ""), facebookPagesRedirectUri(input.requestUrl), { appId, appSecret });
    const granted = await getGrantedFacebookPermissions(token.accessToken);
    const missing = missingFacebookPagesPermissions(granted);
    if (missing.length > 0) {
      await logInstagramOAuth("facebook_callback", "FACEBOOK_PAGES_PERMISSIONS_MISSING", { userId: input.userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "error", error: `missing:${missing.join(",")}` });
      throw new FacebookPagesFlowError("Permissões ausentes.", "facebook-permissoes-ausentes");
    }
    const saved = await saveFacebookOAuthUserToken(attempt.id, input.userId, token.facebookUserId, encryptSecret(token.accessToken), token.expiresAt);
    if (!saved) throw new FacebookPagesFlowError("Tentativa expirada.", "tentativa-oauth-expirada");
    return attempt.id;
  } catch (error) {
    if (error instanceof FacebookPagesFlowError) throw error;
    await logInstagramOAuth("facebook_callback", "FACEBOOK_PAGES_OAUTH_ERROR", { userId: input.userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "error", error: "exchange_failed" });
    throw new FacebookPagesFlowError("Falha na Meta.", "oauth-meta-falhou");
  }
}

export interface FacebookPageCandidate {
  pageId: string;
  pageName: string;
  canPublish: boolean;
  linkedIgUsername: string | null;
  /** O Instagram vinculado à Página é uma conta conectada deste usuário no Alilu. */
  linkedToMyInstagram: boolean;
}

async function attemptUserToken(attemptId: string, userId: string) {
  const attempt = await getFacebookOAuthAttempt(attemptId, userId, "facebook_pages");
  if (!attempt?.facebookUserTokenEncrypted || !attempt.facebookUserId) {
    throw new FacebookPagesFlowError("A tentativa de conexão expirou. Comece novamente.", "tentativa-oauth-expirada", 410);
  }
  return { attempt, userToken: decryptSecret(attempt.facebookUserTokenEncrypted) };
}

/** Páginas autorizadas nesta tentativa (sem tokens) — a tela mostra e o usuário escolhe. */
export async function listFacebookPageCandidates(attemptId: string, userId: string): Promise<FacebookPageCandidate[]> {
  const { userToken } = await attemptUserToken(attemptId, userId);
  const [pages, igAccounts] = await Promise.all([listManagedFacebookPages(userToken), listInstagramAccountsForUser(userId)]);
  const myIgIds = new Set(igAccounts.filter((account) => account.status === "connected").map((account) => account.igUserId));
  return pages.map((page) => ({
    pageId: page.pageId,
    pageName: page.pageName,
    canPublish: page.canPublish && Boolean(page.pageAccessToken),
    linkedIgUsername: page.linkedIgUsername,
    linkedToMyInstagram: Boolean(page.linkedIgUserId && myIgIds.has(page.linkedIgUserId)),
  }));
}

/** Conecta SOMENTE as Páginas escolhidas, revalidando cada uma na Meta. */
export async function connectSelectedFacebookPages(attemptId: string, userId: string, pageIds: string[]): Promise<{ pages: FacebookPageRecord[]; returnTo: string | null }> {
  const unique = [...new Set(pageIds.filter((id) => typeof id === "string" && /^\d{1,32}$/.test(id)))];
  if (unique.length === 0 || unique.length > 20) throw new FacebookPagesFlowError("Selecione ao menos uma Página válida.", "selecao-invalida");
  const { attempt, userToken } = await attemptUserToken(attemptId, userId);
  const [pages, igAccounts, granted] = await Promise.all([
    listManagedFacebookPages(userToken),
    listInstagramAccountsForUser(userId),
    getGrantedFacebookPermissions(userToken),
  ]);
  const connected: FacebookPageRecord[] = [];
  for (const pageId of unique) {
    const page = pages.find((candidate) => candidate.pageId === pageId);
    if (!page || !page.canPublish || !page.pageAccessToken) {
      throw new FacebookPagesFlowError("Uma das Páginas escolhidas não está autorizada para publicação neste login. Nenhuma alteração foi feita nela.", "pagina-nao-autorizada", 403);
    }
  }
  for (const pageId of unique) {
    const page = pages.find((candidate) => candidate.pageId === pageId)!;
    // Vínculo com o Instagram: só com uma conta DESTE usuário (nunca de outro).
    const myIg = page.linkedIgUserId ? igAccounts.find((account) => account.igUserId === page.linkedIgUserId) ?? null : null;
    connected.push(await upsertFacebookPage({
      userId,
      pageId: page.pageId,
      pageName: page.pageName,
      pageAccessTokenEncrypted: encryptSecret(page.pageAccessToken),
      facebookUserId: attempt.facebookUserId!,
      tasks: page.tasks,
      scopes: granted.filter((permission) => (FACEBOOK_PAGES_PERMISSIONS as readonly string[]).includes(permission)),
      linkedIgUserId: page.linkedIgUserId,
      linkedIgUsername: page.linkedIgUsername,
      instagramAccountId: myIg?.id ?? null,
    }));
  }
  await deleteFacebookOAuthAttempt(attempt.id, userId);
  await logInstagramOAuth("facebook_selection", "FACEBOOK_PAGES_CONNECTED", { userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "success", pageId: unique.join(",") });
  return { pages: connected, returnTo: attempt.returnTo };
}

/** "Verificar status": valida o token da Página na Meta e atualiza nome/vínculo. */
export async function verifyFacebookPage(id: string, userId: string): Promise<{ status: "connected" | "needs_reconnect" | "revoked"; message: string | null }> {
  const found = await getFacebookPageTokenForUser(id, userId);
  if (!found) throw new FacebookPagesFlowError("Página não encontrada.", "pagina-nao-encontrada", 404);
  if (!found.tokenEncrypted) return { status: "revoked", message: "Página desconectada. Conecte novamente para publicar." };
  try {
    const check = await getPageWithToken(found.page.pageId, decryptSecret(found.tokenEncrypted));
    if (check.pageId !== found.page.pageId) throw new Error("page mismatch");
    await updateFacebookPageCheck(id, userId, check);
    return { status: "connected", message: null };
  } catch (error) {
    const classified = classifyFacebookError(error);
    if (needsPageReconnect(classified.reason) || !(error instanceof Error && error.name === "FacebookGraphApiError")) {
      await setFacebookPageStatus(id, userId, "needs_reconnect", classified.message);
      return { status: "needs_reconnect", message: classified.message };
    }
    return { status: found.page.status, message: classified.message };
  }
}
