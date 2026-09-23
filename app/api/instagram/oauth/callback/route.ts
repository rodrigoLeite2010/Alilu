import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_RETURN_COOKIE,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  isValidOAuthState,
  sanitizeOAuthReturnPath,
} from "@/lib/instagram/backend/oauth-state";
import {
  InstagramOAuthConfigError,
  InstagramOAuthExchangeError,
  completeInstagramConnection,
} from "@/lib/instagram/backend/instagram-oauth-service";

/**
 * Callback do OAuth do Instagram (Fase 3, ETAPA OAuth connect). Recebido
 * depois que o usuário autoriza (ou nega) o app na tela do Instagram.
 * Sempre redireciona de volta para o painel com um status simples, nunca
 * expõe detalhes internos (mensagens de erro genéricas para o usuário,
 * detalhes completos só em `console.error`).
 */

function painelRedirect(request: NextRequest, status: string, message?: string): NextResponse {
  // Depois de conectar com sucesso, volta para onde o usuário estava
  // (ex.: o Post Viral em edição); em erro, sempre para o painel.
  const returnTo =
    status === "conectado" ? sanitizeOAuthReturnPath(request.cookies.get(INSTAGRAM_OAUTH_RETURN_COOKIE)?.value) : null;
  const url = new URL(returnTo ?? "/instagram/painel", request.url);
  url.searchParams.set("status", status);
  if (message) url.searchParams.set("mensagem", message);

  const response = NextResponse.redirect(url);
  response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
  response.cookies.delete(INSTAGRAM_OAUTH_RETURN_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const errorParam = request.nextUrl.searchParams.get("error");
  const errorReason = request.nextUrl.searchParams.get("error_reason");
  if (errorParam) {
    console.error("[instagram-oauth-callback] Meta retornou erro", { errorParam, errorReason });
    return painelRedirect(request, "erro", "A autorização foi cancelada ou negada.");
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateFromCallback = request.nextUrl.searchParams.get("state");
  const stateFromCookie = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;

  if (!code) {
    return painelRedirect(request, "erro", "Código de autorização ausente.");
  }
  if (!isValidOAuthState(stateFromCallback, stateFromCookie)) {
    return painelRedirect(request, "erro", "Falha de verificação de segurança (state inválido). Tente novamente.");
  }

  try {
    const redirectUri = new URL("/api/instagram/oauth/callback", request.url).toString();
    await completeInstagramConnection({ userId: session.user.id, redirectUri, code });
  } catch (error) {
    console.error("[instagram-oauth-callback] falha ao concluir a conexão", error);
    const message =
      error instanceof InstagramOAuthConfigError || error instanceof InstagramOAuthExchangeError
        ? error.message
        : "Não foi possível concluir a conexão com o Instagram.";
    return painelRedirect(request, "erro", message);
  }

  return painelRedirect(request, "conectado");
}
