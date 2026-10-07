/**
 * Aleatoriedade DETERMINÍSTICA: a mesma semente sempre dá a mesma
 * sequência. É o que torna o plano do Story estável — um retry do mesmo
 * horário (mesma semente) escolhe o MESMO tipo/tema, e os testes são
 * reproduzíveis. A semente de produção é "<automação>|<horário agendado>".
 */

/** FNV-1a 32 bits. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Rng = () => number;

/** mulberry32 — devolve números em [0, 1). */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sorteio ponderado; pesos ≤ 0 nunca saem. Lista sem peso positivo → sorteio uniforme. */
export function weightedPick<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T {
  if (items.length === 0) throw new Error("weightedPick: lista vazia.");
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let cursor = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return items[index];
  }
  return items[items.length - 1];
}
