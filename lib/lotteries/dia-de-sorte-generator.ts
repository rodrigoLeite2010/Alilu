/**
 * Núcleo puro do "Gerador Estatístico do Dia de Sorte" — nenhuma função
 * aqui toca DOM/React, só números. Isso permite testar tudo diretamente
 * (ver __tests__/lib/lotteries-dia-de-sorte-generator.test.ts) e
 * reaproveitar as mesmas funções tanto no modo de um jogo quanto na
 * geração de vários.
 *
 * Mesma arquitetura da Quina (lib/lotteries/quina-generator.ts): a parte
 * agnóstica de modalidade mora em lib/lotteries/shared.ts, e este arquivo
 * só faz o que é específico do Dia de Sorte (pool 1-31, PRIME_SET com 11
 * primos, alvos de composição calculados por valor esperado sobre o pool,
 * linhas do volante = 7 de 7 em 7).
 *
 * IMPORTANTE — a particularidade estrutural do Dia de Sorte: toda aposta
 * real também exige escolher 1 "Mês da Sorte" (Janeiro a Dezembro), uma
 * segunda dimensão de sorteio completamente independente dos números.
 * DELIBERADAMENTE, nenhuma das funções de geração/análise abaixo
 * (generateRandomGame, generateBalancedGame, generateCustomGame,
 * generateDiversifiedGame, generateGameByMode, generateMultipleGames,
 * analyzeGame) sabe nada sobre mês — elas continuam operando só sobre
 * `number[]`, exatamente como em toda outra modalidade, para não misturar
 * dois conceitos que não têm nenhuma relação matemática entre si (a
 * escolha do mês não influencia nem é influenciada pela escolha dos
 * números). Quem compõe as duas partes em um único "jogo" é a camada de
 * UI (components/lotteries/DiaDeSorteGenerator.tsx), usando o helper
 * `generateRandomMonth()` exportado logo abaixo. Ver o comentário de
 * dia-de-sorte-config.ts para mais contexto.
 *
 * IMPORTANTE (mesmo aviso da página): nada aqui prevê resultado de
 * sorteio. "Equilibrado" e "primos"/"distribuição" são só filtros de
 * composição — cada combinação de 7 a 15 números continua tendo a mesma
 * chance matemática de ser sorteada, e o Mês da Sorte é sorteado de forma
 * totalmente independente dos números.
 */
import { DIA_DE_SORTE_CONFIG, DIA_DE_SORTE_PRIME_NUMBERS } from "./dia-de-sorte-config";
import {
  buildLotteryCsv,
  calculateGameSimilarity as sharedCalculateGameSimilarity,
  calculateSum,
  countEvenOdd,
  countPrimes as sharedCountPrimes,
  getLongestSequence,
  getUsedGroups,
  pickRandomSubset,
  secureRandomInt,
} from "./shared";

const PRIME_SET = new Set(DIA_DE_SORTE_PRIME_NUMBERS);

// --------------------------------------------------------------------------
// Aleatoriedade (delegado a ./shared)
// --------------------------------------------------------------------------

export { secureRandomInt, pickRandomSubset };

/** Compara dois jogos (mesmo tamanho ou não) — usado para "esta combinação já existe" e para medir semelhança. */
export { sharedCalculateGameSimilarity as calculateGameSimilarity };

export function fullPool(): number[] {
  const pool: number[] = [];
  for (let n = DIA_DE_SORTE_CONFIG.minNumber; n <= DIA_DE_SORTE_CONFIG.maxNumber; n += 1) pool.push(n);
  return pool;
}

// --------------------------------------------------------------------------
// O Mês da Sorte — dimensão separada, agnóstica de toda a geração acima
// --------------------------------------------------------------------------

/** Os 12 meses do calendário, em português, na ordem — índice 0 = Janeiro (mês 1), então o rótulo de um mês M é sempre `MONTH_LABELS[M - 1]`. */
export const MONTH_LABELS: readonly string[] = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Sorteia um Mês da Sorte aleatório (1 a 12), usando o mesmo
 * `secureRandomInt` criptográfico de toda a geração de números — nunca
 * `Math.random` direto. Toda aposta do Dia de Sorte exige um mês, então
 * a UI sempre tem um valor aqui, por padrão aleatório, com a pessoa
 * podendo sobrescrever clicando em um dos 12 meses.
 */
export function generateRandomMonth(): number {
  return secureRandomInt(12) + 1;
}

// --------------------------------------------------------------------------
// Análise de um jogo (só números — o mês nunca entra na análise)
// --------------------------------------------------------------------------

export interface DiaDeSorteGameAnalysis {
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

/** Quantos primos (entre os 11 primos de 1-31 — PRIME_SET) aparecem em `numbers`. */
export function countPrimes(numbers: readonly number[]): number {
  return sharedCountPrimes(numbers, PRIME_SET);
}

/**
 * Quantas das 5 linhas do volante (blocos de 7, a última com só 3
 * números) têm pelo menos um número escolhido. O pool do Dia de Sorte
 * começa em 1 (igual à Quina/Mega-Sena/Lotofácil, diferente da
 * Lotomania), então getUsedGroups usa o `minNumber` padrão (1) e não
 * precisa de um terceiro argumento explícito.
 */
export function getUsedBoardRows(numbers: readonly number[]): number {
  return getUsedGroups(numbers, 7);
}

export function analyzeGame(numbers: readonly number[]): DiaDeSorteGameAnalysis {
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
 * Alvos de composição calculados por valor esperado sobre o próprio pool
 * (mesma fórmula da Quina/Mega-Sena/Lotomania): se o pool de 1 a 31 tem
 * 15 números pares (2, 4, ..., 30) e 11 primos, espera-se que uma amostra
 * de `betSize` números tenha, em média, `betSize * 15/31` pares e
 * `betSize * 11/31` primos. Isso é só um filtro de como os números se
 * distribuem, nunca uma alegação de chance maior para a combinação
 * específica gerada.
 */
function getCompositionTargets(betSize: number): CompositionTargets {
  const poolSize = DIA_DE_SORTE_CONFIG.maxNumber - DIA_DE_SORTE_CONFIG.minNumber + 1;
  const evensInPool = Math.floor(poolSize / 2);
  const evenTarget = Math.round((betSize * evensInPool) / poolSize);
  const primeTarget = Math.round((betSize * DIA_DE_SORTE_PRIME_NUMBERS.length) / poolSize);
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

export interface DiaDeSorteCustomOptions {
  mustInclude?: number[];
  mustExclude?: number[];
  /** Aplica o mesmo filtro de composição do modo Equilibrado ao preencher as dezenas que sobrarem. */
  balanced?: boolean;
}

export interface DiaDeSorteValidationResult {
  valid: boolean;
  error?: string;
}

/** Valida a seleção do modo Personalizado — nunca lança, só relata o que está errado. */
export function validateCustomSelection(
  betSize: number,
  mustInclude: readonly number[] = [],
  mustExclude: readonly number[] = []
): DiaDeSorteValidationResult {
  const { minNumber, maxNumber, minBetNumbers, maxBetNumbers } = DIA_DE_SORTE_CONFIG;

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

export function generateCustomGame(betSize: number, options: DiaDeSorteCustomOptions = {}): number[] {
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

/** Os 4 modos, com paridade total desde já no núcleo de geração (a UI desta Fase A só expõe os 3 primeiros — ver DiaDeSorteGenerator.tsx — porque "Diversificar" depende do histórico salvo de "Meus Jogos", que só chega na Fase B). */
export type DiaDeSorteMode = "aleatorio" | "equilibrado" | "personalizado" | "diversificado";

function gameKey(numbers: readonly number[]): string {
  return numbers.join("-");
}

const DIVERSIFY_CANDIDATE_ATTEMPTS = 30; // mesmo espírito de COMPOSITION_CANDIDATE_ATTEMPTS (pickBestComposition).

/**
 * Modo "Diversificar meus jogos" (mesma lógica de quina-generator.ts):
 * gera várias composições Equilibradas candidatas e escolhe a que tem
 * MENOR semelhança máxima (Jaccard, calculateGameSimilarity) com o
 * histórico de jogos já salvos pelo usuário. Isto NÃO aumenta a chance
 * matemática de acertar nenhum jogo — é só uma ferramenta de organização.
 * Pronta e testada desde já, mas sem nenhuma tela que a chame nesta Fase
 * A (não existe histórico sem "Meus Jogos" ainda). Sem histórico
 * (`pastGames` vazio), não há o que diversificar: cai para o próprio
 * modo Equilibrado.
 */
export function generateDiversifiedGame(betSize: number, pastGames: readonly (readonly number[])[]): number[] {
  if (pastGames.length === 0) return generateBalancedGame(betSize);

  let best: number[] = generateBalancedGame(betSize);
  let bestMaxSimilarity = Math.max(...pastGames.map((game) => sharedCalculateGameSimilarity(best, game)));

  for (let attempt = 1; attempt < DIVERSIFY_CANDIDATE_ATTEMPTS; attempt += 1) {
    const candidate = generateBalancedGame(betSize);
    const maxSimilarity = Math.max(...pastGames.map((game) => sharedCalculateGameSimilarity(candidate, game)));
    if (maxSimilarity < bestMaxSimilarity) {
      bestMaxSimilarity = maxSimilarity;
      best = candidate;
    }
  }

  return best;
}

export function generateGameByMode(
  mode: DiaDeSorteMode,
  betSize: number,
  options: DiaDeSorteCustomOptions = {},
  pastGames: readonly (readonly number[])[] = []
): number[] {
  if (mode === "aleatorio") return generateRandomGame(betSize);
  if (mode === "equilibrado") return generateBalancedGame(betSize);
  if (mode === "diversificado") return generateDiversifiedGame(betSize, pastGames);
  return generateCustomGame(betSize, options);
}

/**
 * Gera `quantity` jogos distintos entre si. `maxAttempts` é uma rede de
 * segurança para nunca travar o navegador caso `quantity` seja maior do
 * que o espaço de combinações possíveis permitiria gerar sem repetir.
 */
export function generateMultipleGames(
  mode: DiaDeSorteMode,
  betSize: number,
  quantity: number,
  options: DiaDeSorteCustomOptions = {},
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

/**
 * CSV simples (uma linha por jogo) para "Baixar CSV" — mesmo formato
 * numbers-only de toda outra modalidade (buildLotteryCsv, de ./shared).
 * NÃO inclui o Mês da Sorte: assim como as funções de geração acima, este
 * helper fica deliberadamente agnóstico de mês. O CSV baixado pela tela
 * (DiaDeSorteGenerator.tsx) inclui uma coluna extra de mês compondo os
 * dois por conta própria — ver o comentário lá.
 */
export function buildDiaDeSorteCsv(games: readonly (readonly number[])[]): string {
  return buildLotteryCsv(games);
}
