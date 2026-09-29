import { NextResponse } from "next/server";
import { listBets } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { buildSavedGamesCsv } from "@/lib/lotteries/csv";

/** Exporta todos os jogos salvos do usuário como CSV (Fase 2). */
export async function GET(): Promise<Response> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  try {
    const bets = await listBets(authResult.userId);
    const csv = buildSavedGamesCsv(bets);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="meus-jogos-lotofacil-alilu.csv"',
      },
    });
  } catch {
    console.error("[loterias/exportar] falha ao exportar");
    return NextResponse.json({ error: "Não foi possível exportar seus jogos." }, { status: 500 });
  }
}
