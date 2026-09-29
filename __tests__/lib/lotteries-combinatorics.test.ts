import { describe, expect, it } from "vitest";
import { calculateCombination, calculateHitDistribution, calculateOddsOneIn } from "@/lib/lotteries/combinatorics";

describe("lotteries/combinatorics — calculateCombination", () => {
  it("C(25,15) = 3.268.760 (total de combinações possíveis da Lotofácil, Seção 37)", () => {
    expect(calculateCombination(25, 15)).toBe(3268760);
  });

  it("C(16,15) = 16 e C(17,15) = 136 (equivalência em apostas simples, Seção 37)", () => {
    expect(calculateCombination(16, 15)).toBe(16);
    expect(calculateCombination(17, 15)).toBe(136);
  });

  it("C(18,15) = 816, C(19,15) = 3.876 e C(20,15) = 15.504 (demais tamanhos de aposta)", () => {
    expect(calculateCombination(18, 15)).toBe(816);
    expect(calculateCombination(19, 15)).toBe(3876);
    expect(calculateCombination(20, 15)).toBe(15504);
  });

  it("C(n,0) = 1 e C(n,n) = 1", () => {
    expect(calculateCombination(25, 0)).toBe(1);
    expect(calculateCombination(25, 25)).toBe(1);
  });

  it("retorna 0 quando k > n ou os valores não são inteiros não negativos", () => {
    expect(calculateCombination(5, 10)).toBe(0);
    expect(calculateCombination(-1, 2)).toBe(0);
    expect(calculateCombination(5, -1)).toBe(0);
    expect(calculateCombination(5.5, 2)).toBe(0);
  });

  it("é simétrica: C(n,k) = C(n,n-k)", () => {
    expect(calculateCombination(25, 15)).toBe(calculateCombination(25, 10));
  });
});

describe("lotteries/combinatorics — calculateOddsOneIn", () => {
  it("aposta de 15 números: 1 em 3.268.760 (a probabilidade oficial da aposta simples)", () => {
    const odds = calculateOddsOneIn({ maxNumber: 25, drawnNumbers: 15, betSize: 15 });
    expect(odds).toBe(3268760);
  });

  it("apostas maiores sempre reduzem o denominador (chance melhora ao cobrir mais combinações)", () => {
    const odds15 = calculateOddsOneIn({ maxNumber: 25, drawnNumbers: 15, betSize: 15 });
    const odds16 = calculateOddsOneIn({ maxNumber: 25, drawnNumbers: 15, betSize: 16 });
    const odds20 = calculateOddsOneIn({ maxNumber: 25, drawnNumbers: 15, betSize: 20 });

    expect(odds16).toBeLessThan(odds15);
    expect(odds20).toBeLessThan(odds16);
  });

  it("aposta de 17 números dá exatamente 1 em 24.035", () => {
    const odds = calculateOddsOneIn({ maxNumber: 25, drawnNumbers: 15, betSize: 17 });
    expect(odds).toBeCloseTo(24035, 0);
  });
});

describe("lotteries/combinatorics — calculateHitDistribution", () => {
  it("aposta de 15: a faixa vai de 5 a 15 acertos (mínimo 5, já que só 10 números ficam de fora da aposta), e a chance de 15 acertos bate com C(25,15)", () => {
    const dist = calculateHitDistribution({ maxNumber: 25, drawnNumbers: 15, betSize: 15 });
    const fifteen = dist.find((entry) => entry.hits === 15);
    expect(fifteen?.probability).toBeCloseTo(1 / 3268760, 12);
    expect(dist[0].hits).toBe(5);
    expect(dist[dist.length - 1].hits).toBe(15);
  });

  it("as probabilidades de todas as faixas de acerto somam 1 (distribuição completa)", () => {
    const dist = calculateHitDistribution({ maxNumber: 25, drawnNumbers: 15, betSize: 18 });
    const total = dist.reduce((sum, entry) => sum + entry.probability, 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("o mínimo de acertos possível respeita quantos números ficaram de fora da aposta", () => {
    // Com 20 apostados (sobram 5 de fora de 25) e 15 sorteados, o mínimo de
    // acertos é 15 - 5 = 10 (na pior hipótese, todos os 5 "de fora" saem).
    const dist = calculateHitDistribution({ maxNumber: 25, drawnNumbers: 15, betSize: 20 });
    expect(dist[0].hits).toBe(10);
  });

  it("retorna lista vazia quando não há combinações possíveis", () => {
    expect(calculateHitDistribution({ maxNumber: 5, drawnNumbers: 15, betSize: 5 })).toEqual([]);
  });
});
