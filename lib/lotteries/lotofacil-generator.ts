/**
 * Núcleo puro do "Gerador Estatístico da Lotofácil" — nenhuma função aqui
 * toca DOM/React, só números. Isso permite testar tudo diretamente (ver
 * __tests__/lib/lotteries-lotofacil-generator.test.ts) e reaproveitar as
 * mesmas funções tanto no modo de um jogo quanto na geração de vários.
 *
 * IMPORTANTE (mesmo aviso da página): nada aqui prevê resultado de sorteio.
 * "Equilibrado" e "primos"/"distribuição" são só filtros de composição —
 * cada combinação de 15 a 20 números continua tendo a mesma chance
 * matemática de ser sorteada.
 */
import { LOTOFACIL_CONFIG, LOTOFACIL_PRIME_NUMBERS } from "./lotofacil-config";

const PRIME_SET = new Set(LOTOFACIL_PRIME_NUMBERS);

// --------------------------------------------------------------------------
// Aleatoriedade
// --------------------------------------------------------------------------

/**
 * Inteiro aleatório em [0, maxExclusive), usando crypto.getRandomValues
 * quando disponível (navegador ou Node/jsdom modernos) — com rejeição de
 * amostragem para nunca introduzir viés de módulo — e caindo para
 * Math.random apenas se a API não existir.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;

  const cryptoObj: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % maxExclusive);
    const buffer = new Uint32Array(1);
    let value: number;
    do {
      cryptoObj.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

/** Sorteia `count` números distintos de `pool` (Fisher-Yates parcial), já ordenados crescentemente. */
function pickRandomSubset(pool: readonly number[], count: number): number[] {
  const working = [...pool];
  const take = Math.min(count, working.length);
  const picked: number[] = [];

  for (let i = 0; i < take; i += 1) {
    const remaining = working.length - i;
    const index = secureRandomInt(remaining);
    const lastIndex = remaining - 1;
    const chosen = working[index];
    working[index] = working[lastIndex];
    working[lastIndex] = chosen;
    picked.push(chosen);
  }

  return picked.sort((a, b) => a - b);
}

function fullPool(): number[] {
  const pool: number[] = [];
  for (let n = LOTOFACIL_CONFIG.minNumber; n <= LOTOFACIL_CONFIG.maxNumber; n += 1) pool.push(n);
  return pool;
}

// --------------------------------------------------------------------------
// Análise de um jogo
// --------------------------------------------------------------------------

export interface LotofacilGameAnalysis {
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

export function countEvenOdd(numbers: readonly number[]): { even: number; odd: number } {
  let even = 0;
  for (const n of numbers) if (n % 2 === 0) even += 1;
  return { even, odd: numbers.length - even };
}

export function countPrimes(numbers: readonly number[]): number {
  return numbers.filter((n) => PRIME_SET.has(n)).length;
}

export function calculateSum(numbers: readonly number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Maior sequência de números consecutivos (ex.: 03 04 05 → 3). `numbers` não precisa vir ordenado. */
export function getLongestSequence(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);

  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    current = sorted[i] === sorted[i - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * Quantas das 5 linhas do volante (Seção 7) têm pelo menos um número
 * escolhido. Como as linhas são blocos consecutivos de 5, a linha de um
 * número N é sempre `Math.floor((N - 1) / 5)` — sem precisar percorrer a
 * tabela LOTOFACIL_BOARD_ROWS.
 */
export function getUsedBoardRows(numbers: readonly number[]): number {
  const rows = new Set(numbers.map((n) => Math.floor((n - 1) / 5)));
  return rows.size;
}

export function analyzeGame(numbers: readonly number[]): LotofacilGameAnalysis {
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
    totalRows: 5,
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
 * Alvos de composição escalados a partir da referência pedida para 15
 * dezenas (~7/8 pares-ímpares e 5-6 primos — Seções 5 e 6), proporcionais
 * para 16-20. Isso é só um filtro de como os números se distribuem, nunca
 * uma alegação de chance maior para a combinação específica gerada.
 */
function getCompositionTargets(betSize: number): CompositionTargets {
  const evenTarget = Math.round(betSize * (12 / 25));
  const primeTarget = Math.round(betSize * (5.5 / 15));
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

export interface LotofacilCustomOptions {
  mustInclude?: number[];
  mustExclude?: number[];
  /** Aplica o mesmo filtro de composição do modo Equilibrado ao preencher as dezenas que sobrarem. */
  balanced?: boolean;
}

export interface LotofacilValidationResult {
  valid: boolean;
  error?: string;
}

/** Valida a seleção do modo Personalizado — nunca lança, só relata o que está errado (Seção 12: "Validar conflitos"). */
export function validateCustomSelection(
  betSize: number,
  mustInclude: readonly number[] = [],
  mustExclude: readonly number[] = []
): LotofacilValidationResult {
  const { minNumber, maxNumber, minBetNumbers, maxBetNumbers } = LOTOFACIL_CONFIG;

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

export function generateCustomGame(betSize: number, options: LotofacilCustomOptions = {}): number[] {
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

export type LotofacilMode = "aleatorio" | "equilibrado" | "personalizado" | "diversificado";

function gameKey(numbers: readonly number[]): string {
  return numbers.join("-");
}

/** Compara dois jogos (mesmo tamanho ou não) — usado para "esta combinação já existe" e para medir semelhança. */
export function calculateGameSimilarity(gameA: readonly number[], gameB: readonly number[]): number {
  const setB = new Set(gameB);
  const intersectionSize = gameA.filter((n) => setB.has(n)).length;
  const unionSize = new Set([...gameA, ...gameB]).size;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

const DIVERSIFY_CANDIDATE_ATTEMPTS = 30; // mesmo espírito de COMPOSITION_CANDIDATE_ATTEMPTS (pickBestComposition).

/**
 * Modo "Diversificar meus jogos" (a funcionalidade favorita do pedido —
 * Fase 2): gera várias composições Equilibradas candidatas e escolhe a que
 * tem MENOR semelhança máxima (Jaccard, calculateGameSimilarity) com o
 * histórico de jogos já salvos pelo usuário. Isto NÃO aumenta a chance
 * matemática de acertar nenhum jogo — é só uma ferramenta de organização
 * para a pessoa perceber que está repetindo praticamente as mesmas
 * combinações entre apostas. Sem histórico (`pastGames` vazio), não há o
 * que diversificar: cai para o próprio modo Equilibrado.
 */
export function generateDiversifiedGame(betSize: number, pastGames: readonly (readonly number[])[]): number[] {
  if (pastGames.length === 0) return generateBalancedGame(betSize);

  let best: number[] = generateBalancedGame(betSize);
  let bestMaxSimilarity = Math.max(...pastGames.map((game) => calculateGameSimilarity(best, game)));

  for (let attempt = 1; attempt < DIVERSIFY_CANDIDATE_ATTEMPTS; attempt += 1) {
    const candidate = generateBalancedGame(betSize);
    const maxSimilarity = Math.max(...pastGames.map((game) => calculateGameSimilarity(candidate, game)));
    if (maxSimilarity < bestMaxSimilarity) {
      bestMaxSimilarity = maxSimilarity;
      best = candidate;
    }
  }

  return best;
}

export function generateGameByMode(
  mode: LotofacilMode,
  betSize: number,
  options: LotofacilCustomOptions = {},
  pastGames: readonly (readonly number[])[] = []
): number[] {
  if (mode === "aleatorio") return generateRandomGame(betSize);
  if (mode === "equilibrado") return generateBalancedGame(betSize);
  if (mode === "diversificado") return generateDiversifiedGame(betSize, pastGames);
  return generateCustomGame(betSize, options);
}

/**
 * Gera `quantity` jogos distintos entre si (Seção 15: "Evitar duplicação
 * dentro da mesma geração"). `maxAttempts` é uma rede de segurança para
 * nunca travar o navegador caso `quantity` seja maior do que o espaço de
 * combinações possíveis permitiria gerar sem repetir.
 */
export function generateMultipleGames(
  mode: LotofacilMode,
  betSize: number,
  quantity: number,
  options: LotofacilCustomOptions = {},
  pastGames: readonly (readonly number[])[] = []
): number[][] {
  const games: number[][] = [];
  const seen = new Set<string>();
  const maxAttempts = Math.max(quantity * 25, 100);
  let attempts = 0;

  while (games.length < quantity && attempts < maxAttempts) {
    attempts += 1;
    const game = generateGameByMode(mode, betSize, options, pastGames);
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

/** CSV simples (uma linha por jogo) para "Baixar CSV" (Seção 15). */
export function buildLotofacilCsv(games: readonly (readonly number[])[]): string {
  const header = "Jogo,Números";
  const rows = games.map((game, index) => `${index + 1},"${game.join(" ")}"`);
  return [header, ...rows].join("\n");
}
