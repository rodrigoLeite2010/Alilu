import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_RETURN_COOKIE,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  isValidOAuthState,
  sanitizeOAuthReturnPath,
  verifySignedOAuthState,
} from "@/lib/instagram/backend/oauth-state";
import {
  InstagramOAuthConfigError,
  InstagramOAuthExchangeError,
  completeInstagramConnection,
} from "@/lib/instagram/backend/instagram-oauth-service";
import { INSTAGRAM_OAUTH_RESULT_PATH, getInstagramRedirectUri } from "@/lib/instagram/backend/instagram-oauth-config";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

export const dynamic = "force-dynamic";

/**
 * Callback do login do Instagram. SEMPRE termina numa tela do Alilu
 * (/instagram/conectado) — nunca deixa a pessoa parada no instagram.com nem
 * mostra texto técnico da Meta. Detalhes técnicos só vão para o log.
 *
 * Resultados (?resultado=): sucesso | cancelado | conta-nao-profissional |
 * sem-permissao | sessao | expirado | erro.
 */
type Resultado = "sucesso" | "cancelado" | "conta-nao-profissional" | "sem-permissao" | "sessao" | "expirado" | "erro";

function finish(request: NextRequest, resultado: Resultado): NextResponse {
  const url = new URL(INSTAGRAM_OAUTH_RESULT_PATH, request.url);
  url.searchParams.set("resultado", resultado);
  const returnTo = sanitizeOAuthReturnPath(request.cookies.get(INSTAGRAM_OAUTH_RETURN_COOKIE)?.value);
  if (returnTo) url.searchParams.set("continuar", returnTo);
  const response = NextResponse.redirect(url);
  response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
  response.cookies.delete(INSTAGRAM_OAUTH_RETURN_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const errorReason = params.get("error_reason");
  const errorDescription = params.get("error_description");
  const session = await auth();
  const userId = session?.user?.id ?? null;

  await logInstagramOAuth("callback", "Callback recebido", { userId, hasCode: params.has("code"), hasError: Boolean(error) });

  if (error) {
    const cancelled = errorReason === "user_denied" || error === "access_denied";
    await logInstagramOAuth("callback", cancelled ? "Usuário cancelou a autorização" : "Meta retornou erro", {
      userId,
      outcome: cancelled ? "cancelled" : "error",
      error,
      errorType: errorReason,
      errorCode: params.get("error_code"),
      errorMessage: errorDescription ?? params.get("error_message"),
    });
    return finish(request, cancelled ? "cancelado" : "erro");
  }

  if (!userId) {
    // Ex.: o celular voltou da Meta num navegador diferente, sem login no Alilu.
    await logInstagramOAuth("callback", "Callback sem sessão do Alilu", { outcome: "error", error: "no_session" });
    return finish(request, "sessao");
  }

  // O Instagram às vezes acrescenta "#_" ao fim; o fragmento não chega ao
  // servidor, mas removemos por garantia se vier codificado.
  const code = params.get("code")?.replace(/#_$/, "") ?? null;
  const state = params.get("state");
  const stateCheck = verifySignedOAuthState(state, userId);
  const cookieState = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value ?? null;
  // Cookie presente precisa bater; ausente é aceito só porque a assinatura
  // já prende o state a ESTE usuário logado (celular que volta em outra aba).
  const cookieOk = cookieState === null || isValidOAuthState(state, cookieState);
  if (!code || stateCheck !== "ok" || !cookieOk) {
    await logInstagramOAuth("state", "State inválido", { userId, outcome: "error", error: !code ? "missing_code" : stateCheck !== "ok" ? `state_${stateCheck}` : "state_cookie_mismatch" });
    return finish(request, stateCheck === "expired" ? "expirado" : "erro");
  }
  await logInstagramOAuth("state", "State válido; authorization code recebido", { userId });

  try {
    const redirectUri = getInstagramRedirectUri(request.url);
    await completeInstagramConnection({ userId, redirectUri, code });
  } catch (err) {
    if (err instanceof InstagramOAuthExchangeError) {
      return finish(request, err.reason === "not_professional" ? "conta-nao-profissional" : err.reason === "missing_publish_permission" ? "sem-permissao" : "erro");
    }
    await logInstagramOAuth("complete", "Falha inesperada ao concluir a conexão", {
      userId,
      outcome: "error",
      error: err instanceof InstagramOAuthConfigError ? "app_not_configured" : "unexpected",
      errorMessage: err instanceof Error ? err.message : null,
    });
    return finish(request, "erro");
  }

  await logInstagramOAuth("complete", "Integração concluída", { userId, outcome: "success" });
  return finish(request, "sucesso");
}
