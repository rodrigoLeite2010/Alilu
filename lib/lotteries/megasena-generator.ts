/**
 * Núcleo puro do "Gerador Estatístico da Mega-Sena" — nenhuma função aqui
 * toca DOM/React, só números. Isso permite testar tudo diretamente (ver
 * __tests__/lib/lotteries-megasena-generator.test.ts) e reaproveitar as
 * mesmas funções tanto no modo de um jogo quanto na geração de vários.
 *
 * Mesma arquitetura da Lotofácil (lib/lotteries/lotofacil-generator.ts):
 * a parte agnóstica de modalidade mora em lib/lotteries/shared.ts, e este
 * arquivo só faz o que é específico da Mega-Sena (pool 1-60, PRIME_SET
 * com 17 primos, alvos de composição calculados por valor esperado sobre
 * o pool, linhas do volante = 6 de 10 em 10). Fase A (MVP público, sem
 * login): só os modos Aleatório, Equilibrado e Personalizado — o modo
 * "Diversificar" depende do histórico salvo de "Meus Jogos" (Fase B),
 * ainda não implementado para a Mega-Sena.
 *
 * IMPORTANTE (mesmo aviso da página): nada aqui prevê resultado de
 * sorteio. "Equilibrado" e "primos"/"distribuição" são só filtros de
 * composição — cada combinação de 6 a 20 números continua tendo a mesma
 * chance matemática de ser sorteada.
 */
import { MEGASENA_CONFIG, MEGASENA_PRIME_NUMBERS } from "./megasena-config";
import {
  buildLotteryCsv,
  calculateGameSimilarity,
  calculateSum,
  countEvenOdd,
  countPrimes as sharedCountPrimes,
  getLongestSequence,
  getUsedGroups,
  pickRandomSubset,
  secureRandomInt,
} from "./shared";

const PRIME_SET = new Set(MEGASENA_PRIME_NUMBERS);

// --------------------------------------------------------------------------
// Aleatoriedade (delegado a ./shared)
// --------------------------------------------------------------------------

export { secureRandomInt, pickRandomSubset, calculateGameSimilarity };

export function fullPool(): number[] {
  const pool: number[] = [];
  for (let n = MEGASENA_CONFIG.minNumber; n <= MEGASENA_CONFIG.maxNumber; n += 1) pool.push(n);
  return pool;
}

// --------------------------------------------------------------------------
// Análise de um jogo
// --------------------------------------------------------------------------

export interface MegaSenaGameAnalysis {
  numbers: number[];
  count: number;
  even: number;
  odd: number;
  primes: number;
  sum: number;
  longestSequence: number;
  usedRows: number;
  totalRows: number;
}

export { countEvenOdd, calculateSum, getLongestSequence };

/** Quantos primos (entre os 17 primos de 1-60 — PRIME_SET) aparecem em `numbers`. */
export function countPrimes(numbers: readonly number[]): number {
  return sharedCountPrimes(numbers, PRIME_SET);
}

/**
 * Quantas das 6 linhas do volante têm pelo menos um número escolhido. Como
 * as linhas são blocos consecutivos de 10, a linha de um número N é
 * sempre `Math.floor((N - 1) / 10)`.
 */
export function getUsedBoardRows(numbers: readonly number[]): number {
  return getUsedGroups(numbers, 10);
}

export function analyzeGame(numbers: readonly number[]): MegaSenaGameAnalysis {
  const sorted = [...numbers].sort((a, b) => a - b);
  const { even, odd } = countEvenOdd(sorted);

  return {
    numbers: sorted,
    count: sorted.length,
    even,
    odd,
    primes: countPrimes(sorted),
    sum: calculateSum(sorted),
    longestSequence: getLongestSequence(sorted),
    usedRows: getUsedBoardRows(sorted),
    totalRows: 6,
  };
}

// --------------------------------------------------------------------------
// Geração — modo Aleatório
// --------------------------------------------------------------------------

export function generateRandomGame(betSize: number): number[] {
  return pickRandomSubset(fullPool(), betSize);
}

// --------------------------------------------------------------------------
// Geração — modo Equilibrado (filtro de composição, NUNCA previsão)
// --------------------------------------------------------------------------

interface CompositionTargets {
  evenTarget: number;
  primeTarget: number;
}

/**
 * Alvos de composição calculados por valor esperado sobre o próprio pool
 * (diferente da Lotofácil, que usa constantes calibradas manualmente para
 * 15 dezenas): se o pool de 1 a 60 tem 30 números pares e 17 primos,
 * espera-se que uma amostra de `betSize` números tenha, em média,
 * `betSize * 30/60` pares e `betSize * 17/60` primos. Isso é só um filtro
 * de como os números se distribuem, nunca uma alegação de chance maior
 * para a combinação específica gerada.
 */
function getCompositionTargets(betSize: number): CompositionTargets {
  const poolSize = MEGASENA_CONFIG.maxNumber - MEGASENA_CONFIG.minNumber + 1;
  const evensInPool = Math.floor(poolSize / 2);
  const evenTarget = Math.round((betSize * evensInPool) / poolSize);
  const primeTarget = Math.round((betSize * MEGASENA_PRIME_NUMBERS.length) / poolSize);
  return { evenTarget, primeTarget };
}

function scoreComposition(numbers: readonly number[], targets: CompositionTargets): number {
  const analysis = analyzeGame(numbers);
  const parityScore = -Math.abs(analysis.even - targets.evenTarget);
  const primeScore = -Math.abs(analysis.primes - targets.primeTarget);
  const distributionScore = analysis.usedRows;
  return parityScore * 2 + primeScore * 2 + distributionScore;
}

/** Quantos candidatos aleatórios o modo equilibrado/personalizado gera antes de escolher o de melhor pontuação — mantém a função sempre rápida e determinística em tempo. */
const COMPOSITION_CANDIDATE_ATTEMPTS = 30;

function pickBestComposition(buildCandidate: () => number[], targets: CompositionTargets): number[] {
  let best = buildCandidate();
  let bestScore = scoreComposition(best, targets);

  for (let i = 1; i < COMPOSITION_CANDIDATE_ATTEMPTS; i += 1) {
    const candidate = buildCandidate();
    const score = scoreComposition(candidate, targets);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function generateBalancedGame(betSize: number): number[] {
  const targets = getCompositionTargets(betSize);
  return pickBestComposition(() => generateRandomGame(betSize), targets);
}

// --------------------------------------------------------------------------
// Geração — modo Personalizado
// --------------------------------------------------------------------------

export interface MegaSenaCustomOptions {
  mustInclude?: number[];
  mustExclude?: number[];
  /** Aplica o mesmo filtro de composição do modo Equilibrado ao preencher as dezenas que sobrarem. */
  balanced?: boolean;
}

export interface MegaSenaValidationResult {
  valid: boolean;
  error?: string;
}

/** Valida a seleção do modo Personalizado — nunca lança, só relata o que está errado. */
export function validateCustomSelection(
  betSize: number,
  mustInclude: readonly number[] = [],
  mustExclude: readonly number[] = []
): MegaSenaValidationResult {
  const { minNumber, maxNumber, minBetNumbers, maxBetNumbers } = MEGASENA_CONFIG;

  if (!Number.isInteger(betSize) || betSize < minBetNumbers || betSize > maxBetNumbers) {
    return { valid: false, error: `Escolha entre ${minBetNumbers} e ${maxBetNumbers} números.` };
  }

  const outOfRange = [...mustInclude, ...mustExclude].find((n) => n < minNumber || n > maxNumber);
  if (outOfRange !== undefined) {
    return { valid: false, error: `Os números devem estar entre ${minNumber} e ${maxNumber}.` };
  }

  const includeSet = new Set(mustInclude);
  const excludeSet = new Set(mustExclude);
  if (includeSet.size !== mustInclude.length) {
    return { valid: false, error: "Você repetiu o mesmo número na lista de números obrigatórios." };
  }
  if (excludeSet.size !== mustExclude.length) {
    return { valid: false, error: "Você repetiu o mesmo número na lista de números excluídos." };
  }

  const conflict = mustInclude.find((n) => excludeSet.has(n));
  if (conflict !== undefined) {
    return {
      valid: false,
      error: `O número ${conflict} não pode estar marcado como obrigatório e excluído ao mesmo tempo.`,
    };
  }

  if (mustInclude.length > betSize) {
    return {
      valid: false,
      error: `Você marcou mais números obrigatórios (${mustInclude.length}) do que o total de dezenas do jogo (${betSize}).`,
    };
  }

  const poolSize = maxNumber - minNumber + 1 - excludeSet.size;
  if (poolSize < betSize) {
    return { valid: false, error: "Você excluiu números demais para conseguir completar esse jogo." };
  }

  return { valid: true };
}

export function generateCustomGame(betSize: number, options: MegaSenaCustomOptions = {}): number[] {
  const mustInclude = options.mustInclude ?? [];
  const mustExclude = options.mustExclude ?? [];

  const validation = validateCustomSelection(betSize, mustInclude, mustExclude);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const excludeSet = new Set(mustExclude);
  const includeSet = new Set(mustInclude);
  const remainingCount = betSize - mustInclude.length;
  const pool = fullPool().filter((n) => !excludeSet.has(n) && !includeSet.has(n));

  const buildCandidate = () => [...mustInclude, ...pickRandomSubset(pool, remainingCount)].sort((a, b) => a - b);

  if (!options.balanced || remainingCount === 0) {
    return buildCandidate();
  }

  return pickBestComposition(buildCandidate, getCompositionTargets(betSize));
}

// --------------------------------------------------------------------------
// Modos combinados + geração múltipla sem duplicatas
// --------------------------------------------------------------------------

/** Fase A: só os 3 modos que não dependem de histórico salvo. "diversificado" chega na Fase B (Meus Jogos). */
export type MegaSenaMode = "aleatorio" | "equilibrado" | "personalizado";

function gameKey(numbers: readonly number[]): string {
  return numbers.join("-");
}

export function generateGameByMode(
  mode: MegaSenaMode,
  betSize: number,
  options: MegaSenaCustomOptions = {}
): number[] {
  if (mode === "aleatorio") return generateRandomGame(betSize);
  if (mode === "equilibrado") return generateBalancedGame(betSize);
  return generateCustomGame(betSize, options);
}

/**
 * Gera `quantity` jogos distintos entre si. `maxAttempts` é uma rede de
 * segurança para nunca travar o navegador caso `quantity` seja maior do
 * que o espaço de combinações possíveis permitiria gerar sem repetir.
 */
export function generateMultipleGames(
  mode: MegaSenaMode,
  betSize: number,
  quantity: number,
  options: MegaSenaCustomOptions = {}
): number[][] {
  const games: number[][] = [];
  const seen = new Set<string>();
  const maxAttempts = Math.max(quantity * 25, 100);
  let attempts = 0;

  while (games.length < quantity && attempts < maxAttempts) {
    attempts += 1;
    const game = generateGameByMode(mode, betSize, options);
    const key = gameKey(game);
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(game);
  }

  return games;
}

// --------------------------------------------------------------------------
// Exportação
// --------------------------------------------------------------------------

/** CSV simples (uma linha por jogo) para "Baixar CSV". */
export function buildMegaSenaCsv(games: readonly (readonly number[])[]): string {
  return buildLotteryCsv(games);
}
