import { NextResponse } from "next/server";
import { getInvestmentSummary, listAllSavedGameNumbers } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { calculatePersonalFrequency } from "@/lib/lotteries/stats";

/**
 * Estatística PESSOAL (Fase 2): frequência dos números nos jogos que o
 * PRÓPRIO usuário já salvou, mais o total investido. Nunca chamar isto de
 * "probabilidade" em nenhum texto de tela — é só uma contagem descritiva
 * do histórico da pessoa (ver lib/lotteries/stats.ts).
 */
export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  try {
    const [savedNumbers, investment] = await Promise.all([
      listAllSavedGameNumbers(authResult.userId),
      getInvestmentSummary(authResult.userId),
    ]);
    return NextResponse.json({ frequency: calculatePersonalFrequency(savedNumbers), investment });
  } catch {
    console.error("[loterias/estatisticas] falha ao calcular");
    return NextResponse.json({ error: "Não foi possível carregar suas estatísticas." }, { status: 500 });
  }
}
