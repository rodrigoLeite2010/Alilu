import { randomInt } from "node:crypto";

/**
 * Algoritmo do sorteio (puro, sem banco). Problema = emparelhamento perfeito em grafo bipartido
 * (quem tira × quem é tirado) onde as arestas proibidas são: a própria pessoa, restrições e,
 * opcionalmente, o sorteio do ano anterior.
 *
 * 1) Viabilidade exata (Kuhn): se não existe emparelhamento perfeito, NÃO há sorteio possível.
 * 2) Sorteio justo: tentativas de permutação uniformemente aleatória (rejeição) — todo arranjo válido é
 *    igualmente provável, independente de ordem de cadastro/organizador/nomes.
 * 3) Se as restrições deixarem o espaço válido pequeno demais para a rejeição, usa Kuhn embaralhado
 *    (backtracking com augmenting paths), que sempre encontra um arranjo válido se ele existir.
 * Aleatoriedade: crypto.randomInt (CSPRNG), nunca Math.random.
 */

export type RandomInt = (maxExclusive: number) => number;
export const secureRandomInt: RandomInt = (max) => randomInt(0, max);

export function shuffle<T>(items: readonly T[], rnd: RandomInt = secureRandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pairKey = (giver: string, receiver: string) => `${giver}>${receiver}`;

function allowed(ids: readonly string[], forbidden: ReadonlySet<string>): string[][] {
  return ids.map((giver) => ids.filter((receiver) => receiver !== giver && !forbidden.has(pairKey(giver, receiver))));
}

/** Emparelhamento perfeito (Kuhn). `order` embaralha a escolha para variar o resultado. */
function kuhn(ids: readonly string[], adj: string[][], rnd: RandomInt | null): Map<string, string> | null {
  const matchOfReceiver = new Map<string, number>();
  const tryAssign = (giver: number, seen: Set<string>): boolean => {
    const options = rnd ? shuffle(adj[giver], rnd) : adj[giver];
    for (const receiver of options) {
      if (seen.has(receiver)) continue;
      seen.add(receiver);
      const current = matchOfReceiver.get(receiver);
      if (current === undefined || tryAssign(current, seen)) {
        matchOfReceiver.set(receiver, giver);
        return true;
      }
    }
    return false;
  };
  const givers = rnd ? shuffle(ids.map((_, i) => i), rnd) : ids.map((_, i) => i);
  for (const giver of givers) if (!tryAssign(giver, new Set())) return null;
  const result = new Map<string, string>();
  for (const [receiver, giver] of matchOfReceiver) result.set(ids[giver], receiver);
  return result.size === ids.length ? result : null;
}

export function isDrawFeasible(ids: readonly string[], forbidden: ReadonlySet<string>): boolean {
  if (ids.length < 2) return false;
  return kuhn(ids, allowed(ids, forbidden), null) !== null;
}

export function computeDraw(
  ids: readonly string[],
  forbidden: ReadonlySet<string>,
  rnd: RandomInt = secureRandomInt,
  maxRejectionTries = 400,
): Map<string, string> | null {
  if (ids.length < 2) return null;
  const adj = allowed(ids, forbidden);
  if (!kuhn(ids, adj, null)) return null; // inviável: nenhum resultado parcial
  for (let attempt = 0; attempt < maxRejectionTries; attempt += 1) {
    const receivers = shuffle(ids, rnd);
    let ok = true;
    for (let i = 0; i < ids.length; i += 1) {
      if (receivers[i] === ids[i] || forbidden.has(pairKey(ids[i], receivers[i]))) {
        ok = false;
        break;
      }
    }
    if (ok) return new Map(ids.map((giver, i) => [giver, receivers[i]]));
  }
  return kuhn(ids, adj, rnd);
}

/** Confere (defesa em profundidade) que o resultado respeita todas as regras. */
export function isValidDraw(ids: readonly string[], draw: ReadonlyMap<string, string>, forbidden: ReadonlySet<string>): boolean {
  if (draw.size !== ids.length) return false;
  const receivers = new Set<string>();
  for (const giver of ids) {
    const receiver = draw.get(giver);
    if (!receiver || receiver === giver || forbidden.has(pairKey(giver, receiver)) || receivers.has(receiver)) return false;
    receivers.add(receiver);
  }
  return ids.every((id) => receivers.has(id));
}
