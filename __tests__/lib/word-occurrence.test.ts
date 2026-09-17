import { describe, expect, it } from "vitest";
import { countWordOccurrences, DEFAULT_WORD_OCCURRENCE_OPTIONS } from "@/lib/formatters/word-occurrence";

describe("countWordOccurrences", () => {
  it("conta ocorrências simples, ignorando caixa por padrão", () => {
    const result = countWordOccurrences("O Sol e o sol brilham", "sol", DEFAULT_WORD_OCCURRENCE_OPTIONS);
    expect(result.count).toBe(2);
  });

  it("diferencia maiúsculas/minúsculas quando caseSensitive é true", () => {
    const result = countWordOccurrences("O Sol e o sol brilham", "sol", {
      ...DEFAULT_WORD_OCCURRENCE_OPTIONS,
      caseSensitive: true,
    });
    expect(result.count).toBe(1);
  });

  it("conta apenas palavra inteira quando wholeWord é true", () => {
    const result = countWordOccurrences("sol solto girassol", "sol", {
      ...DEFAULT_WORD_OCCURRENCE_OPTIONS,
      wholeWord: true,
    });
    expect(result.count).toBe(1);
  });

  it("conta ocorrências parciais quando wholeWord é false", () => {
    const result = countWordOccurrences("sol solto girassol", "sol", {
      ...DEFAULT_WORD_OCCURRENCE_OPTIONS,
      wholeWord: false,
    });
    expect(result.count).toBe(3);
  });

  it("retorna a linha e coluna corretas de cada ocorrência", () => {
    const result = countWordOccurrences("abc\nxabcx", "abc", DEFAULT_WORD_OCCURRENCE_OPTIONS);
    expect(result.matches).toEqual([
      { line: 1, column: 1 },
      { line: 2, column: 2 },
    ]);
  });

  it("retorna zero ocorrências para termo vazio", () => {
    expect(countWordOccurrences("qualquer texto", "", DEFAULT_WORD_OCCURRENCE_OPTIONS)).toEqual({
      count: 0,
      matches: [],
    });
  });

  it("escapa caracteres especiais de regex no termo buscado", () => {
    const result = countWordOccurrences("preço: R$ 10.00 (com desconto)", "R$ 10.00", DEFAULT_WORD_OCCURRENCE_OPTIONS);
    expect(result.count).toBe(1);
  });
});
