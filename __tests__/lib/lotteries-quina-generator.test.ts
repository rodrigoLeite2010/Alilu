import { describe, expect, it } from "vitest";
import { QUINA_CONFIG, QUINA_BET_SIZES } from "@/lib/lotteries/quina-config";
import {
  analyzeGame,
  buildQuinaCsv,
  calculateGameSimilarity,
  calculateSum,
  countEvenOdd,
  countPrimes,
  generateBalancedGame,
  generateCustomGame,
  generateDiversifiedGame,
  generateGameByMode,
  generateMultipleGames,
  generateRandomGame,
  getLongestSequence,
  getUsedBoardRows,
  secureRandomInt,
  validateCustomSelection,
} from "@/lib/lotteries/quina-generator";

function isSortedUnique(numbers: number[]): boolean {
  return numbers.every((n, i) => (i === 0 ? true : n > numbers[i - 1]));
}

describe("lotteries/quina-generator — geração básica", () => {
  it.each(QUINA_BET_SIZES)(
    "generateRandomGame(%i) gera exatamente essa quantidade, sem duplicatas, entre 1 e 80",
    (betSize) => {
      const game = generateRandomGame(betSize);
      expect(game).toHaveLength(betSize);
      expect(isSortedUnique(game)).toBe(true);
      game.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(QUINA_CONFIG.minNumber);
        expect(n).toBeLessThanOrEqual(QUINA_CONFIG.maxNumber);
      });
    }
  );

  it("generateBalancedGame também sempre respeita quantidade, unicidade e faixa", () => {
    const game = generateBalancedGame(5);
    expect(game).toHaveLength(5);
    expect(isSortedUnique(game)).toBe(true);
    game.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(80);
    });
  });

  it("secureRandomInt(n) nunca retorna um valor fora de [0, n)", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe("lotteries/quina-generator — análise do jogo", () => {
  it("countEvenOdd conta pares e ímpares corretamente", () => {
    expect(countEvenOdd([1, 2, 3, 4, 5])).toEqual({ even: 2, odd: 3 });
  });

  it("countPrimes identifica os 22 primos entre 1 e 80 corretamente", () => {
    expect(countPrimes([1, 4, 6, 9, 10])).toBe(0);
    expect(
      countPrimes([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79])
    ).toBe(22);
    expect(countPrimes([1, 2, 4, 9, 80])).toBe(1);
  });

  it("calculateSum soma as dezenas", () => {
    expect(calculateSum([1, 2, 3])).toBe(6);
  });

  it("getLongestSequence encontra a maior sequência consecutiva, mesmo com a entrada desordenada", () => {
    expect(getLongestSequence([1, 5, 3, 4, 10])).toBe(3); // 3,4,5
    expect(getLongestSequence([1, 3, 5, 7])).toBe(1);
    expect(getLongestSequence([])).toBe(0);
  });

  it("getUsedBoardRows conta quantas das 8 linhas do volante (blocos de 10) têm pelo menos um número", () => {
    expect(getUsedBoardRows([1, 2, 3])).toBe(1); // linha 1 (01-10)
    expect(getUsedBoardRows([1, 15, 25, 35, 45, 55, 65, 75])).toBe(8); // uma dezena em cada linha
  });

  it("analyzeGame junta tudo em um único objeto consistente, com totalRows = 8", () => {
    const analysis = analyzeGame([5, 1, 3, 2, 80]);
    expect(analysis.numbers).toEqual([1, 2, 3, 5, 80]);
    expect(analysis.count).toBe(5);
    expect(analysis.even).toBe(2); // 2, 80
    expect(analysis.odd).toBe(3);
    expect(analysis.primes).toBe(3); // 2, 3, 5
    expect(analysis.sum).toBe(91);
    expect(analysis.longestSequence).toBe(3); // 1,2,3
    expect(analysis.usedRows).toBe(2); // linha 01-10 e linha 71-80
    expect(analysis.totalRows).toBe(8);
  });
});

describe("lotteries/quina-generator — modo Personalizado: validação", () => {
  it("aceita uma seleção válida", () => {
    expect(validateCustomSelection(5, [3, 7], [5]).valid).toBe(true);
  });

  it("rejeita um número simultaneamente obrigatório e excluído", () => {
    const result = validateCustomSelection(5, [3], [3]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/obrigatório e excluído/);
  });

  it("rejeita mais números obrigatórios do que o tamanho do jogo", () => {
    const mustInclude = Array.from({ length: 6 }, (_, i) => i + 1);
    const result = validateCustomSelection(5, mustInclude, []);
    expect(result.valid).toBe(false);
  });

  it("rejeita exclusão excessiva que impede completar o jogo", () => {
    const mustExclude = Array.from({ length: 76 }, (_, i) => i + 1); // exclui 76, sobram 4 < 5
    const result = validateCustomSelection(5, [], mustExclude);
    expect(result.valid).toBe(false);
  });

  it("rejeita tamanho de aposta fora de 5-15", () => {
    expect(validateCustomSelection(4, [], []).valid).toBe(false);
    expect(validateCustomSelection(16, [], []).valid).toBe(false);
  });

  it("rejeita números fora da faixa 1-80", () => {
    expect(validateCustomSelection(5, [0], []).valid).toBe(false);
    expect(validateCustomSelection(5, [81], []).valid).toBe(false);
  });
});

describe("lotteries/quina-generator — modo Personalizado: geração", () => {
  it("sempre inclui os números obrigatórios e nunca inclui os excluídos", () => {
    const game = generateCustomGame(5, { mustInclude: [1, 2, 3], mustExclude: [78, 79, 80] });
    expect(game).toHaveLength(5);
    expect(game).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(game).not.toEqual(expect.arrayContaining([78, 79, 80]));
  });

  it("lança um erro com a mensagem de validação quando a seleção é inválida", () => {
    expect(() => generateCustomGame(5, { mustInclude: [1], mustExclude: [1] })).toThrow(/obrigatório e excluído/);
  });

  it("funciona no limite (mustInclude preenche o jogo inteiro)", () => {
    const mustInclude = Array.from({ length: 5 }, (_, i) => i + 1);
    const game = generateCustomGame(5, { mustInclude });
    expect(game).toEqual(mustInclude);
  });

  it("balanced: true aplica o filtro de composição ao completar o restante", () => {
    const game = generateCustomGame(10, { mustInclude: [1], balanced: true });
    expect(game).toHaveLength(10);
    expect(game).toEqual(expect.arrayContaining([1]));
  });
});

describe("lotteries/quina-generator — geração múltipla sem duplicatas", () => {
  it("gera a quantidade pedida de jogos, todos diferentes entre si", () => {
    const games = generateMultipleGames("aleatorio", 5, 20);
    expect(games).toHaveLength(20);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(20);
  });

  it("cada jogo gerado continua respeitando o tamanho e a faixa", () => {
    const games = generateMultipleGames("equilibrado", 7, 5);
    games.forEach((game) => {
      expect(game).toHaveLength(7);
      expect(isSortedUnique(game)).toBe(true);
    });
  });

  it("modo personalizado plugado na geração múltipla respeita os números obrigatórios em todos os jogos", () => {
    const games = generateMultipleGames("personalizado", 5, 5, { mustInclude: [1, 2] });
    games.forEach((game) => {
      expect(game).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  it("generateGameByMode despacha para a função certa por modo", () => {
    expect(generateGameByMode("aleatorio", 5)).toHaveLength(5);
    expect(generateGameByMode("equilibrado", 5)).toHaveLength(5);
    expect(generateGameByMode("personalizado", 5, { mustInclude: [10] })).toEqual(expect.arrayContaining([10]));
  });
});

describe("lotteries/quina-generator — similaridade e CSV", () => {
  it("calculateGameSimilarity (reexportado de shared) usa interseção/união (Jaccard)", () => {
    expect(calculateGameSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(calculateGameSimilarity([1, 2, 3], [4, 5, 6])).toBe(0);
  });

  it("buildQuinaCsv gera uma linha de cabeçalho e uma por jogo", () => {
    const csv = buildQuinaCsv([[1, 2, 3], [4, 5, 6]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Jogo,Números");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,"1 2 3"');
    expect(lines[2]).toBe('2,"4 5 6"');
  });
});

describe("lotteries/quina-generator — diversificar meus jogos", () => {
  it("sem histórico, cai para o modo Equilibrado (jogo válido de qualquer forma)", () => {
    const game = generateDiversifiedGame(5, []);
    expect(game).toHaveLength(5);
    expect(new Set(game).size).toBe(5);
  });

  it("prefere um candidato com menor semelhança máxima em relação ao histórico", () => {
    // Histórico = o mesmo jogo repetido duas vezes de propósito, para o
    // candidato ter, obrigatoriamente, uma semelhança menor do que 1 com
    // pelo menos um deles (não pode repetir os mesmos 5 números duas vezes
    // seguidas neste teste, já que ele teria de "vencer" a si mesmo).
    const pastGame = [1, 2, 3, 4, 5];
    const diversified = generateDiversifiedGame(5, [pastGame, pastGame]);

    expect(diversified).toHaveLength(5);
    expect(calculateGameSimilarity(diversified, pastGame)).toBeLessThan(1);
  });

  it("generateGameByMode despacha 'diversificado' para generateDiversifiedGame", () => {
    const pastGame = [1, 2, 3, 4, 5];
    const game = generateGameByMode("diversificado", 5, {}, [pastGame]);
    expect(game).toHaveLength(5);
  });

  it("generateMultipleGames também aceita o histórico para o modo 'diversificado'", () => {
    const pastGame = [1, 2, 3, 4, 5];
    const games = generateMultipleGames("diversificado", 5, 5, {}, [pastGame]);
    expect(games).toHaveLength(5);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(5);
  });
});
