import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";

export const dynamic = "force-dynamic";

/**
 * Situação de login/conexão para as telas de criação (Posts Virais,
 * editor). Devolve só o necessário para a interface — NUNCA o token, o
 * id interno do Instagram ou escopos.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ authenticated: false, connected: false, username: null, userId: null });
  }
  try {
    const account = await getInstagramAccountForUser(userId);
    return NextResponse.json({
      authenticated: true,
      // Id interno do próprio usuário no Alilu (não é segredo): usado só para
      // montar o caminho do upload, que o servidor revalida contra a sessão.
      userId,
      connected: Boolean(account && account.status === "connected"),
      username: account?.igUsername ?? null,
      needsReconnect: Boolean(account && account.status !== "connected"),
      // Resumo da "música padrão para publicações" (ver music-support.ts) — só o
      // necessário para a tela de criação pré-selecionar "Usar música padrão da
      // conta" e mostrar o nome; nunca usado para decidir se a API aceita aplicar.
      defaultMusic: account?.defaultMusic.enabled
        ? { enabled: true, name: account.defaultMusic.name, artist: account.defaultMusic.artist }
        : { enabled: false, name: null, artist: null },
    });
  } catch {
    return NextResponse.json({ authenticated: true, userId, connected: false, username: null, unavailable: true });
  }
}
