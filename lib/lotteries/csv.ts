import type { LotteryBet } from "./types";

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatNumbers(numbers: readonly number[]): string {
  return numbers.map((n) => String(n).padStart(2, "0")).join(" ");
}

/**
 * CSV de "Meus Jogos" (exportação da Fase 2) — uma linha por jogo salvo,
 * com os dados da aposta em que ele está (concurso, data do sorteio, valor
 * apostado) e o próprio jogo (números, modo, favorito, acertos já
 * conferidos). Diferente de buildLotofacilCsv (lotofacil-generator.ts),
 * que exporta só os números de uma geração ainda não salva.
 */
export function buildSavedGamesCsv(bets: readonly LotteryBet[]): string {
  const header = "Concurso,Data do sorteio,Números,Modo,Favorito,Acertos,Valor apostado (R$)";
  const rows: string[] = [];

  for (const bet of bets) {
    for (const game of bet.games) {
      rows.push(
        [
          bet.contestNumber ?? "",
          bet.drawDate ?? "",
          csvField(formatNumbers(game.numbers)),
          game.mode,
          game.isFavorite ? "sim" : "não",
          game.hits ?? "",
          (bet.amountCents / 100).toFixed(2),
        ].join(",")
      );
    }
  }

  return [header, ...rows].join("\n");
}
