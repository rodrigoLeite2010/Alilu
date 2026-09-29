import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import type { LotteryFrequencyStats } from "./types";

/**
 * Estatística de frequência PESSOAL (Seção "estatísticas pessoais" da Fase
 * 2): quantas vezes cada número apareceu nos jogos que o PRÓPRIO usuário
 * já salvou. Nunca chamar isto de "probabilidade" em nenhum texto de UI —
 * é só uma contagem descritiva do histórico da pessoa, sem nenhuma relação
 * com a chance matemática de um número ser sorteado (ver
 * LotofacilProbabilityEducation.tsx para a distinção).
 */
export function calculatePersonalFrequency(
  savedGames: readonly (readonly number[])[],
  maxNumber: number = LOTOFACIL_CONFIG.maxNumber
): LotteryFrequencyStats {
  const frequency: Record<number, number> = {};
  for (let n = 1; n <= maxNumber; n += 1) frequency[n] = 0;

  for (const game of savedGames) {
    for (const n of game) {
      if (n >= 1 && n <= maxNumber) frequency[n] = (frequency[n] ?? 0) + 1;
    }
  }

  return { totalGames: savedGames.length, frequency };
}
