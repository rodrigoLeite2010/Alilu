import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";

/** GET: contas do Instagram conectadas do usuário — para o seletor de conta do wizard (seção 3). */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const accounts = await listInstagramAccountsForUser(userId);
    // Nunca devolve token (mesma regra do GET /api/instagram/account).
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        igUsername: account.igUsername,
        status: account.status,
        connectedAt: account.connectedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[content-automation/accounts] falha ao listar contas", error);
    return NextResponse.json({ error: "Não foi possível carregar as contas conectadas." }, { status: 500 });
  }
}
