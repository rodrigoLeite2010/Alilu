import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  generateOAuthState,
} from "@/lib/instagram/backend/oauth-state";
import {
  InstagramOAuthConfigError,
  buildAuthorizeUrlForConnect,
} from "@/lib/instagram/backend/instagram-oauth-service";

/**
 * Início do fluxo de conexão da conta do Instagram (Fase 3, ETAPA OAuth
 * connect). Exige sessão (login por Google ou por código de e-mail já
 * implementado); gera o `state` anti-CSRF, grava num cookie HttpOnly
 * restrito ao path deste fluxo, e redireciona para a tela de autorização
 * do Instagram.
 *
 * Isso só CONECTA a conta — nenhuma publicação acontece aqui nem em
 * nenhuma etapa já implementada até agora.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const redirectUri = new URL("/api/instagram/oauth/callback", request.url).toString();
  const state = generateOAuthState();

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrlForConnect(redirectUri, state);
  } catch (error) {
    if (error instanceof InstagramOAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/api/instagram/oauth",
  });
  return response;
}
