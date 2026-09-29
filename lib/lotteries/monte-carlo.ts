/**
 * Simulação de Monte Carlo — o item do Prompt 1 que ficou fora do MVP por
 * decisão do usuário. Complementa a seção educativa de probabilidade
 * (LotofacilProbabilityEducation.tsx, que já mostra a distribuição EXATA
 * calculada por combinatória): aqui, em vez de calcular, a ferramenta
 * SORTEIA milhares de resultados aleatórios de verdade (no navegador da
 * pessoa) e mostra que a frequência observada converge para a mesma
 * distribuição exata — reforçando visualmente que não existe "truque"
 * nem padrão a explorar, só matemática de probabilidade.
 *
 * Importante: isto é uma simulação estatística, não uma aposta — por
 * isso usa Math.random (via `randomInt` injetável, para os testes
 * poderem usar um gerador determinístico) em vez do `secureRandomInt`
 * criptográfico que o gerador de jogos usa. É só uma questão de
 * desempenho: um botão pode rodar até 1.000.000 de sorteios simulados de
 * uma vez, e não há nenhum requisito de imprevisibilidade criptográfica
 * para uma simulação educativa que ninguém vai jogar.
 */
import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import { calculateHitDistribution, type HitProbability } from "./combinatorics";
import { fullPool, pickRandomSubset } from "./lotofacil-generator";

/** Gerador rápido (não criptográfico) para a simulação — ver comentário do topo do arquivo. */
function fastRandomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export interface HitSimulationEntry extends HitProbability {
  /** Quantas das `trials` simulações caíram nessa quantidade de acertos. */
  simulatedCount: number;
  /** simulatedCount / trials — comparável diretamente com `probability` (a exata). */
  simulatedProbability: number;
}

export interface HitSimulationResult {
  trials: number;
  betSize: number;
  entries: HitSimulationEntry[];
}

export const MONTE_CARLO_TRIAL_OPTIONS: readonly number[] = [1_000, 10_000, 100_000, 1_000_000];

/**
 * Sorteia `trials` resultados aleatórios de {drawnNumbers} dentre
 * {maxNumber} e conta, para uma aposta fixa e arbitrária de `betSize`
 * números (por simetria, tanto faz quais — qualquer combinação de
 * `betSize` números tem a mesma distribuição de acertos), quantas vezes
 * cada quantidade de acertos apareceu. Compara com a distribuição exata
 * (calculateHitDistribution) para a mesma aposta.
 */
export function simulateHitDistribution(params: {
  betSize: number;
  trials: number;
  randomInt?: (maxExclusive: number) => number;
}): HitSimulationResult {
  const { betSize, trials, randomInt = fastRandomInt } = params;
  const { maxNumber, drawnNumbers } = LOTOFACIL_CONFIG;

  const exact = calculateHitDistribution({ maxNumber, drawnNumbers, betSize });
  const counts = new Map<number, number>(exact.map((entry) => [entry.hits, 0]));

  const pool = fullPool();
  const fixedBet = new Set(pool.slice(0, betSize));

  for (let t = 0; t < trials; t += 1) {
    const draw = pickRandomSubset(pool, drawnNumbers, randomInt);
    let hits = 0;
    for (const n of draw) if (fixedBet.has(n)) hits += 1;
    counts.set(hits, (counts.get(hits) ?? 0) + 1);
  }

  const entries: HitSimulationEntry[] = exact.map((entry) => {
    const simulatedCount = counts.get(entry.hits) ?? 0;
    return {
      ...entry,
      simulatedCount,
      simulatedProbability: trials === 0 ? 0 : simulatedCount / trials,
    };
  });

  return { trials, betSize, entries };
}
