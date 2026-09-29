import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import type { LotteryFrequencyStats } from "./types";

/**
 * Estatística de frequência PESSOAL (Seção "estatísticas pessoais" da Fase
 * 2): quantas vezes cada número apareceu nos jogos que o PRÓPRIO usuário
 * já salvou. Nunca chamar isto de "probabilidade" em nenhum texto de UI —
 * é só uma contagem descritiva do histórico da pessoa, sem nenhuma relação
 * com a chance matemática de um número ser sorteado (ver
 * LotofacilProbabilityEducation.tsx para a distinção).
 *
 * `minNumber` tem padrão 1 porque Lotofácil, Mega-Sena e Quina começam em
 * 1 (todo chamador existente não passa esse terceiro argumento, então o
 * comportamento delas fica idêntico a antes — mesmo padrão de
 * compatibilidade retroativa usado em getUsedGroups, ver
 * lib/lotteries/shared.ts). A Lotomania é a única modalidade que começa em
 * 0 (`minNumber: 0`) e por isso PRECISA passar esse argumento — sem ele, o
 * número 0 salvo pelo usuário nunca seria contado (`n >= 1` excluiria) nem
 * apareceria como chave no objeto de frequência devolvido.
 */
export function calculatePersonalFrequency(
  savedGames: readonly (readonly number[])[],
  maxNumber: number = LOTOFACIL_CONFIG.maxNumber,
  minNumber: number = 1
): LotteryFrequencyStats {
  const frequency: Record<number, number> = {};
  for (let n = minNumber; n <= maxNumber; n += 1) frequency[n] = 0;

  for (const game of savedGames) {
    for (const n of game) {
      if (n >= minNumber && n <= maxNumber) frequency[n] = (frequency[n] ?? 0) + 1;
    }
  }

  return { totalGames: savedGames.length, frequency };
}
