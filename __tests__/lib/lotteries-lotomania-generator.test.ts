import { describe, expect, it } from "vitest";
import { LOTOMANIA_CONFIG } from "@/lib/lotteries/lotomania-config";
import {
  analyzeGame,
  buildLotomaniaCsv,
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
} from "@/lib/lotteries/lotomania-generator";

const BET_SIZE = LOTOMANIA_CONFIG.minBetNumbers; // sempre 50, não há faixa de escolha na Lotomania.

function isSortedUnique(numbers: number[]): boolean {
  return numbers.every((n, i) => (i === 0 ? true : n > numbers[i - 1]));
}

describe("lotteries/lotomania-generator — geração básica", () => {
  it("generateRandomGame(50) gera exatamente 50 números, sem duplicatas, entre 00 e 99", () => {
    const game = generateRandomGame(BET_SIZE);
    expect(game).toHaveLength(50);
    expect(isSortedUnique(game)).toBe(true);
    game.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(LOTOMANIA_CONFIG.minNumber);
      expect(n).toBeLessThanOrEqual(LOTOMANIA_CONFIG.maxNumber);
    });
  });

  it("o número 0 (\"00\") é um valor legalmente sorteável — off-by-one fácil de errar aqui", () => {
    // Sorteia repetidamente até aparecer o 0 no jogo, ou desiste depois de
    // muitas tentativas (o que indicaria um bug de exclusão do 0, já que a
    // chance dele NÃO aparecer em nenhuma de 200 tentativas de um jogo de
    // metade do pool é astronomicamente pequena).
    let sawZero = false;
    for (let i = 0; i < 200 && !sawZero; i += 1) {
      const game = generateRandomGame(BET_SIZE);
      if (game.includes(0)) sawZero = true;
    }
    expect(sawZero).toBe(true);
  });

  it("generateBalancedGame também sempre respeita quantidade, unicidade e faixa (0 a 99)", () => {
    const game = generateBalancedGame(BET_SIZE);
    expect(game).toHaveLength(50);
    expect(isSortedUnique(game)).toBe(true);
    game.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(99);
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

describe("lotteries/lotomania-generator — análise do jogo", () => {
  it("countEvenOdd conta pares e ímpares corretamente, tratando 0 como par", () => {
    expect(countEvenOdd([0, 1, 2, 3, 4])).toEqual({ even: 3, odd: 2 }); // 0, 2, 4 pares
  });

  it("countPrimes identifica os 25 primos entre 0 e 99 corretamente (0 e 1 nunca são primos)", () => {
    expect(countPrimes([0, 1, 4, 6, 9, 10])).toBe(0);
    expect(
      countPrimes([
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
      ])
    ).toBe(25);
    expect(countPrimes([0, 1, 2, 4, 9, 99])).toBe(1);
  });

  it("calculateSum soma as dezenas", () => {
    expect(calculateSum([0, 1, 2])).toBe(3);
  });

  it("getLongestSequence encontra a maior sequência consecutiva, mesmo com a entrada desordenada", () => {
    expect(getLongestSequence([0, 1, 2, 10])).toBe(3); // 0,1,2
    expect(getLongestSequence([1, 3, 5, 7])).toBe(1);
    expect(getLongestSequence([])).toBe(0);
  });

  it("getUsedBoardRows conta quantas das 10 linhas do volante (blocos de 10, começando em 0) têm pelo menos um número", () => {
    expect(getUsedBoardRows([0, 1, 2])).toBe(1); // linha 00-09
    expect(getUsedBoardRows([9, 10])).toBe(2); // 9 está na linha 00-09, 10 já está na linha 10-19
    expect(getUsedBoardRows([0, 15, 25, 35, 45, 55, 65, 75, 85, 95])).toBe(10); // uma dezena em cada linha
  });

  it("analyzeGame junta tudo em um único objeto consistente, com totalRows = 10 — inclui corretamente o número 0", () => {
    const analysis = analyzeGame([5, 0, 3, 2, 99]);
    expect(analysis.numbers).toEqual([0, 2, 3, 5, 99]);
    expect(analysis.count).toBe(5);
    expect(analysis.even).toBe(2); // 0, 2 (0 conta como par)
    expect(analysis.odd).toBe(3); // 3, 5, 99
    expect(analysis.primes).toBe(3); // 2, 3, 5 (0 e 99 não são primos)
    expect(analysis.sum).toBe(109);
    expect(analysis.longestSequence).toBe(2); // 2,3 consecutivos
    expect(analysis.usedRows).toBe(2); // linha 00-09 (0,2,3,5) e linha 90-99 (99)
    expect(analysis.totalRows).toBe(10);
  });
});

describe("lotteries/lotomania-generator — modo Personalizado: validação", () => {
  it("aceita uma seleção válida de 50 números obrigatórios", () => {
    const mustInclude = Array.from({ length: 50 }, (_, i) => i);
    expect(validateCustomSelection(BET_SIZE, mustInclude, []).valid).toBe(true);
  });

  it("rejeita um número simultaneamente obrigatório e excluído", () => {
    const result = validateCustomSelection(BET_SIZE, [3], [3]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/obrigatório e excluído/);
  });

  it("rejeita mais números obrigatórios do que o tamanho do jogo (50)", () => {
    const mustInclude = Array.from({ length: 51 }, (_, i) => i);
    const result = validateCustomSelection(BET_SIZE, mustInclude, []);
    expect(result.valid).toBe(false);
  });

  it("rejeita exclusão excessiva que impede completar o jogo", () => {
    const mustExclude = Array.from({ length: 51 }, (_, i) => i); // exclui 51, sobram 49 < 50
    const result = validateCustomSelection(BET_SIZE, [], mustExclude);
    expect(result.valid).toBe(false);
  });

  it("rejeita qualquer tamanho de aposta diferente de 50 (a Lotomania não tem faixa de escolha)", () => {
    expect(validateCustomSelection(49, [], []).valid).toBe(false);
    expect(validateCustomSelection(51, [], []).valid).toBe(false);
  });

  it("rejeita números fora da faixa 0-99", () => {
    expect(validateCustomSelection(BET_SIZE, [-1], []).valid).toBe(false);
    expect(validateCustomSelection(BET_SIZE, [100], []).valid).toBe(false);
  });

  it("aceita o número 0 normalmente, como obrigatório ou excluído", () => {
    expect(validateCustomSelection(BET_SIZE, [0], []).valid).toBe(true);
    expect(validateCustomSelection(BET_SIZE, [], [0]).valid).toBe(true);
  });
});

describe("lotteries/lotomania-generator — modo Personalizado: geração", () => {
  it("sempre inclui os números obrigatórios (inclusive 0) e nunca inclui os excluídos", () => {
    const game = generateCustomGame(BET_SIZE, { mustInclude: [0, 1, 2], mustExclude: [97, 98, 99] });
    expect(game).toHaveLength(50);
    expect(game).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(game).not.toEqual(expect.arrayContaining([97, 98, 99]));
  });

  it("lança um erro com a mensagem de validação quando a seleção é inválida", () => {
    expect(() => generateCustomGame(BET_SIZE, { mustInclude: [1], mustExclude: [1] })).toThrow(
      /obrigatório e excluído/
    );
  });

  it("funciona no limite (mustInclude preenche o jogo inteiro, 50 números incluindo o 0)", () => {
    const mustInclude = Array.from({ length: 50 }, (_, i) => i);
    const game = generateCustomGame(BET_SIZE, { mustInclude });
    expect(game).toEqual(mustInclude);
  });

  it("balanced: true aplica o filtro de composição ao completar o restante", () => {
    const game = generateCustomGame(BET_SIZE, { mustInclude: [0], balanced: true });
    expect(game).toHaveLength(50);
    expect(game).toEqual(expect.arrayContaining([0]));
  });
});

describe("lotteries/lotomania-generator — geração múltipla sem duplicatas", () => {
  it("gera a quantidade pedida de jogos, todos diferentes entre si", () => {
    const games = generateMultipleGames("aleatorio", BET_SIZE, 10);
    expect(games).toHaveLength(10);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(10);
  });

  it("cada jogo gerado continua respeitando o tamanho (50) e a faixa (0-99)", () => {
    const games = generateMultipleGames("equilibrado", BET_SIZE, 5);
    games.forEach((game) => {
      expect(game).toHaveLength(50);
      expect(isSortedUnique(game)).toBe(true);
    });
  });

  it("modo personalizado plugado na geração múltipla respeita os números obrigatórios em todos os jogos", () => {
    const games = generateMultipleGames("personalizado", BET_SIZE, 5, { mustInclude: [0, 1] });
    games.forEach((game) => {
      expect(game).toEqual(expect.arrayContaining([0, 1]));
    });
  });

  it("generateGameByMode despacha para a função certa por modo", () => {
    expect(generateGameByMode("aleatorio", BET_SIZE)).toHaveLength(50);
    expect(generateGameByMode("equilibrado", BET_SIZE)).toHaveLength(50);
    expect(generateGameByMode("personalizado", BET_SIZE, { mustInclude: [10] })).toEqual(
      expect.arrayContaining([10])
    );
  });
});

describe("lotteries/lotomania-generator — similaridade e CSV", () => {
  it("calculateGameSimilarity (reexportado de shared) usa interseção/união (Jaccard)", () => {
    expect(calculateGameSimilarity([0, 1, 2], [0, 1, 2])).toBe(1);
    expect(calculateGameSimilarity([0, 1, 2], [4, 5, 6])).toBe(0);
  });

  it("buildLotomaniaCsv gera uma linha de cabeçalho e uma por jogo", () => {
    const csv = buildLotomaniaCsv([[0, 1, 2], [4, 5, 6]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Jogo,Números");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,"0 1 2"');
    expect(lines[2]).toBe('2,"4 5 6"');
  });
});

describe("lotteries/lotomania-generator — diversificar meus jogos", () => {
  it("sem histórico, cai para o modo Equilibrado (jogo válido de qualquer forma)", () => {
    const game = generateDiversifiedGame(BET_SIZE, []);
    expect(game).toHaveLength(50);
    expect(new Set(game).size).toBe(50);
  });

  it("prefere um candidato com menor semelhança máxima em relação ao histórico", () => {
    const pastGame = Array.from({ length: 50 }, (_, i) => i); // 0..49
    const diversified = generateDiversifiedGame(BET_SIZE, [pastGame, pastGame]);

    expect(diversified).toHaveLength(50);
    expect(calculateGameSimilarity(diversified, pastGame)).toBeLessThan(1);
  });

  it("generateGameByMode despacha 'diversificado' para generateDiversifiedGame", () => {
    const pastGame = Array.from({ length: 50 }, (_, i) => i);
    const game = generateGameByMode("diversificado", BET_SIZE, {}, [pastGame]);
    expect(game).toHaveLength(50);
  });

  it("generateMultipleGames também aceita o histórico para o modo 'diversificado'", () => {
    const pastGame = Array.from({ length: 50 }, (_, i) => i);
    const games = generateMultipleGames("diversificado", BET_SIZE, 3, {}, [pastGame]);
    expect(games).toHaveLength(3);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(3);
  });
});
