import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Retorna o id do usuário logado ou uma resposta 401 pronta para devolver. */
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
