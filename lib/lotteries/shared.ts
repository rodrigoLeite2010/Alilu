/**
 * Núcleo puro REUTILIZÁVEL entre modalidades de loteria (Lotofácil,
 * Mega-Sena e as que vierem depois: Quina, Lotomania, Dia de Sorte).
 *
 * Tudo aqui é agnóstico de modalidade — nenhuma constante 1/25/15/20 (ou
 * 1/60/6) solta pelo código; cada função recebe como parâmetro o que muda
 * de uma loteria para outra (pool, prime set, tamanho de grupo do volante,
 * etc.). As funções específicas da Lotofácil continuam em
 * lib/lotteries/lotofacil-generator.ts (que agora delega para cá) e as da
 * Mega-Sena em lib/lotteries/megasena-generator.ts.
 */

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

/**
 * Sorteia `count` números distintos de `pool` (Fisher-Yates parcial), já
 * ordenados crescentemente. `randomInt` é injetável (padrão
 * `secureRandomInt`) para permitir reaproveitar este mesmo sorteio em
 * lib/lotteries/monte-carlo.ts com um gerador mais rápido (Math.random) —
 * ali não é uma aposta de verdade, só uma simulação estatística, então não
 * precisa da garantia criptográfica.
 */
export function pickRandomSubset(
  pool: readonly number[],
  count: number,
  randomInt: (maxExclusive: number) => number = secureRandomInt
): number[] {
  const working = [...pool];
  const take = Math.min(count, working.length);
  const picked: number[] = [];

  for (let i = 0; i < take; i += 1) {
    const remaining = working.length - i;
    const index = randomInt(remaining);
    const lastIndex = remaining - 1;
    const chosen = working[index];
    working[index] = working[lastIndex];
    working[lastIndex] = chosen;
    picked.push(chosen);
  }

  return picked.sort((a, b) => a - b);
}

// --------------------------------------------------------------------------
// Comparação entre jogos
// --------------------------------------------------------------------------

/** Compara dois jogos (mesmo tamanho ou não) — usado para "esta combinação já existe" e para medir semelhança. */
export function calculateGameSimilarity(gameA: readonly number[], gameB: readonly number[]): number {
  const setB = new Set(gameB);
  const intersectionSize = gameA.filter((n) => setB.has(n)).length;
  const unionSize = new Set([...gameA, ...gameB]).size;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

// --------------------------------------------------------------------------
// Análise de um jogo
// --------------------------------------------------------------------------

export function countEvenOdd(numbers: readonly number[]): { even: number; odd: number } {
  let even = 0;
  for (const n of numbers) if (n % 2 === 0) even += 1;
  return { even, odd: numbers.length - even };
}

/**
 * Conta quantos de `numbers` são primos, segundo `primeSet` — o conjunto
 * de primos é sempre passado explicitamente (parâmetro, não constante de
 * módulo), porque cada modalidade tem sua própria faixa de números e,
 * portanto, seu próprio conjunto de primos.
 */
export function countPrimes(numbers: readonly number[], primeSet: ReadonlySet<number>): number {
  return numbers.filter((n) => primeSet.has(n)).length;
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
 * Quantos grupos consecutivos de `groupSize` números (as "linhas" do
 * volante oficial de cada modalidade — 5 na Lotofácil, 10 na Mega-Sena)
 * têm pelo menos um número escolhido. O grupo de um número N é sempre
 * `Math.floor((N - 1) / groupSize)` — sem precisar percorrer nenhuma
 * tabela de linhas do volante.
 */
export function getUsedGroups(numbers: readonly number[], groupSize: number): number {
  const groups = new Set(numbers.map((n) => Math.floor((n - 1) / groupSize)));
  return groups.size;
}

// --------------------------------------------------------------------------
// Exportação
// --------------------------------------------------------------------------

/** CSV simples (uma linha por jogo) para "Baixar CSV" — mesmo formato para qualquer modalidade. */
export function buildLotteryCsv(games: readonly (readonly number[])[]): string {
  const header = "Jogo,Números";
  const rows = games.map((game, index) => `${index + 1},"${game.join(" ")}"`);
  return [header, ...rows].join("\n");
}
