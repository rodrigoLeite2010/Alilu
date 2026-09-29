import { describe, expect, it } from "vitest";
import { DIA_DE_SORTE_CONFIG, DIA_DE_SORTE_BET_SIZES, DIA_DE_SORTE_PRIME_NUMBERS } from "@/lib/lotteries/dia-de-sorte-config";
import {
  MONTH_LABELS,
  analyzeGame,
  buildDiaDeSorteCsv,
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
  generateRandomMonth,
  getLongestSequence,
  getUsedBoardRows,
  secureRandomInt,
  validateCustomSelection,
} from "@/lib/lotteries/dia-de-sorte-generator";

function isSortedUnique(numbers: number[]): boolean {
  return numbers.every((n, i) => (i === 0 ? true : n > numbers[i - 1]));
}

describe("lotteries/dia-de-sorte-generator — geração básica", () => {
  it.each(DIA_DE_SORTE_BET_SIZES)(
    "generateRandomGame(%i) gera exatamente essa quantidade, sem duplicatas, entre 1 e 31",
    (betSize) => {
      const game = generateRandomGame(betSize);
      expect(game).toHaveLength(betSize);
      expect(isSortedUnique(game)).toBe(true);
      game.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(DIA_DE_SORTE_CONFIG.minNumber);
        expect(n).toBeLessThanOrEqual(DIA_DE_SORTE_CONFIG.maxNumber);
      });
    }
  );

  it("generateBalancedGame também sempre respeita quantidade, unicidade e faixa", () => {
    const game = generateBalancedGame(7);
    expect(game).toHaveLength(7);
    expect(isSortedUnique(game)).toBe(true);
    game.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(31);
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

describe("lotteries/dia-de-sorte-generator — análise do jogo (só números, nunca o mês)", () => {
  it("countEvenOdd conta pares e ímpares corretamente", () => {
    expect(countEvenOdd([1, 2, 3, 4, 5])).toEqual({ even: 2, odd: 3 });
  });

  it("countPrimes identifica os 11 primos entre 1 e 31 corretamente", () => {
    expect(countPrimes([1, 4, 6, 9, 10])).toBe(0);
    expect(countPrimes([...DIA_DE_SORTE_PRIME_NUMBERS])).toBe(11);
    expect(countPrimes([1, 2, 4, 9, 31])).toBe(2); // 2 e 31
  });

  it("calculateSum soma as dezenas", () => {
    expect(calculateSum([1, 2, 3])).toBe(6);
  });

  it("getLongestSequence encontra a maior sequência consecutiva, mesmo com a entrada desordenada", () => {
    expect(getLongestSequence([1, 5, 3, 4, 10])).toBe(3); // 3,4,5
    expect(getLongestSequence([1, 3, 5, 7])).toBe(1);
    expect(getLongestSequence([])).toBe(0);
  });

  it("getUsedBoardRows conta quantas das 5 linhas do volante (blocos de 7, última com 3) têm pelo menos um número", () => {
    expect(getUsedBoardRows([1, 2, 3])).toBe(1); // linha 1 (01-07)
    expect(getUsedBoardRows([7, 8])).toBe(2); // 7 está na linha 01-07, 8 já está na linha 08-14
    expect(getUsedBoardRows([1, 8, 15, 22, 29])).toBe(5); // uma dezena em cada uma das 5 linhas
  });

  it("analyzeGame junta tudo em um único objeto consistente, com totalRows = 5", () => {
    const analysis = analyzeGame([5, 1, 3, 2, 31]);
    expect(analysis.numbers).toEqual([1, 2, 3, 5, 31]);
    expect(analysis.count).toBe(5);
    expect(analysis.even).toBe(1); // só o 2
    expect(analysis.odd).toBe(4);
    expect(analysis.primes).toBe(4); // 2, 3, 5, 31
    expect(analysis.sum).toBe(42);
    expect(analysis.longestSequence).toBe(3); // 1,2,3
    expect(analysis.usedRows).toBe(2); // linha 01-07 (1,2,3,5) e linha 29-31 (31)
    expect(analysis.totalRows).toBe(5);
  });
});

describe("lotteries/dia-de-sorte-generator — modo Personalizado: validação", () => {
  it("aceita uma seleção válida", () => {
    expect(validateCustomSelection(7, [3, 7], [5]).valid).toBe(true);
  });

  it("rejeita um número simultaneamente obrigatório e excluído", () => {
    const result = validateCustomSelection(7, [3], [3]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/obrigatório e excluído/);
  });

  it("rejeita mais números obrigatórios do que o tamanho do jogo", () => {
    const mustInclude = Array.from({ length: 8 }, (_, i) => i + 1);
    const result = validateCustomSelection(7, mustInclude, []);
    expect(result.valid).toBe(false);
  });

  it("rejeita exclusão excessiva que impede completar o jogo", () => {
    const mustExclude = Array.from({ length: 25 }, (_, i) => i + 1); // exclui 25, sobram 6 < 7
    const result = validateCustomSelection(7, [], mustExclude);
    expect(result.valid).toBe(false);
  });

  it("rejeita tamanho de aposta fora de 7-15", () => {
    expect(validateCustomSelection(6, [], []).valid).toBe(false);
    expect(validateCustomSelection(16, [], []).valid).toBe(false);
  });

  it("rejeita números fora da faixa 1-31", () => {
    expect(validateCustomSelection(7, [0], []).valid).toBe(false);
    expect(validateCustomSelection(7, [32], []).valid).toBe(false);
  });
});

describe("lotteries/dia-de-sorte-generator — modo Personalizado: geração", () => {
  it("sempre inclui os números obrigatórios e nunca inclui os excluídos", () => {
    const game = generateCustomGame(7, { mustInclude: [1, 2, 3], mustExclude: [29, 30, 31] });
    expect(game).toHaveLength(7);
    expect(game).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(game).not.toEqual(expect.arrayContaining([29, 30, 31]));
  });

  it("lança um erro com a mensagem de validação quando a seleção é inválida", () => {
    expect(() => generateCustomGame(7, { mustInclude: [1], mustExclude: [1] })).toThrow(/obrigatório e excluído/);
  });

  it("funciona no limite (mustInclude preenche o jogo inteiro)", () => {
    const mustInclude = Array.from({ length: 7 }, (_, i) => i + 1);
    const game = generateCustomGame(7, { mustInclude });
    expect(game).toEqual(mustInclude);
  });

  it("balanced: true aplica o filtro de composição ao completar o restante", () => {
    const game = generateCustomGame(10, { mustInclude: [1], balanced: true });
    expect(game).toHaveLength(10);
    expect(game).toEqual(expect.arrayContaining([1]));
  });
});

describe("lotteries/dia-de-sorte-generator — geração múltipla sem duplicatas", () => {
  it("gera a quantidade pedida de jogos, todos diferentes entre si", () => {
    const games = generateMultipleGames("aleatorio", 7, 20);
    expect(games).toHaveLength(20);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(20);
  });

  it("cada jogo gerado continua respeitando o tamanho e a faixa", () => {
    const games = generateMultipleGames("equilibrado", 9, 5);
    games.forEach((game) => {
      expect(game).toHaveLength(9);
      expect(isSortedUnique(game)).toBe(true);
    });
  });

  it("modo personalizado plugado na geração múltipla respeita os números obrigatórios em todos os jogos", () => {
    const games = generateMultipleGames("personalizado", 7, 5, { mustInclude: [1, 2] });
    games.forEach((game) => {
      expect(game).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  it("generateGameByMode despacha para a função certa por modo", () => {
    expect(generateGameByMode("aleatorio", 7)).toHaveLength(7);
    expect(generateGameByMode("equilibrado", 7)).toHaveLength(7);
    expect(generateGameByMode("personalizado", 7, { mustInclude: [10] })).toEqual(expect.arrayContaining([10]));
  });
});

describe("lotteries/dia-de-sorte-generator — similaridade e CSV (só números, sem o mês)", () => {
  it("calculateGameSimilarity (reexportado de shared) usa interseção/união (Jaccard)", () => {
    expect(calculateGameSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(calculateGameSimilarity([1, 2, 3], [4, 5, 6])).toBe(0);
  });

  it("buildDiaDeSorteCsv gera uma linha de cabeçalho e uma por jogo, sem coluna de mês", () => {
    const csv = buildDiaDeSorteCsv([[1, 2, 3], [4, 5, 6]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Jogo,Números");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,"1 2 3"');
    expect(lines[2]).toBe('2,"4 5 6"');
  });
});

describe("lotteries/dia-de-sorte-generator — diversificar meus jogos (núcleo pronto, sem UI nesta Fase A)", () => {
  it("sem histórico, cai para o modo Equilibrado (jogo válido de qualquer forma)", () => {
    const game = generateDiversifiedGame(7, []);
    expect(game).toHaveLength(7);
    expect(new Set(game).size).toBe(7);
  });

  it("prefere um candidato com menor semelhança máxima em relação ao histórico", () => {
    const pastGame = [1, 2, 3, 4, 5, 6, 7];
    const diversified = generateDiversifiedGame(7, [pastGame, pastGame]);

    expect(diversified).toHaveLength(7);
    expect(calculateGameSimilarity(diversified, pastGame)).toBeLessThan(1);
  });

  it("generateGameByMode despacha 'diversificado' para generateDiversifiedGame", () => {
    const pastGame = [1, 2, 3, 4, 5, 6, 7];
    const game = generateGameByMode("diversificado", 7, {}, [pastGame]);
    expect(game).toHaveLength(7);
  });

  it("generateMultipleGames também aceita o histórico para o modo 'diversificado'", () => {
    const pastGame = [1, 2, 3, 4, 5, 6, 7];
    const games = generateMultipleGames("diversificado", 7, 5, {}, [pastGame]);
    expect(games).toHaveLength(5);
    const keys = games.map((game) => game.join("-"));
    expect(new Set(keys).size).toBe(5);
  });
});

describe("lotteries/dia-de-sorte-generator — Mês da Sorte (dimensão separada dos números)", () => {
  it("generateRandomMonth sempre devolve um inteiro entre 1 e 12", () => {
    for (let i = 0; i < 300; i += 1) {
      const month = generateRandomMonth();
      expect(Number.isInteger(month)).toBe(true);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    }
  });

  it("generateRandomMonth tem espalhamento estatístico — não trava sempre no mesmo mês", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i += 1) {
      seen.add(generateRandomMonth());
    }
    // Com 300 sorteios de 1 a 12, é praticamente certo que apareçam vários
    // meses diferentes — um valor baixo aqui indicaria um gerador
    // enviesado ou travado num único valor.
    expect(seen.size).toBeGreaterThan(6);
  });

  it("MONTH_LABELS tem exatamente 12 nomes, na ordem correta (índice 0 = Janeiro, índice 11 = Dezembro)", () => {
    expect(MONTH_LABELS).toHaveLength(12);
    expect(MONTH_LABELS[0]).toBe("Janeiro");
    expect(MONTH_LABELS[1]).toBe("Fevereiro");
    expect(MONTH_LABELS[2]).toBe("Março");
    expect(MONTH_LABELS[11]).toBe("Dezembro");
    expect(new Set(MONTH_LABELS).size).toBe(12); // sem nomes repetidos
  });

  it("nenhuma função de geração de números (generateGameByMode) devolve nada relacionado a mês — só number[]", () => {
    const game = generateGameByMode("aleatorio", 7);
    expect(Array.isArray(game)).toBe(true);
    game.forEach((n) => expect(typeof n).toBe("number"));
  });
});
