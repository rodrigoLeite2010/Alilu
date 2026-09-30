import { NextResponse } from "next/server";
import { createDebt, listDebts } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";
import { parseDebtInput } from "@/lib/financas/validation";

export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  try {
    return NextResponse.json({ debts: await listDebts(authResult.userId) });
  } catch {
    console.error("[financas/dividas] falha ao listar");
    return NextResponse.json({ error: "Não foi possível carregar as dívidas." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseDebtInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const id = await createDebt(authResult.userId, parsed.value);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    console.error("[financas/dividas] falha ao criar");
    return NextResponse.json({ error: "Não foi possível salvar a dívida." }, { status: 500 });
  }
}
