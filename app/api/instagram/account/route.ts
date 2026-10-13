import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  disconnectInstagramAccountsForUser,
  getInstagramAccountForUser,
  setPrimaryInstagramAccount,
} from "@/lib/instagram/backend/instagram-account-repository";
import { logInstagramOAuth } from "@/lib/instagram/backend/oauth-log";

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

/**
 * DELETE: "Desconectar Instagram" — apaga o token guardado e marca a conta
 * como desconectada (publicações/automações ficam, mas não publicam até
 * reconectar). Sempre restrito ao usuário logado.
 *
 * Multi-conta: `?accountId=<id>` desconecta SÓ aquela conta (as outras, e o
 * piloto automático delas, continuam funcionando). Sem accountId, desconecta
 * todas (comportamento antigo).
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const accountId = new URL(request.url).searchParams.get("accountId");
  const count = await disconnectInstagramAccountsForUser(userId, accountId);
  await logInstagramOAuth("disconnect", "Instagram desconectado pelo usuário", { userId, accounts: count, single: Boolean(accountId) });
  return NextResponse.json({ disconnected: count });
}

/**
 * PATCH { accountId }: "Usar como principal" — a conta usada pelas telas que
 * ainda publicam em uma conta só (calendário, Posts Virais, Reels).
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let accountId: unknown;
  try {
    accountId = ((await request.json()) as { accountId?: unknown }).accountId;
  } catch {
    accountId = null;
  }
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }
  const ok = await setPrimaryInstagramAccount(accountId, userId);
  if (!ok) return NextResponse.json({ error: "Conta não encontrada ou desconectada." }, { status: 404 });
  return NextResponse.json({ primary: accountId });
}
