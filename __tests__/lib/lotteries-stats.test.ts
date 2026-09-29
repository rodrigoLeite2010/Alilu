import { describe, expect, it } from "vitest";
import { calculatePersonalFrequency } from "@/lib/lotteries/stats";

describe("lotteries/stats — frequência PESSOAL (nunca probabilidade)", () => {
  it("conta quantas vezes cada número aparece nos jogos salvos do usuário", () => {
    const stats = calculatePersonalFrequency([
      [1, 2, 3],
      [1, 2, 4],
      [1, 5, 6],
    ], 6);

    expect(stats.totalGames).toBe(3);
    expect(stats.frequency[1]).toBe(3);
    expect(stats.frequency[2]).toBe(2);
    expect(stats.frequency[3]).toBe(1);
    expect(stats.frequency[6]).toBe(1);
  });

  it("preenche com zero todo número de 1 até maxNumber que nunca apareceu", () => {
    const stats = calculatePersonalFrequency([[1, 2, 3]], 5);
    expect(stats.frequency[4]).toBe(0);
    expect(stats.frequency[5]).toBe(0);
    expect(Object.keys(stats.frequency)).toHaveLength(5);
  });

  it("sem nenhum jogo salvo, devolve tudo zerado", () => {
    const stats = calculatePersonalFrequency([], 25);
    expect(stats.totalGames).toBe(0);
    expect(Object.values(stats.frequency).every((count) => count === 0)).toBe(true);
  });

  it("usa LOTOFACIL_CONFIG.maxNumber (25) como padrão quando maxNumber não é informado", () => {
    const stats = calculatePersonalFrequency([[1, 25]]);
    expect(Object.keys(stats.frequency)).toHaveLength(25);
    expect(stats.frequency[25]).toBe(1);
  });
});
