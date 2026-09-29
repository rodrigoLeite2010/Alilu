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

describe("lotteries/stats — minNumber explícito (Lotomania, que começa em 0)", () => {
  it("com minNumber: 0, conta o número 0 normalmente (bug real que existia antes: n >= 1 excluía o 0)", () => {
    const stats = calculatePersonalFrequency([[0, 1, 2]], 99, 0);
    expect(stats.frequency[0]).toBe(1);
    expect(Object.keys(stats.frequency)).toHaveLength(100); // 0 a 99
  });

  it("com minNumber: 0, preenche com zero todo número de 0 até maxNumber que nunca apareceu", () => {
    const stats = calculatePersonalFrequency([[5]], 9, 0);
    expect(stats.frequency[0]).toBe(0);
    expect(stats.frequency[9]).toBe(0);
    expect(stats.frequency[5]).toBe(1);
    expect(Object.keys(stats.frequency)).toHaveLength(10); // 0 a 9
  });

  it("omitir minNumber continua produzindo o mesmo resultado de antes (compatibilidade retroativa)", () => {
    const withDefault = calculatePersonalFrequency([[1, 2, 3]], 5);
    const withExplicit1 = calculatePersonalFrequency([[1, 2, 3]], 5, 1);
    expect(withDefault).toEqual(withExplicit1);
  });
});
