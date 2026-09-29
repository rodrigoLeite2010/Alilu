import { NextResponse } from "next/server";
import { getInvestmentSummary, listAllSavedGameNumbers } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { getLotteryApiConfig } from "@/lib/lotteries/modalities";
import { calculatePersonalFrequency } from "@/lib/lotteries/stats";

/**
 * Estatística PESSOAL (Fase 2, generalizada na Fase B): frequência dos
 * números nos jogos que o PRÓPRIO usuário já salvou NAQUELA MODALIDADE
 * (?modalidade=lotofacil|mega-sena), mais o total investido nela. Nunca
 * chamar isto de "probabilidade" em nenhum texto de tela — é só uma
 * contagem descritiva do histórico da pessoa (ver lib/lotteries/stats.ts).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const config = getLotteryApiConfig(searchParams.get("modalidade"));
  if (!config) return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });

  try {
    const [savedNumbers, investment] = await Promise.all([
      listAllSavedGameNumbers(authResult.userId, config.id),
      getInvestmentSummary(authResult.userId, config.id),
    ]);
    return NextResponse.json({
      frequency: calculatePersonalFrequency(savedNumbers, config.maxNumber, config.minNumber),
      investment,
    });
  } catch {
    console.error("[loterias/estatisticas] falha ao calcular");
    return NextResponse.json({ error: "Não foi possível carregar suas estatísticas." }, { status: 500 });
  }
}
