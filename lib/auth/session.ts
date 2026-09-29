import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Helper de sessão compartilhado por toda rota de API privada do site —
 * hoje usado pelo módulo financeiro (lib/financas/backend/session.ts) e
 * por Loterias (lib/lotteries/backend/session.ts), ambos só reexportando
 * daqui. Nenhum módulo de funcionalidade deve reimplementar isto: sempre
 * reaproveitar a mesma autenticação (Auth.js) já existente no site.
 */
export async function requireUserId(): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { userId };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
