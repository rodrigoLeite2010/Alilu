import { NextResponse } from "next/server";
import { deleteGame, setGameFavorite } from "@/lib/lotteries/backend/repository";
import { isUuid, requireUserId } from "@/lib/lotteries/backend/session";
import { parseFavoriteInput } from "@/lib/lotteries/validation";

type Context = { params: Promise<{ id: string }> };

/** PATCH — favorita/desfavorita um jogo. DELETE — exclui um jogo individual (a aposta continua existindo, mesmo sem jogos). */
export async function PATCH(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseFavoriteInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await setGameFavorite(authResult.userId, id, parsed.value.isFavorite);
    if (!updated) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[loterias/jogos] falha ao favoritar");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });

  try {
    const deleted = await deleteGame(authResult.userId, id);
    if (!deleted) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[loterias/jogos] falha ao excluir");
    return NextResponse.json({ error: "Não foi possível excluir." }, { status: 500 });
  }
}
