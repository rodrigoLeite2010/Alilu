import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { startFacebookPagesConnect } from "@/lib/facebook/backend/facebook-pages-service";

export const dynamic = "force-dynamic";

/** Inicia a conexão de Páginas do Facebook (fluxo separado do login do Instagram). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/entrar?callbackUrl=%2Finstagram%2Fpainel", request.url));
  const returnTo = new URL(request.url).searchParams.get("returnTo");
  try {
    return NextResponse.redirect(await startFacebookPagesConnect(session.user.id, request.url, returnTo));
  } catch {
    return NextResponse.redirect(new URL("/instagram/painel?status=erro&mensagem=facebook-paginas-indisponivel", request.url));
  }
}
