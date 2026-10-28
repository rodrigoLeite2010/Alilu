import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  INSTAGRAM_OAUTH_CORRELATION_COOKIE,
  INSTAGRAM_OAUTH_RETURN_COOKIE,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  generateOAuthCorrelationId,
  generateOAuthState,
  sanitizeOAuthReturnPath,
} from "@/lib/instagram/backend/oauth-state";
import {
  InstagramOAuthConfigError,
  buildAuthorizeUrlForConnect,
} from "@/lib/instagram/backend/instagram-oauth-service";
import {
  INSTAGRAM_OAUTH_RESULT_PATH,
  InstagramRedirectConfigError,
  getInstagramRedirectUri,
} from "@/lib/instagram/backend/instagram-oauth-config";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";
import { getOAuthDeviceHint } from "@/lib/instagram/backend/oauth-device";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";

export const dynamic = "force-dynamic";

/**
 * "Conectar Instagram": exige login no Alilu, gera o `state` assinado e
 * preso ao usuário, guarda cookies HttpOnly e entrega uma página intermediária
 * no mesmo domínio antes de navegar ao Instagram. A navegação via browser evita
 * que redirects HTTP diretos abram o app nativo e percam o callback no mobile.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeOAuthReturnPath(
    requestUrl.searchParams.get("returnTo"),
  );
  const device = getOAuthDeviceHint(request.headers.get("user-agent"));
  // "Adicionar outra conta" ou reconectar com troca explícita de perfil:
  // força novo login para não reutilizar a conta já logada no navegador.
  const accountId = requestUrl.searchParams.get("accountId");
  const forceReauth =
    requestUrl.searchParams.get("forceReauth") === "1" ||
    (requestUrl.searchParams.get("addAccount") === "1" && !accountId);

  let redirectUri: string;
  try {
    redirectUri = getInstagramRedirectUri(request.url);
  } catch (error) {
    if (error instanceof InstagramRedirectConfigError) {
      await logInstagramOAuth("start", "Redirect URI inválido", {
        outcome: "error",
        error: "redirect_config",
        errorMessage: error.message,
      });
      return NextResponse.redirect(
        new URL(
          `${INSTAGRAM_OAUTH_RESULT_PATH}?resultado=indisponivel`,
          request.url,
        ),
      );
    }
    throw error;
  }

  // O fluxo inteiro roda no MESMO domínio do redirect_uri (ex.: sem "www"),
  // senão o cookie de state gravado aqui não volta no callback.
  const canonicalOrigin = new URL(redirectUri).origin;
  if (requestUrl.origin !== canonicalOrigin) {
    return NextResponse.redirect(
      new URL(`${requestUrl.pathname}${requestUrl.search}`, canonicalOrigin),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/entrar", canonicalOrigin);
    loginUrl.searchParams.set("callbackUrl", returnTo ?? "/instagram/painel");
    return NextResponse.redirect(loginUrl);
  }
  const userId = session.user.id;

  let expectedInstagramUserId: string | null = null;
  if (accountId) {
    const target = await getInstagramAccountByIdForUser(accountId, userId);
    if (!target) {
      await logInstagramOAuth("start", "CONNECTION_TARGET_NOT_FOUND", {
        userId,
        outcome: "error",
        error: "target_account_not_found",
        ...device,
      });
      return NextResponse.redirect(
        new URL(
          `${INSTAGRAM_OAUTH_RESULT_PATH}?resultado=conta-nao-encontrada`,
          canonicalOrigin,
        ),
      );
    }
    expectedInstagramUserId = target.igUserId;
  }

  const correlationId = generateOAuthCorrelationId();
  const state = generateOAuthState(userId, new Date(), expectedInstagramUserId);
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrlForConnect(redirectUri, state, {
      forceReauth,
    });
  } catch (error) {
    if (error instanceof InstagramOAuthConfigError) {
      await logInstagramOAuth("start", "App da Meta não configurado", {
        userId,
        outcome: "error",
        error: "app_not_configured",
      });
      return NextResponse.redirect(
        new URL(
          `${INSTAGRAM_OAUTH_RESULT_PATH}?resultado=indisponivel`,
          canonicalOrigin,
        ),
      );
    }
    throw error;
  }
  const appId = new URL(authorizeUrl).searchParams.get("client_id");
  await logInstagramOAuth("start", "OAUTH_START", {
    userId,
    correlationId,
    returnTo: returnTo ?? null,
    redirectUri,
    authorizationHost: new URL(authorizeUrl).host,
    appIdSuffix: appId?.slice(-4) ?? null,
    forceReauth,
    hasAccountTarget: Boolean(expectedInstagramUserId),
    ...device,
  });

  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  const scriptUrl = JSON.stringify(authorizeUrl).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Conectando Instagram — Alilu</title><style>body{font:16px system-ui,sans-serif;color:#202b2e;background:#f7faf9;margin:0;min-height:100vh;display:grid;place-items:center}.box{max-width:28rem;margin:1rem;padding:2rem;background:white;border:1px solid #dbe2e3;border-radius:1rem;text-align:center}a{color:#00535f;font-weight:600}</style></head><body><main class="box"><h1>Conectando ao Instagram…</h1><p>Você será levado à página segura da Meta para autorizar sua conta.</p><p>Se a navegação não começar, <a href="${escapeHtml(authorizeUrl)}">toque aqui para continuar</a>.</p></main><script>window.location.replace(${scriptUrl});</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
  const cookieOptions = {
    httpOnly: true,
    secure: canonicalOrigin.startsWith("https:"),
    sameSite: "lax" as const, // volta da Meta é navegação de topo (GET): cookie lax é enviado
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/api/instagram/oauth",
  };
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(
    INSTAGRAM_OAUTH_CORRELATION_COOKIE,
    correlationId,
    cookieOptions,
  );
  if (returnTo)
    response.cookies.set(
      INSTAGRAM_OAUTH_RETURN_COOKIE,
      returnTo,
      cookieOptions,
    );
  else
    response.cookies.set(INSTAGRAM_OAUTH_RETURN_COOKIE, "", {
      ...cookieOptions,
      maxAge: 0,
    });
  await logInstagramOAuth("redirect", "OAUTH_REDIRECT", {
    userId,
    correlationId,
    provider: "instagram",
    authorizationHost: new URL(authorizeUrl).host,
    redirectUri,
    ...device,
  });
  return response;
}
