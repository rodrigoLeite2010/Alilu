import { describe, expect, it } from "vitest";
import {
  buildLotteryCsv,
  calculateGameSimilarity,
  calculateSum,
  countEvenOdd,
  countPrimes,
  getLongestSequence,
  getUsedGroups,
  pickRandomSubset,
  secureRandomInt,
} from "@/lib/lotteries/shared";

/**
 * Testes do núcleo agnóstico de modalidade (lib/lotteries/shared.ts),
 * extraído de lotofacil-generator.ts na Fase A da Mega-Sena. Cobre as
 * funções diretamente, sem depender de nenhuma config de modalidade
 * específica — os testes de lotofacil-generator.test.ts e
 * megasena-generator.test.ts continuam cobrindo o comportamento de ponta
 * a ponta por cima disto.
 */

describe("shared — secureRandomInt", () => {
  it("nunca retorna um valor fora de [0, n)", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = secureRandomInt(11);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(11);
    }
  });

  it("retorna 0 para maxExclusive <= 0", () => {
    expect(secureRandomInt(0)).toBe(0);
    expect(secureRandomInt(-5)).toBe(0);
  });
});

describe("shared — pickRandomSubset", () => {
  it("sorteia a quantidade pedida, sem repetição, ordenado crescentemente", () => {
    const pool = Array.from({ length: 60 }, (_, i) => i + 1);
    const picked = pickRandomSubset(pool, 6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked).size).toBe(6);
    expect(picked).toEqual([...picked].sort((a, b) => a - b));
    picked.forEach((n) => expect(pool).toContain(n));
  });

  it("aceita um randomInt determinístico injetado", () => {
    const pool = [10, 20, 30, 40];
    const picked = pickRandomSubset(pool, 2, () => 0);
    expect(picked).toHaveLength(2);
  });
});

describe("shared — calculateGameSimilarity", () => {
  it("usa interseção/união (Jaccard) e vai de 0 a 1", () => {
    expect(calculateGameSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(calculateGameSimilarity([1, 2, 3], [4, 5, 6])).toBe(0);
    expect(calculateGameSimilarity([1, 2, 3, 4], [3, 4, 5, 6])).toBeCloseTo(2 / 6, 5);
  });

  it("retorna 0 quando os dois jogos são vazios", () => {
    expect(calculateGameSimilarity([], [])).toBe(0);
  });
});

describe("shared — análise de jogo", () => {
  it("countEvenOdd conta pares e ímpares corretamente", () => {
    expect(countEvenOdd([1, 2, 3, 4, 5])).toEqual({ even: 2, odd: 3 });
  });

  it("countPrimes recebe o prime set como parâmetro explícito", () => {
    const primeSet = new Set([2, 3, 5, 7]);
    expect(countPrimes([1, 4, 6, 9, 10], primeSet)).toBe(0);
    expect(countPrimes([2, 3, 5, 7], primeSet)).toBe(4);
    expect(countPrimes([1, 2, 4, 9], primeSet)).toBe(1);
  });

  it("calculateSum soma as dezenas", () => {
    expect(calculateSum([1, 2, 3])).toBe(6);
    expect(calculateSum([])).toBe(0);
  });

  it("getLongestSequence encontra a maior sequência consecutiva, mesmo com a entrada desordenada", () => {
    expect(getLongestSequence([1, 5, 3, 4, 10])).toBe(3); // 3,4,5
    expect(getLongestSequence([1, 3, 5, 7])).toBe(1);
    expect(getLongestSequence([])).toBe(0);
  });

  it("getUsedGroups generaliza getUsedBoardRows para qualquer tamanho de grupo", () => {
    expect(getUsedGroups([1, 2, 3], 5)).toBe(1); // grupo 0
    expect(getUsedGroups([1, 6, 11, 16, 21], 5)).toBe(5); // uma dezena por grupo de 5

    // Mega-Sena: grupos de 10.
    expect(getUsedGroups([1, 5, 9], 10)).toBe(1); // grupo 0
    expect(getUsedGroups([1, 15, 25, 35, 45, 55], 10)).toBe(6); // uma dezena por linha
  });
});

describe("shared — buildLotteryCsv", () => {
  it("gera uma linha de cabeçalho e uma por jogo", () => {
    const csv = buildLotteryCsv([[1, 2, 3], [4, 5, 6]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Jogo,Números");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,"1 2 3"');
    expect(lines[2]).toBe('2,"4 5 6"');
  });

  it("sem jogos, gera só o cabeçalho", () => {
    expect(buildLotteryCsv([])).toBe("Jogo,Números");
  });
});
