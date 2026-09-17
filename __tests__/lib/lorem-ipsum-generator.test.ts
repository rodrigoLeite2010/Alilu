import { describe, expect, it } from "vitest";
import {
  generateLoremIpsum,
  validateLoremIpsumGeneratorInput,
  isLoremIpsumGeneratorInputValid,
  LOREM_IPSUM_MAX_COUNT,
} from "@/lib/calculators/lorem-ipsum-generator";

describe("lorem-ipsum-generator", () => {
  it("gera a quantidade de palavras pedida", () => {
    const text = generateLoremIpsum({ unit: "palavras", count: 10, startWithLorem: false });
    expect(text.split(/\s+/)).toHaveLength(10);
  });

  it("gera a quantidade de frases pedida (uma frase por ponto final)", () => {
    const text = generateLoremIpsum({ unit: "frases", count: 3, startWithLorem: false });
    expect(text.split(".").filter((s) => s.trim().length > 0)).toHaveLength(3);
  });

  it("gera a quantidade de parágrafos pedida (separados por linha em branco)", () => {
    const text = generateLoremIpsum({ unit: "paragrafos", count: 2, startWithLorem: false });
    expect(text.split("\n\n")).toHaveLength(2);
  });

  it("começa com 'Lorem ipsum' quando startWithLorem é true", () => {
    const words = generateLoremIpsum({ unit: "palavras", count: 5, startWithLorem: true });
    expect(words.toLowerCase().startsWith("lorem ipsum")).toBe(true);

    const sentences = generateLoremIpsum({ unit: "frases", count: 2, startWithLorem: true });
    expect(sentences.toLowerCase().startsWith("lorem ipsum")).toBe(true);

    const paragraphs = generateLoremIpsum({ unit: "paragrafos", count: 2, startWithLorem: true });
    expect(paragraphs.toLowerCase().startsWith("lorem ipsum")).toBe(true);
  });

  it("nunca gera mais que LOREM_IPSUM_MAX_COUNT unidades", () => {
    const text = generateLoremIpsum({ unit: "palavras", count: 99999, startWithLorem: false });
    expect(text.split(/\s+/)).toHaveLength(LOREM_IPSUM_MAX_COUNT);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateLoremIpsumGeneratorInput({ unit: "palavras", count: 0, startWithLorem: false }).count
    ).toBeDefined();
    expect(isLoremIpsumGeneratorInputValid({ unit: "palavras", count: 1, startWithLorem: false })).toBe(true);
  });
});
