import { NextResponse } from "next/server";
import { listBets } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { buildSavedGamesCsv } from "@/lib/lotteries/csv";
import { getLotteryApiConfig } from "@/lib/lotteries/modalities";

/** Exporta todos os jogos salvos do usuário NAQUELA MODALIDADE (?modalidade=lotofacil|mega-sena) como CSV (Fase 2). */
export async function GET(request: Request): Promise<Response> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const config = getLotteryApiConfig(searchParams.get("modalidade"));
  if (!config) return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });

  try {
    const bets = await listBets(authResult.userId, config.id);
    const csv = buildSavedGamesCsv(bets);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="meus-jogos-${config.id}-alilu.csv"`,
      },
    });
  } catch {
    console.error("[loterias/exportar] falha ao exportar");
    return NextResponse.json({ error: "Não foi possível exportar seus jogos." }, { status: 500 });
  }
}
