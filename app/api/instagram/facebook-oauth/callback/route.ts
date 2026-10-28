import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptSecret } from "@/lib/instagram/backend/encryption";
import { exchangeFacebookCode, facebookRedirectUri, getGrantedFacebookPermissions, FACEBOOK_LOGIN_PERMISSIONS } from "@/lib/instagram/backend/facebook-login";
import { getFacebookOAuthAttemptByState, saveFacebookOAuthUserToken } from "@/lib/instagram/backend/facebook-oauth-pending";
import { verifySignedOAuthState } from "@/lib/instagram/backend/oauth-state";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await auth();
  const userId = session?.user?.id;
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!userId) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=sessao-meta-expirada", request.url));
  if (verifySignedOAuthState(state, userId) !== "ok" || !state) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=tentativa-oauth-expirada", request.url));
  const attempt = await getFacebookOAuthAttemptByState(state, userId);
  if (!attempt) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=tentativa-oauth-expirada", request.url));
  await logInstagramOAuth("facebook_callback", "FACEBOOK_OAUTH_CALLBACK_RECEIVED", { userId, correlationId: attempt.correlationId, provider: "facebook_login", hasCode: Boolean(code), hasError: url.searchParams.has("error") });
  if (url.searchParams.has("error") || !code) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=autorizacao-meta-cancelada", request.url));
  try {
    const token = await exchangeFacebookCode(code.replace(/#_$/, ""), facebookRedirectUri(request.url));
    const granted = await getGrantedFacebookPermissions(token.accessToken);
    if (!FACEBOOK_LOGIN_PERMISSIONS.every((permission) => granted.includes(permission))) throw new Error("required Facebook permissions missing");
    const saved = await saveFacebookOAuthUserToken(attempt.id, userId, token.facebookUserId, encryptSecret(token.accessToken), token.expiresAt);
    if (!saved) throw new Error("oauth attempt expired");
    await logInstagramOAuth("facebook_callback", "FACEBOOK_OAUTH_TOKEN_EXCHANGED", { userId, correlationId: attempt.correlationId, provider: "facebook_login", facebookUserId: token.facebookUserId });
    return NextResponse.redirect(new URL(`/instagram/facebook-contas?attempt=${encodeURIComponent(attempt.id)}`, request.url));
  } catch {
    await logInstagramOAuth("facebook_callback", "FACEBOOK_OAUTH_ERROR", { userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "error", error: "exchange_or_permission_failed" });
    return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=oauth-meta-falhou", request.url));
  }
}
