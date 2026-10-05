import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_CORRELATION_COOKIE,
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
import { getOAuthDeviceHint } from "@/lib/instagram/backend/oauth-device";
import { isLikelyMetaReviewError } from "@/lib/instagram/backend/meta-review";

export const dynamic = "force-dynamic";

/**
 * Callback do login do Instagram. SEMPRE termina numa tela do Alilu
 * (/instagram/conectado) — nunca deixa a pessoa parada no instagram.com nem
 * mostra texto técnico da Meta. Detalhes técnicos só vão para o log.
 *
 * Resultados (?resultado=): sucesso | cancelado | conta-nao-profissional |
 * sem-permissao | sessao | expirado | meta-review | erro.
 */
type Resultado = "sucesso" | "cancelado" | "conta-nao-profissional" | "sem-permissao" | "sessao" | "expirado" | "meta-review" | "erro";

function finish(request: NextRequest, resultado: Resultado): NextResponse {
  const url = new URL(INSTAGRAM_OAUTH_RESULT_PATH, request.url);
  url.searchParams.set("resultado", resultado);
  const returnTo = sanitizeOAuthReturnPath(request.cookies.get(INSTAGRAM_OAUTH_RETURN_COOKIE)?.value);
  if (returnTo) url.searchParams.set("continuar", returnTo);
  const response = NextResponse.redirect(url);
  const clearOptions = { path: "/api/instagram/oauth", maxAge: 0 };
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, "", clearOptions);
  response.cookies.set(INSTAGRAM_OAUTH_RETURN_COOKIE, "", clearOptions);
  response.cookies.set(INSTAGRAM_OAUTH_CORRELATION_COOKIE, "", clearOptions);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const errorReason = params.get("error_reason");
  const errorDescription = params.get("error_description");
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const correlationId = request.cookies.get(INSTAGRAM_OAUTH_CORRELATION_COOKIE)?.value ?? null;
  const device = getOAuthDeviceHint(request.headers.get("user-agent"));

  await logInstagramOAuth("callback", "OAUTH_CALLBACK_RECEIVED", { userId, correlationId, hasCode: params.has("code"), hasError: Boolean(error), ...device });

  if (error) {
    const cancelled = errorReason === "user_denied" || error === "access_denied";
    const metaReview = !cancelled && isLikelyMetaReviewError({
      error,
      errorCode: params.get("error_code"),
      errorType: errorReason,
      errorMessage: errorDescription ?? params.get("error_message"),
    });
    await logInstagramOAuth("callback", cancelled ? "Usuário cancelou a autorização" : "Meta retornou erro", {
      userId,
      correlationId,
      outcome: cancelled ? "cancelled" : "error",
      error,
      errorType: errorReason,
      errorCode: params.get("error_code"),
      errorMessage: errorDescription ?? params.get("error_message"),
      ...device,
    });
    return finish(request, cancelled ? "cancelado" : metaReview ? "meta-review" : "erro");
  }

  if (!userId) {
    // Ex.: o celular voltou da Meta num navegador diferente, sem login no Alilu.
    await logInstagramOAuth("callback", "ALILU_SESSION_MISSING_AFTER_OAUTH", { correlationId, outcome: "error", error: "no_session", ...device });
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
  if (cookieState === null) {
    await logInstagramOAuth("state", "STATE_COOKIE_MISSING", { userId, correlationId, outcome: "error", error: "state_cookie_missing", ...device });
  }
  if (!code || stateCheck !== "ok" || !cookieOk) {
    const reason = !code ? "missing_code" : stateCheck !== "ok" ? `state_${stateCheck}` : "state_cookie_mismatch";
    await logInstagramOAuth("state", "OAUTH_ERROR", { userId, correlationId, outcome: "error", error: reason, ...device });
    return finish(request, stateCheck === "expired" ? "expirado" : reason === "state_missing" ? "sessao" : "erro");
  }
  await logInstagramOAuth("state", "STATE_VALID", { userId, correlationId, cookiePresent: Boolean(cookieState), ...device });
  await logInstagramOAuth("code", "CODE_RECEIVED", { userId, correlationId, ...device });

  try {
    const redirectUri = getInstagramRedirectUri(request.url);
    await completeInstagramConnection({ userId, redirectUri, code, correlationId, device });
  } catch (err) {
    if (err instanceof InstagramOAuthExchangeError) {
      const resultado =
        err.reason === "not_professional"
          ? "conta-nao-profissional"
          : err.reason === "missing_publish_permission"
            ? "sem-permissao"
            : err.reason === "meta_review"
              ? "meta-review"
              : "erro";
      return finish(request, resultado);
    }
    await logInstagramOAuth("complete", "Falha inesperada ao concluir a conexão", {
      userId,
      correlationId,
      outcome: "error",
      error: err instanceof InstagramOAuthConfigError ? "app_not_configured" : "unexpected",
      errorMessage: err instanceof Error ? err.message : null,
      ...device,
    });
    return finish(request, "erro");
  }

  await logInstagramOAuth("complete", "OAUTH_SUCCESS", { userId, correlationId, outcome: "success", ...device });
  return finish(request, "sucesso");
}
