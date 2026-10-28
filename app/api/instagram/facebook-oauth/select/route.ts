import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { decryptSecret, encryptSecret } from "@/lib/instagram/backend/encryption";
import { FACEBOOK_LOGIN_SCOPES, listManagedInstagramAccounts } from "@/lib/instagram/backend/facebook-login";
import { deleteFacebookOAuthAttempt, getFacebookOAuthAttempt } from "@/lib/instagram/backend/facebook-oauth-pending";
import { upsertInstagramAccount } from "@/lib/instagram/backend/instagram-account-repository";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sua sessão Alilu expirou. Entre novamente." }, { status: 401 });
  const body = await request.json().catch(() => null) as { attemptId?: string; pageId?: string; connectAsNew?: boolean } | null;
  if (!body?.attemptId || !body.pageId) return NextResponse.json({ error: "Selecione uma conta válida." }, { status: 400 });
  const attempt = await getFacebookOAuthAttempt(body.attemptId, userId);
  if (!attempt?.facebookUserTokenEncrypted) return NextResponse.json({ error: "A tentativa de conexão expirou. Comece novamente." }, { status: 410 });
  const userToken = decryptSecret(attempt.facebookUserTokenEncrypted);
  const accounts = await listManagedInstagramAccounts(userToken);
  const selected = accounts.find((item) => item.pageId === body.pageId);
  if (!selected) return NextResponse.json({ error: "Essa Página não está mais autorizada ou não possui Instagram profissional vinculado." }, { status: 403 });
  const connectAsNew = body.connectAsNew === true;
  if (attempt.expectedIgUserId && selected.igUserId !== attempt.expectedIgUserId && !connectAsNew) {
    await logInstagramOAuth("facebook_selection", "FACEBOOK_ACCOUNT_MISMATCH", { userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "error", error: "account_mismatch", expectedInstagramUserId: attempt.expectedIgUserId, instagramUserId: selected.igUserId, pageId: selected.pageId });
    return NextResponse.json({ error: "Essa é outra conta. A conexão escolhida continua intacta; confirme se quer adicioná-la como uma nova conta." }, { status: 409 });
  }
  try {
    await upsertInstagramAccount({
      userId, igUserId: selected.igUserId, igUsername: selected.username,
      accessTokenEncrypted: encryptSecret(selected.pageAccessToken),
      tokenExpiresAt: attempt.facebookUserTokenExpiresAt ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: [...FACEBOOK_LOGIN_SCOPES], authProvider: "facebook_login", facebookPageId: selected.pageId,
      facebookUserId: attempt.facebookUserId, facebookUserTokenEncrypted: attempt.facebookUserTokenEncrypted,
      facebookUserTokenExpiresAt: attempt.facebookUserTokenExpiresAt,
    });
    await deleteFacebookOAuthAttempt(attempt.id, userId);
    await logInstagramOAuth("facebook_selection", "FACEBOOK_ACCOUNT_CONNECTED", { userId, correlationId: attempt.correlationId, provider: "facebook_login", outcome: "success", targetAccountId: attempt.targetAccountId, instagramUserId: selected.igUserId, instagramUsername: selected.username, pageId: selected.pageId, connectedAsNew: connectAsNew });
    return NextResponse.json({ ok: true, redirect: "/instagram/painel?status=conectado" });
  } catch {
    return NextResponse.json({ error: "Não foi possível associar essa conta. Nenhuma outra conexão foi alterada." }, { status: 409 });
  }
}
