import { NextResponse } from "next/server";
import { createBetWithGames, findDuplicateGameKeys, listBets } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { parseSaveBetInput } from "@/lib/lotteries/validation";

/** GET — lista as apostas (com jogos) do usuário. POST — salva uma aposta com um ou mais jogos, pulando duplicatas do próprio histórico. */
export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  try {
    return NextResponse.json({ bets: await listBets(authResult.userId) });
  } catch {
    console.error("[loterias/apostas] falha ao listar");
    return NextResponse.json({ error: "Não foi possível carregar seus jogos salvos." }, { status: 500 });
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
  const parsed = parseSaveBetInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { games, ...header } = parsed.value;

  try {
    // Detecção de duplicidade (Fase 2): não salva de novo um jogo cujo
    // conjunto de números já está salvo pelo usuário — só avisa quais
    // foram pulados, para a pessoa perceber que já tinha aquela combinação.
    const duplicateKeys = await findDuplicateGameKeys(
      authResult.userId,
      games.map((game) => game.numbers)
    );
    const gamesToSave = games.filter((game) => !duplicateKeys.has(game.numbers.join("-")));
    const skippedCount = games.length - gamesToSave.length;

    if (gamesToSave.length === 0) {
      return NextResponse.json(
        { error: "Todos os jogos enviados já estavam salvos no seu histórico." },
        { status: 409 }
      );
    }

    const bet = await createBetWithGames(authResult.userId, header, gamesToSave);
    return NextResponse.json({ bet, skippedDuplicates: skippedCount }, { status: 201 });
  } catch {
    console.error("[loterias/apostas] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar seus jogos." }, { status: 500 });
  }
}
