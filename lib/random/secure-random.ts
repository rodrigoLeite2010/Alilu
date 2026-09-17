/**
 * Fonte de aleatoriedade criptograficamente segura, compartilhada por todos
 * os geradores da categoria "Geradores" (CPF, CNPJ, Cartão de Crédito, e os
 * novos geradores das fases B/C/D). Centralizado aqui para não duplicar a
 * mesma implementação de rejection sampling em cada calculadora — extraído
 * dos arquivos originais de CPF/CNPJ/Cartão, que tinham essa função
 * repetida de forma idêntica em cada um.
 *
 * NUNCA usa `Math.random()`: todo dado sintético "aleatório" desta
 * plataforma usa a Web Crypto API (`crypto.getRandomValues`), disponível
 * nativamente no navegador e no runtime Node/Edge.
 */

/**
 * Sorteia um índice inteiro em [0, maxExclusive) usando
 * `crypto.getRandomValues`, com rejection sampling para não introduzir viés
 * de módulo (evita, por exemplo, que valores baixos saiam com frequência
 * levemente maior que os altos quando maxExclusive não divide 2^32).
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive deve ser um inteiro positivo.");
  }

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error(
      "API Web Crypto (crypto.getRandomValues) indisponível neste ambiente."
    );
  }

  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const array = new Uint32Array(1);

  let value: number;
  do {
    cryptoObj.getRandomValues(array);
    value = array[0];
  } while (value > limit);

  return value % maxExclusive;
}

/** Sorteia um número inteiro em [min, max], incluindo as duas pontas. */
export function secureRandomIntRange(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error("Intervalo inválido: min deve ser <= max, ambos inteiros.");
  }
  return min + secureRandomInt(max - min + 1);
}

/** Sorteia um único dígito (0-9) com fonte segura. */
export function secureRandomDigit(): number {
  return secureRandomInt(10);
}

/** Sorteia um único caractere de uma string não vazia. */
export function secureRandomChar(charset: string): string {
  if (charset.length === 0) {
    throw new Error("charset não pode ser vazio.");
  }
  return charset[secureRandomInt(charset.length)];
}

/** Sorteia um elemento de um array não vazio. */
export function secureRandomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Não é possível sortear de um array vazio.");
  }
  return items[secureRandomInt(items.length)];
}

/**
 * Sorteia `count` elementos DISTINTOS (sem repetição), preservando a ordem
 * do sorteio, com Fisher-Yates parcial sobre `secureRandomInt`.
 */
export function secureRandomSample<T>(items: readonly T[], count: number): T[] {
  if (!Number.isInteger(count) || count < 0 || count > items.length) {
    throw new Error("count deve ser um inteiro entre 0 e o tamanho do array.");
  }

  const pool = [...items];
  const result: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = secureRandomInt(pool.length - i);
    result.push(pool[index]);
    pool[index] = pool[pool.length - i - 1];
  }
  return result;
}
