import { NextResponse } from "next/server";
import { deleteBet, updateBetHeader } from "@/lib/lotteries/backend/repository";
import { isUuid, requireUserId } from "@/lib/lotteries/backend/session";
import { parseUpdateBetInput } from "@/lib/lotteries/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseUpdateBetInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await updateBetHeader(authResult.userId, id, parsed.value);
    if (!updated) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[loterias/apostas] falha ao atualizar");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 });

  try {
    const deleted = await deleteBet(authResult.userId, id);
    if (!deleted) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[loterias/apostas] falha ao excluir");
    return NextResponse.json({ error: "Não foi possível excluir." }, { status: 500 });
  }
}
