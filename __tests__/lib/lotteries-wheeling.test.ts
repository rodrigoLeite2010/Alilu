import { describe, expect, it } from "vitest";
import {
  FULL_WHEEL_MAX_NUMBERS,
  REDUCED_WHEEL_MAX_NUMBERS,
  WHEEL_MIN_NUMBERS,
  countFullWheelGames,
  countReducedWheelGames,
  generateFullWheel,
  generateReducedWheel,
  getReducedWheelGuarantee,
  validateFullWheelSelection,
  validateReducedWheelSelection,
} from "@/lib/lotteries/wheeling";
import { LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";

/**
 * Gera TODAS as combinações de `size` números dentro de `pool` — usada só
 * nos testes, para verificar por força bruta (não reaproveitando
 * generateFullWheel, que tem seu próprio teto de 18 números) tanto a
 * completude do desdobramento completo quanto — principalmente — a
 * garantia matemática do fechamento reduzido para TODOS os sorteios
 * possíveis dentro do grupo escolhido, não só uma amostra.
 */
function allCombinations(pool: readonly number[], size: number): number[][] {
  const sorted = [...pool].sort((a, b) => a - b);
  const combos: number[][] = [];
  const combo: number[] = [];

  function backtrack(start: number) {
    if (combo.length === size) {
      combos.push([...combo]);
      return;
    }
    for (let i = start; i <= sorted.length - (size - combo.length); i += 1) {
      combo.push(sorted[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return combos;
}

function intersectionSize(a: readonly number[], b: readonly number[]): number {
  const setB = new Set(b);
  return a.filter((n) => setB.has(n)).length;
}

function poolOf(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

describe("lotteries/wheeling — validação", () => {
  it("desdobramento completo aceita de 16 a 18 números", () => {
    expect(validateFullWheelSelection(poolOf(15)).valid).toBe(false);
    expect(validateFullWheelSelection(poolOf(16)).valid).toBe(true);
    expect(validateFullWheelSelection(poolOf(18)).valid).toBe(true);
    expect(validateFullWheelSelection(poolOf(19)).valid).toBe(false);
  });

  it("fechamento reduzido aceita de 16 a 20 números", () => {
    expect(validateReducedWheelSelection(poolOf(15)).valid).toBe(false);
    expect(validateReducedWheelSelection(poolOf(16)).valid).toBe(true);
    expect(validateReducedWheelSelection(poolOf(20)).valid).toBe(true);
    expect(validateReducedWheelSelection(poolOf(21)).valid).toBe(false);
  });

  it("rejeita número repetido e número fora do intervalo 1-25", () => {
    expect(validateFullWheelSelection([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14]).valid).toBe(false);
    expect(validateFullWheelSelection([...poolOf(15), 26]).valid).toBe(false);
  });

  it("as constantes de teto batem com o que a validação aplica", () => {
    expect(WHEEL_MIN_NUMBERS).toBe(16);
    expect(FULL_WHEEL_MAX_NUMBERS).toBe(18);
    expect(REDUCED_WHEEL_MAX_NUMBERS).toBe(LOTOFACIL_CONFIG.maxBetNumbers);
  });
});

describe("lotteries/wheeling — desdobramento completo", () => {
  it.each([16, 17, 18])("com %i números, gera exatamente C(n,15) jogos, todos distintos", (count) => {
    const pool = poolOf(count);
    const games = generateFullWheel(pool);
    expect(games).toHaveLength(countFullWheelGames(count));

    const keys = new Set(games.map((game) => game.join("-")));
    expect(keys.size).toBe(games.length);
  });

  it("cada jogo tem 15 números, todos dentro do grupo escolhido e ordenados", () => {
    const pool = poolOf(16);
    const games = generateFullWheel(pool);
    for (const game of games) {
      expect(game).toHaveLength(15);
      expect([...game].sort((a, b) => a - b)).toEqual(game);
      for (const n of game) expect(pool).toContain(n);
    }
  });

  it("com 16 números, o desdobramento é EXATAMENTE igual a todas as combinações possíveis (cobertura total)", () => {
    const pool = poolOf(16);
    const games = new Set(generateFullWheel(pool).map((g) => g.join("-")));
    const expected = new Set(allCombinations(pool, 15).map((g) => g.join("-")));
    expect(games).toEqual(expected);
  });

  it("recusa fora do intervalo permitido (15 ou 19 números)", () => {
    expect(() => generateFullWheel(poolOf(15))).toThrow();
    expect(() => generateFullWheel(poolOf(19))).toThrow();
  });
});

describe("lotteries/wheeling — fechamento reduzido: quantidade de jogos e garantia declarada", () => {
  it.each([
    [16, 16, 15],
    [17, 8, 14],
    [18, 6, 13],
    [19, 4, 12],
    [20, 4, 11],
  ])("com %i números: %i jogos, garantindo %i pontos", (count, expectedGames, expectedGuarantee) => {
    expect(countReducedWheelGames(count)).toBe(expectedGames);
    expect(getReducedWheelGuarantee(count)).toBe(expectedGuarantee);

    const result = generateReducedWheel(poolOf(count));
    expect(result.games).toHaveLength(expectedGames);
    expect(result.guaranteedHits).toBe(expectedGuarantee);
  });

  it("cada jogo do fechamento tem 15 números distintos, dentro do grupo escolhido", () => {
    const pool = poolOf(18);
    const { games } = generateReducedWheel(pool);
    for (const game of games) {
      expect(game).toHaveLength(15);
      expect(new Set(game).size).toBe(15);
      for (const n of game) expect(pool).toContain(n);
    }
  });

  it("os jogos gerados são sempre distintos entre si", () => {
    const { games } = generateReducedWheel(poolOf(20));
    const keys = new Set(games.map((g) => g.join("-")));
    expect(keys.size).toBe(games.length);
  });

  it("recusa fora do intervalo permitido (15 ou 21 números)", () => {
    expect(() => generateReducedWheel(poolOf(15))).toThrow();
    expect(() => generateReducedWheel(poolOf(21))).toThrow();
  });
});

describe("lotteries/wheeling — PROVA por força bruta da garantia do fechamento reduzido", () => {
  // O coração da funcionalidade: para cada N de 16 a 20, testamos TODOS os
  // C(N,15) sorteios possíveis dentro do grupo escolhido (não uma amostra)
  // e confirmamos que pelo menos um dos jogos gerados acerta no mínimo a
  // quantidade de pontos prometida por getReducedWheelGuarantee. Isso não
  // é uma checagem estatística — é uma verificação exaustiva de TODO o
  // espaço de sorteios possível, a mesma exigência que o resto do projeto
  // aplica a qualquer número mostrado ao usuário (nunca fabricado, sempre
  // calculado e, aqui, também comprovado por computação).
  it.each([16, 17, 18, 19, 20])(
    "com %i números: TODO sorteio possível dentro do grupo acerta pelo menos a garantia prometida em algum jogo",
    (count) => {
      const pool = poolOf(count);
      const { games, guaranteedHits } = generateReducedWheel(pool);
      const allDraws = allCombinations(pool, LOTOFACIL_CONFIG.drawnNumbers);

      let worstCaseBestHit = 15;
      for (const draw of allDraws) {
        const bestHitForThisDraw = Math.max(...games.map((game) => intersectionSize(game, draw)));
        expect(bestHitForThisDraw).toBeGreaterThanOrEqual(guaranteedHits);
        worstCaseBestHit = Math.min(worstCaseBestHit, bestHitForThisDraw);
      }

      // A garantia é ajustada (nunca otimista): o pior caso real observado
      // não pode ficar ABAIXO do prometido.
      expect(worstCaseBestHit).toBeGreaterThanOrEqual(guaranteedHits);
    }
  );

  it("a garantia prometida realmente depende da cobertura: um único jogo qualquer NÃO garante o mesmo mínimo", () => {
    // Contraprova: se a garantia fosse "de graça" (qualquer jogo isolado já
    // bastasse), o fechamento reduzido não teria valor nenhum sobre uma
    // aposta simples. Aqui confirmamos que existe pelo menos um sorteio
    // possível para o qual UM jogo isolado (o primeiro gerado) acerta menos
    // que a garantia — só o CONJUNTO de jogos garante o mínimo.
    const pool = poolOf(18);
    const { games, guaranteedHits } = generateReducedWheel(pool);
    const allDraws = allCombinations(pool, LOTOFACIL_CONFIG.drawnNumbers);
    const singleGame = games[0];

    const hasDrawBelowGuaranteeForSingleGame = allDraws.some(
      (draw) => intersectionSize(singleGame, draw) < guaranteedHits
    );
    expect(hasDrawBelowGuaranteeForSingleGame).toBe(true);
  });
});
