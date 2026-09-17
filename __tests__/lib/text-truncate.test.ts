import { describe, expect, it } from "vitest";
import { truncateText, DEFAULT_TRUNCATE_OPTIONS, TRUNCATE_MAX_LIMIT } from "@/lib/formatters/text-truncate";

describe("truncateText", () => {
  it("não corta texto menor que o limite", () => {
    expect(truncateText("curto", { ...DEFAULT_TRUNCATE_OPTIONS, limit: 100 })).toBe("curto");
  });

  it("corta por caracteres e adiciona reticências", () => {
    const result = truncateText("abcdefghij", {
      unit: "characters",
      limit: 5,
      addEllipsis: true,
      avoidCuttingWord: false,
    });
    expect(result).toBe("abcde…");
  });

  it("evita cortar palavra ao meio quando avoidCuttingWord é true", () => {
    const result = truncateText("uma frase de teste", {
      unit: "characters",
      limit: 10,
      addEllipsis: false,
      avoidCuttingWord: true,
    });
    expect(result).toBe("uma frase");
  });

  it("corta por palavras", () => {
    const result = truncateText("uma frase razoavelmente longa de teste", {
      unit: "words",
      limit: 3,
      addEllipsis: true,
      avoidCuttingWord: false,
    });
    expect(result).toBe("uma frase razoavelmente…");
  });

  it("corta por linhas", () => {
    const result = truncateText("linha 1\nlinha 2\nlinha 3", {
      unit: "lines",
      limit: 2,
      addEllipsis: false,
      avoidCuttingWord: false,
    });
    expect(result).toBe("linha 1\nlinha 2");
  });

  it("nunca ultrapassa o limite máximo de segurança", () => {
    const result = truncateText("a".repeat(TRUNCATE_MAX_LIMIT + 10), {
      unit: "characters",
      limit: TRUNCATE_MAX_LIMIT + 1000,
      addEllipsis: false,
      avoidCuttingWord: false,
    });
    expect(result.length).toBeLessThanOrEqual(TRUNCATE_MAX_LIMIT);
  });
});
