import { NextResponse } from "next/server";
import { createBetWithGames, findDuplicateGameKeys, listBets } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { getLotteryApiConfig } from "@/lib/lotteries/modalities";
import { parseSaveBetInput } from "@/lib/lotteries/validation";

/**
 * GET — lista as apostas (com jogos) do usuário NAQUELA MODALIDADE
 * (?modalidade=lotofacil|mega-sena). POST — salva uma aposta com um ou
 * mais jogos, pulando duplicatas do próprio histórico daquela modalidade
 * (`modality` no corpo).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const config = getLotteryApiConfig(searchParams.get("modalidade"));
  if (!config) return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });

  try {
    return NextResponse.json({ bets: await listBets(authResult.userId, config.id) });
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

  const config = getLotteryApiConfig(
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).modality : undefined
  );
  if (!config) return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });

  const parsed = parseSaveBetInput(body, config);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { games, modality, ...header } = parsed.value;

  try {
    // Detecção de duplicidade (Fase 2): não salva de novo um jogo cujo
    // conjunto de números já está salvo pelo usuário NAQUELA MODALIDADE —
    // só avisa quais foram pulados, para a pessoa perceber que já tinha
    // aquela combinação.
    const duplicateKeys = await findDuplicateGameKeys(
      authResult.userId,
      modality,
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

    const bet = await createBetWithGames(authResult.userId, modality, header, gamesToSave);
    return NextResponse.json({ bet, skippedDuplicates: skippedCount }, { status: 201 });
  } catch {
    console.error("[loterias/apostas] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar seus jogos." }, { status: 500 });
  }
}
