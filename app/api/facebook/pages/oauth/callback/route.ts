import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FacebookPagesFlowError, handleFacebookPagesCallback } from "@/lib/facebook/backend/facebook-pages-service";
import { FACEBOOK_PAGES_SELECT_PATH } from "@/lib/facebook/backend/facebook-pages-oauth";

export const dynamic = "force-dynamic";

/**
 * Callback EXCLUSIVO do fluxo de Páginas do Facebook. O callback do
 * Instagram (/api/instagram/oauth/callback e /api/instagram/facebook-oauth/
 * callback) não muda. Nunca devolve token ao navegador: só o id da tentativa.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=sessao-meta-expirada", request.url));
  try {
    const attemptId = await handleFacebookPagesCallback({
      userId,
      state: url.searchParams.get("state"),
      code: url.searchParams.get("code"),
      hasError: url.searchParams.has("error"),
      requestUrl: request.url,
    });
    return NextResponse.redirect(new URL(`${FACEBOOK_PAGES_SELECT_PATH}?attempt=${encodeURIComponent(attemptId)}`, request.url));
  } catch (error) {
    const code = error instanceof FacebookPagesFlowError ? error.code : "oauth-meta-falhou";
    return NextResponse.redirect(new URL(`/instagram/painel?status=erro&mensagem=${encodeURIComponent(code)}`, request.url));
  }
}
