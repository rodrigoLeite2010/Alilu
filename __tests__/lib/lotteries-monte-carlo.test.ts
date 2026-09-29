import { describe, expect, it } from "vitest";
import { MONTE_CARLO_TRIAL_OPTIONS, simulateHitDistribution } from "@/lib/lotteries/monte-carlo";
import { calculateHitDistribution } from "@/lib/lotteries/combinatorics";

/**
 * Gerador pseudoaleatório determinístico (mulberry32 — boa distribuição
 * mesmo nos bits baixos, ao contrário de um LCG simples), só para os
 * testes: precisamos de resultado reproduzível para poder afirmar "essa
 * simulação converge para a distribuição exata", sem depender do
 * Math.random real (que não dá pra fixar semente).
 */
function makeSeededRandomInt(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0;
  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return (maxExclusive: number) => Math.floor(next() * maxExclusive);
}

describe("lotteries/monte-carlo — simulateHitDistribution", () => {
  it("a soma das contagens simuladas é sempre igual ao número de simulações (trials)", () => {
    const result = simulateHitDistribution({ betSize: 17, trials: 2000, randomInt: makeSeededRandomInt(42) });
    const totalSimulated = result.entries.reduce((sum, entry) => sum + entry.simulatedCount, 0);
    expect(totalSimulated).toBe(2000);
  });

  it("as faixas de acerto simuladas são exatamente as mesmas da distribuição exata", () => {
    const exact = calculateHitDistribution({ maxNumber: 25, drawnNumbers: 15, betSize: 18 });
    const result = simulateHitDistribution({ betSize: 18, trials: 1000, randomInt: makeSeededRandomInt(7) });
    expect(result.entries.map((e) => e.hits)).toEqual(exact.map((e) => e.hits));
  });

  it("com muitas simulações, a frequência observada converge para perto da probabilidade exata", () => {
    // Com muita simulação (80.000), a frequência de CADA faixa de acerto
    // deve ficar perto da probabilidade exata — não precisa bater
    // exatamente (é aleatório), só ficar dentro de uma margem generosa e
    // proporcional ao tamanho esperado de cada faixa (erro-padrão de uma
    // proporção: sqrt(p·(1-p)/trials), com folga de ~8 desvios-padrão).
    const trials = 80000;
    const result = simulateHitDistribution({ betSize: 15, trials, randomInt: makeSeededRandomInt(123) });
    for (const entry of result.entries) {
      const standardError = Math.sqrt((entry.probability * (1 - entry.probability)) / trials);
      const tolerance = Math.max(8 * standardError, 0.001);
      expect(Math.abs(entry.simulatedProbability - entry.probability)).toBeLessThan(tolerance);
    }
  });

  it("zero simulações não quebra e devolve todas as faixas zeradas", () => {
    const result = simulateHitDistribution({ betSize: 15, trials: 0, randomInt: makeSeededRandomInt(1) });
    expect(result.entries.every((entry) => entry.simulatedCount === 0 && entry.simulatedProbability === 0)).toBe(
      true
    );
  });

  it("MONTE_CARLO_TRIAL_OPTIONS está em ordem crescente e não é uma lista vazia", () => {
    expect(MONTE_CARLO_TRIAL_OPTIONS.length).toBeGreaterThan(0);
    const sorted = [...MONTE_CARLO_TRIAL_OPTIONS].sort((a, b) => a - b);
    expect(MONTE_CARLO_TRIAL_OPTIONS).toEqual(sorted);
  });
});
