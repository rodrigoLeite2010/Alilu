import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_RETURN_COOKIE,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  generateOAuthState,
  sanitizeOAuthReturnPath,
} from "@/lib/instagram/backend/oauth-state";
import { InstagramOAuthConfigError, buildAuthorizeUrlForConnect } from "@/lib/instagram/backend/instagram-oauth-service";
import {
  INSTAGRAM_OAUTH_RESULT_PATH,
  InstagramRedirectConfigError,
  getInstagramRedirectUri,
} from "@/lib/instagram/backend/instagram-oauth-config";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

export const dynamic = "force-dynamic";

/**
 * "Conectar Instagram": exige login no Alilu, gera o `state` assinado e
 * preso ao usuário, guarda (cookie HttpOnly) o state e a página para onde
 * voltar, e faz REDIRECT normal (sem popup — funciona em Android, iPhone e
 * navegador interno do Instagram) para a tela oficial de autorização.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeOAuthReturnPath(requestUrl.searchParams.get("returnTo"));

  let redirectUri: string;
  try {
    redirectUri = getInstagramRedirectUri(request.url);
  } catch (error) {
    if (error instanceof InstagramRedirectConfigError) {
      await logInstagramOAuth("start", "Redirect URI inválido", { outcome: "error", error: "redirect_config", errorMessage: error.message });
      return NextResponse.redirect(new URL(`${INSTAGRAM_OAUTH_RESULT_PATH}?resultado=indisponivel`, request.url));
    }
    throw error;
  }

  // O fluxo inteiro roda no MESMO domínio do redirect_uri (ex.: sem "www"),
  // senão o cookie de state gravado aqui não volta no callback.
  const canonicalOrigin = new URL(redirectUri).origin;
  if (requestUrl.origin !== canonicalOrigin) {
    return NextResponse.redirect(new URL(`${requestUrl.pathname}${requestUrl.search}`, canonicalOrigin));
  }

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/entrar", canonicalOrigin);
    loginUrl.searchParams.set("callbackUrl", returnTo ?? "/instagram/painel");
    return NextResponse.redirect(loginUrl);
  }
  const userId = session.user.id;

  const state = generateOAuthState(userId);
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrlForConnect(redirectUri, state);
  } catch (error) {
    if (error instanceof InstagramOAuthConfigError) {
      await logInstagramOAuth("start", "App da Meta não configurado", { userId, outcome: "error", error: "app_not_configured" });
      return NextResponse.redirect(new URL(`${INSTAGRAM_OAUTH_RESULT_PATH}?resultado=indisponivel`, canonicalOrigin));
    }
    throw error;
  }
  await logInstagramOAuth("start", "Iniciando autenticação", { userId, returnTo: returnTo ?? null });
  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: canonicalOrigin.startsWith("https:"),
    sameSite: "lax" as const, // volta da Meta é navegação de topo (GET): cookie lax é enviado
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/api/instagram/oauth",
  };
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, cookieOptions);
  if (returnTo) response.cookies.set(INSTAGRAM_OAUTH_RETURN_COOKIE, returnTo, cookieOptions);
  else response.cookies.delete(INSTAGRAM_OAUTH_RETURN_COOKIE);
  return response;
}
