/**
 * Desdobramento (wheeling) da Lotofácil — os dois itens do Prompt 1 que
 * ficaram fora do MVP por decisão do usuário: "desdobramento/wheeling
 * completo" e "fechamento reduzido com algoritmo de diversidade".
 *
 * As duas ferramentas partem da mesma ideia (você escolhe um grupo de N
 * números, maior que 15, e o sistema monta os jogos por você):
 *
 * - Desdobramento completo (`generateFullWheel`): gera TODAS as
 *   combinações possíveis de 15 números dentro do grupo escolhido —
 *   C(N,15) jogos. Cobertura total, sem nenhuma garantia "extra" além da
 *   cobertura matemática normal. Limitado a 18 números (no máximo 816
 *   jogos) para nunca gerar uma quantidade impraticável de listar/copiar.
 *
 * - Fechamento reduzido (`generateReducedWheel`): usa MUITO menos jogos
 *   que o desdobramento completo, mas com uma GARANTIA MATEMÁTICA REAL —
 *   não uma estimativa nem um "algoritmo de diversidade" informal: "se as
 *   15 dezenas sorteadas estiverem todas entre os N números escolhidos,
 *   pelo menos um dos jogos gerados vai acertar no mínimo M pontos".
 *
 *   A prova (curta, por contagem):
 *   1. Particione os N números escolhidos (embaralhados, para não
 *      favorecer nenhuma ordem) em k = floor(N / c) grupos disjuntos de
 *      c = N-15 números cada, onde N-L números ficam cobertos por algum
 *      grupo e L = N mod c (sempre < c) ficam de fora de todo grupo.
 *   2. Para cada grupo G_i, jogue g_i = (os N números) menos G_i — um
 *      jogo de 15 números.
 *   3. Para qualquer sorteio D (15 números, D ⊆ os N escolhidos): como
 *      k·c = N-L > 15 sempre que N ≥ 16 (porque L < c = N-15, então
 *      N-L > N-(N-15) = 15), D nunca tem números suficientes para conter
 *      TODOS os k grupos inteiros ao mesmo tempo — logo, para pelo menos
 *      um grupo G_i, D deixa de fora pelo menos 1 número de G_i, ou seja
 *      |D ∩ G_i| ≤ c-1. Como |g_i ∩ D| = 15 - |D ∩ G_i| (porque g_i é o
 *      complemento de G_i dentro do conjunto de N números, e D está
 *      inteiro dentro desse conjunto de N), esse mesmo jogo g_i acerta
 *      pelo menos 15-(c-1) = 16-c = 31-N pontos.
 *
 *   Essa garantia (`getReducedWheelGuarantee`) e a construção acima são
 *   verificadas de forma exaustiva (testando TODOS os sorteios possíveis
 *   dentro do grupo escolhido, não só uma amostra) em
 *   __tests__/lib/lotteries-wheeling.test.ts — não é só uma alegação, é
 *   demonstrada por computação para N de 16 a 20.
 *
 * IMPORTANTE (mesmo aviso do resto da categoria Loterias): nenhuma das
 * duas ferramentas aumenta a chance matemática de acertar as 15 dezenas
 * sorteadas — cada combinação de 15 números continua tendo exatamente a
 * mesma chance (1 em 3.268.760). O que muda é quantas combinações essa
 * aposta cobre ao mesmo tempo (desdobramento completo) ou qual garantia
 * de acerto PARCIAL ela assegura, condicionada ao sorteio inteiro ter
 * caído dentro do grupo escolhido (fechamento reduzido).
 */
import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import { calculateCombination } from "./combinatorics";
import { secureRandomInt } from "./lotofacil-generator";

export const WHEEL_MIN_NUMBERS = 16;
/** Acima disso o desdobramento completo passaria de 816 jogos — deixa de ser prático de listar/copiar. */
export const FULL_WHEEL_MAX_NUMBERS = 18;
/** Mesmo teto de números que o gerador normal já permite (LOTOFACIL_CONFIG.maxBetNumbers). */
export const REDUCED_WHEEL_MAX_NUMBERS = LOTOFACIL_CONFIG.maxBetNumbers;

export interface WheelValidationResult {
  valid: boolean;
  error?: string;
}

function validateNumberPool(numbers: readonly number[], min: number, max: number): WheelValidationResult {
  if (!Array.isArray(numbers) || numbers.length < min || numbers.length > max) {
    return { valid: false, error: `Escolha entre ${min} e ${max} números.` };
  }
  const outOfRange = numbers.find((n) => n < LOTOFACIL_CONFIG.minNumber || n > LOTOFACIL_CONFIG.maxNumber);
  if (outOfRange !== undefined) {
    return {
      valid: false,
      error: `Os números devem estar entre ${LOTOFACIL_CONFIG.minNumber} e ${LOTOFACIL_CONFIG.maxNumber}.`,
    };
  }
  if (new Set(numbers).size !== numbers.length) {
    return { valid: false, error: "Você repetiu o mesmo número na lista." };
  }
  return { valid: true };
}

export function validateFullWheelSelection(numbers: readonly number[]): WheelValidationResult {
  return validateNumberPool(numbers, WHEEL_MIN_NUMBERS, FULL_WHEEL_MAX_NUMBERS);
}

export function validateReducedWheelSelection(numbers: readonly number[]): WheelValidationResult {
  return validateNumberPool(numbers, WHEEL_MIN_NUMBERS, REDUCED_WHEEL_MAX_NUMBERS);
}

/** Quantos jogos o desdobramento completo de `count` números vai gerar: C(count, 15). */
export function countFullWheelGames(count: number): number {
  return calculateCombination(count, LOTOFACIL_CONFIG.drawnNumbers);
}

/**
 * Gera todas as combinações de `LOTOFACIL_CONFIG.drawnNumbers` números
 * dentro de `numbers` (cada jogo já ordenado). Backtracking simples — o
 * teto de FULL_WHEEL_MAX_NUMBERS (18 números → no máximo 816 combinações)
 * existe justamente para isso nunca gerar uma quantidade impraticável.
 */
export function generateFullWheel(numbers: readonly number[]): number[][] {
  const validation = validateFullWheelSelection(numbers);
  if (!validation.valid) throw new Error(validation.error);

  const sorted = [...numbers].sort((a, b) => a - b);
  const { drawnNumbers } = LOTOFACIL_CONFIG;
  const games: number[][] = [];
  const combo: number[] = [];

  function backtrack(start: number) {
    if (combo.length === drawnNumbers) {
      games.push([...combo]);
      return;
    }
    const remainingNeeded = drawnNumbers - combo.length;
    for (let i = start; i <= sorted.length - remainingNeeded; i += 1) {
      combo.push(sorted[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return games;
}

// --------------------------------------------------------------------------
// Fechamento reduzido (garantia matemática real — ver prova no topo do arquivo)
// --------------------------------------------------------------------------

/**
 * Quantos pontos o fechamento reduzido de `count` números garante, SE as
 * 15 dezenas sorteadas estiverem todas entre os `count` números
 * escolhidos. Fórmula M = 31 - count, derivada e comprovada no comentário
 * do topo deste arquivo (e verificada exaustivamente nos testes).
 */
export function getReducedWheelGuarantee(count: number): number {
  return 31 - count;
}

/** Quantos jogos o fechamento reduzido de `count` números vai gerar: floor(count / (count - 15)). */
export function countReducedWheelGames(count: number): number {
  const complement = count - LOTOFACIL_CONFIG.drawnNumbers;
  return Math.floor(count / complement);
}

export interface ReducedWheelResult {
  games: number[][];
  guaranteedHits: number;
}

function shuffleNumbers(numbers: readonly number[]): number[] {
  const working = [...numbers];
  for (let i = working.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    const tmp = working[i];
    working[i] = working[j];
    working[j] = tmp;
  }
  return working;
}

/**
 * Gera o fechamento reduzido: particiona os números escolhidos
 * (embaralhados, para não favorecer nenhuma ordem de digitação) em grupos
 * de tamanho `count - 15` e joga, em cada jogo, todos os números
 * escolhidos MENOS um desses grupos — ver a prova da garantia no
 * comentário do topo do arquivo.
 */
export function generateReducedWheel(numbers: readonly number[]): ReducedWheelResult {
  const validation = validateReducedWheelSelection(numbers);
  if (!validation.valid) throw new Error(validation.error);

  const complement = numbers.length - LOTOFACIL_CONFIG.drawnNumbers;
  const shuffled = shuffleNumbers(numbers);
  const fullSet = [...numbers].sort((a, b) => a - b);

  const games: number[][] = [];
  const groupCount = Math.floor(shuffled.length / complement);
  for (let g = 0; g < groupCount; g += 1) {
    const group = new Set(shuffled.slice(g * complement, (g + 1) * complement));
    games.push(fullSet.filter((n) => !group.has(n)));
  }

  return { games, guaranteedHits: getReducedWheelGuarantee(numbers.length) };
}
