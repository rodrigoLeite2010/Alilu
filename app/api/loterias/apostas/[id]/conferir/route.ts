import { NextResponse } from "next/server";
import { recordDrawnNumbers } from "@/lib/lotteries/backend/repository";
import { isUuid, requireUserId } from "@/lib/lotteries/backend/session";
import { getLotteryApiConfig } from "@/lib/lotteries/modalities";
import { parseDrawnNumbersInput } from "@/lib/lotteries/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * Conferência manual do resultado (Fase 2): o usuário digita os números
 * REALMENTE sorteados — nunca buscados de nenhuma fonte automática, já que
 * o projeto não tem integração com nenhum resultado oficial — e a rota
 * calcula/grava os acertos de cada jogo daquela aposta. O corpo inclui
 * `modality` (a mesma modalidade da aposta sendo conferida) só para saber
 * quantos/quais números validar — a própria gravação (recordDrawnNumbers)
 * já é restrita pelo id da aposta + user_id, sem precisar de modalidade.
 */
export async function POST(request: Request, { params }: Context): Promise<NextResponse> {
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

  const config = getLotteryApiConfig(
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).modality : undefined
  );
  if (!config) return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });

  const parsed = parseDrawnNumbersInput(body, config);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const bet = await recordDrawnNumbers(authResult.userId, id, parsed.value);
    if (!bet) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 });
    return NextResponse.json({ bet });
  } catch {
    console.error("[loterias/apostas/conferir] falha ao conferir");
    return NextResponse.json({ error: "Não foi possível conferir o resultado." }, { status: 500 });
  }
}
