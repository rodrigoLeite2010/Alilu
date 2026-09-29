import { describe, expect, it } from "vitest";
import { buildSavedGamesCsv } from "@/lib/lotteries/csv";
import type { LotteryBet } from "@/lib/lotteries/types";

function bet(overrides: Partial<LotteryBet> = {}): LotteryBet {
  return {
    id: "bet-1",
    modality: "lotofacil",
    contestNumber: 3200,
    drawDate: "2026-10-01",
    amountCents: 250,
    note: null,
    drawnNumbers: null,
    checkedAt: null,
    createdAt: "2026-09-29T00:00:00.000Z",
    games: [
      {
        id: "game-1",
        betId: "bet-1",
        modality: "lotofacil",
        numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        betSize: 15,
        mode: "aleatorio",
        isFavorite: false,
        hits: null,
        createdAt: "2026-09-29T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("lotteries/csv — buildSavedGamesCsv", () => {
  it("gera uma linha de cabeçalho e uma linha por jogo salvo", () => {
    const csv = buildSavedGamesCsv([bet()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Concurso,Data do sorteio,Números,Modo,Favorito,Acertos,Valor apostado (R$)");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('3200,2026-10-01,"01 02 03 04 05 06 07 08 09 10 11 12 13 14 15",aleatorio,não,,2.50');
  });

  it("uma linha por jogo quando a aposta tem vários jogos", () => {
    const twoGames = bet({
      games: [
        { ...bet().games[0], id: "g1" },
        { ...bet().games[0], id: "g2", numbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], isFavorite: true, hits: 12 },
      ],
    });
    const lines = buildSavedGamesCsv([twoGames]).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain("sim,12");
  });

  it("sem apostas, gera só o cabeçalho", () => {
    expect(buildSavedGamesCsv([])).toBe("Concurso,Data do sorteio,Números,Modo,Favorito,Acertos,Valor apostado (R$)");
  });
});
