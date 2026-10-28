import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildFacebookAuthorizeUrl, facebookAppCredentials, facebookRedirectUri } from "@/lib/instagram/backend/facebook-login";
import { createFacebookOAuthAttempt } from "@/lib/instagram/backend/facebook-oauth-pending";
import { generateOAuthCorrelationId, generateOAuthState, sanitizeOAuthReturnPath } from "@/lib/instagram/backend/oauth-state";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/entrar?callbackUrl=%2Finstagram%2Fpainel", request.url));
  const userId = session.user.id;
  const url = new URL(request.url);
  const targetId = url.searchParams.get("accountId");
  const target = targetId ? await getInstagramAccountByIdForUser(targetId, userId) : null;
  if (targetId && !target) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=conta-nao-encontrada", request.url));
  try {
    const { appId } = facebookAppCredentials();
    const redirectUri = facebookRedirectUri(request.url);
    const state = generateOAuthState(userId, new Date(), target?.igUserId ?? null);
    const correlationId = generateOAuthCorrelationId();
    await createFacebookOAuthAttempt({ userId, correlationId, state, targetAccountId: target?.id, expectedIgUserId: target?.igUserId, returnTo: sanitizeOAuthReturnPath(url.searchParams.get("returnTo")) });
    const authorizeUrl = buildFacebookAuthorizeUrl({ appId, redirectUri, state });
    await logInstagramOAuth("facebook_start", "FACEBOOK_OAUTH_START", { userId, correlationId, provider: "facebook_login", targetAccountId: target?.id ?? null, expectedInstagramUserId: target?.igUserId ?? null, redirectUri, authorizationHost: new URL(authorizeUrl).host });
    return NextResponse.redirect(authorizeUrl);
  } catch {
    return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=facebook-login-indisponivel", request.url));
  }
}
