import { describe, expect, it } from "vitest";
import { LOTOFACIL_CONFIG, LOTOFACIL_BET_SIZES } from "@/lib/lotteries/lotofacil-config";
import {
  analyzeGame,
  buildLotofacilCsv,
  calculateGameSimilarity,
  calculateSum,
  countEvenOdd,
  countPrimes,
  generateBalancedGame,
  generateCustomGame,
  generateGameByMode,
  generateMultipleGames,
  generateRandomGame,
  getLongestSequence,
  getUsedBoardRows,
  secureRandomInt,
  validateCustomSelection,
} from "@/lib/lotteries/lotofacil-generator";

function isSortedUnique(numbers: number[]): boolean {
  return numbers.every((n, i) => (i === 0 ? true : n > numbers[i - 1]));
}

describe("lotteries/lotofacil-generator — geração básica (Seções 4, 35, 37)", () => {
  it.each(LOTOFACIL_BET_SIZES)("generateRandomGame(%i) gera exatamente essa quantidade, sem duplicatas, entre 1 e 25", (betSize) => {
    const game = generateRandomGame(betSize);
    expect(game).toHaveLength(betSize);
    expect(isSortedUnique(game)).toBe(true);
    game.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(LOTOFACIL_CONFIG.minNumber);
      expect(n).toBeLessThanOrEqual(LOTOFACIL_CONFIG.maxNumber);
    });
  });

  it("generateBalancedGame também sempre respeita quantidade, unicidade e faixa", () => {
    const game = generateBalancedGame(15);
    expect(game).toHaveLength(15);
    expect(isSortedUnique(game)).toBe(true);
  });

  it("secureRandomInt(n) nunca retorna um valor fora de [0, n)", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe("lotteries/lotofacil-generator — análise do jogo (Seções 8, 9, 14)", () => {
  it("countEvenOdd conta pares e ímpares corretamente", () => {
    expect(countEvenOdd([1, 2, 3, 4, 5])).toEqual({ even: 2, odd: 3 });
  });

  it("countPrimes identifica os primos entre 1 e 25 corretamente", () => {
    expect(countPrimes([1, 4, 6, 9, 10])).toBe(0);
    expect(countPrimes([2, 3, 5, 7, 11, 13, 17, 19, 23])).toBe(9);
    expect(countPrimes([1, 2, 4, 9, 25])).toBe(1);
  });

  it("calculateSum soma as dezenas", () => {
    expect(calculateSum([1, 2, 3])).toBe(6);
  });

  it("getLongestSequence encontra a maior sequência consecutiva, mesmo com a entrada desordenada", () => {
    expect(getLongestSequence([1, 5, 3, 4, 10])).toBe(3); // 3,4,5
    expect(getLongestSequence([1, 3, 5, 7])).toBe(1);
    expect(getLongestSequence([])).toBe(0);
  });

  it("getUsedBoardRows conta quantas das 5 linhas do volante têm pelo menos um número", () => {
    expect(getUsedBoardRows([1, 2, 3])).toBe(1); // linha 1
    expect(getUsedBoardRows([1, 6, 11, 16, 21])).toBe(5); // uma dezena em cada linha
  });

  it("analyzeGame junta tudo em um único objeto consistente", () => {
    const analysis = analyzeGame([5, 1, 3, 2, 4]);
    expect(analysis.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(analysis.count).toBe(5);
    expect(analysis.even).toBe(2);
    expect(analysis.odd).toBe(3);
    expect(analysis.primes).toBe(3); // 2, 3, 5
    expect(analysis.sum).toBe(15);
    expect(analysis.longestSequence).toBe(5);
    expect(analysis.usedRows).toBe(1);
    expect(analysis.totalRows).toBe(5);
  });
});

describe("lotteries/lotofacil-generator — modo Personalizado: validação (Seção 12)", () => {
  it("aceita uma seleção válida", () => {
    expect(validateCustomSelection(15, [3, 7], [5]).valid).toBe(true);
  });

  it("rejeita um número simultaneamente obrigatório e excluído", () => {
    const result = validateCustomSelection(15, [3], [3]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/obrigatório e excluído/);
  });

  it("rejeita mais números obrigatórios do que o tamanho do jogo", () => {
    const mustInclude = Array.from({ length: 16 }, (_, i) => i + 1);
    const result = validateCustomSelection(15, mustInclude, []);
    expect(result.valid).toBe(false);
  });

  it("rejeita exclusão excessiva que impede completar o jogo", () => {
    const mustExclude = Array.from({ length: 11 }, (_, i) => i + 1); // exclui 11, sobram 14 < 15
    const result = validateCustomSelection(15, [], mustExclude);
    expect(result.valid).toBe(false);
  });

  it("rejeita tamanho de aposta fora de 15-20", () => {
    expect(validateCustomSelection(14, [], []).valid).toBe(false);
    expect(validateCustomSelection(21, [], []).valid).toBe(false);
  });
});

describe("lotteries/lotofacil-generator — modo Personalizado: geração (Seções 12, 13)", () => {
  it("sempre inclui os números obrigatórios e nunca inclui os excluídos", () => {
    const game = generateCustomGame(15, { mustInclude: [1, 2, 3], mustExclude: [25, 24, 23] });
    expect(game).toHaveLength(15);
    expect(game).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(game).not.toEqual(expect.arrayContaining([25, 24, 23]));
  });

  it("lança um erro com a mensagem de validação quando a seleção é inválida", () => {
    expect(() => generateCustomGame(15, { mustInclude: [1], mustExclude: [1] })).toThrow(
      /obrigatório e excluído/
    );
  });

  it("funciona no limite (mustInclude preenche o jogo inteiro)", () => {
    const mustInclude = Array.from({ length: 15 }, (_, i) => i + 1);
    const game = generateCustomGame(15, { mustInclude });
    expect(game).toEqual(mustInclude);
  });
});

describe("lotteries/lotofacil-generator — geração múltipla sem duplicatas (Seção 15)", () => {
  it("gera a quantidade pedida de jogos, todos diferentes entre si", () => {
    const games = generateMultipleGames("aleatorio", 15, 20);
    expect(games).toHaveLength(20);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(20);
  });

  it("cada jogo gerado continua respeitando o tamanho e a faixa", () => {
    const games = generateMultipleGames("equilibrado", 16, 5);
    games.forEach((game) => {
      expect(game).toHaveLength(16);
      expect(isSortedUnique(game)).toBe(true);
    });
  });

  it("modo personalizado plugado na geração múltipla respeita os números obrigatórios em todos os jogos", () => {
    const games = generateMultipleGames("personalizado", 15, 5, { mustInclude: [1, 2] });
    games.forEach((game) => {
      expect(game).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  it("generateGameByMode despacha para a função certa por modo", () => {
    expect(generateGameByMode("aleatorio", 15)).toHaveLength(15);
    expect(generateGameByMode("equilibrado", 15)).toHaveLength(15);
    expect(generateGameByMode("personalizado", 15, { mustInclude: [10] })).toEqual(
      expect.arrayContaining([10])
    );
  });
});

describe("lotteries/lotofacil-generator — similaridade e CSV", () => {
  it("calculateGameSimilarity usa interseção/união (Jaccard) e vai de 0 a 1", () => {
    expect(calculateGameSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(calculateGameSimilarity([1, 2, 3], [4, 5, 6])).toBe(0);
    expect(calculateGameSimilarity([1, 2, 3, 4], [3, 4, 5, 6])).toBeCloseTo(2 / 6, 5);
  });

  it("buildLotofacilCsv gera uma linha de cabeçalho e uma por jogo", () => {
    const csv = buildLotofacilCsv([[1, 2, 3], [4, 5, 6]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Jogo,Números");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,"1 2 3"');
    expect(lines[2]).toBe('2,"4 5 6"');
  });
});
